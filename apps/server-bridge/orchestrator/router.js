import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { interpret } from 'xstate';
import agentMachine from './state_machine.js';
import { selectSkillProfile } from './skill-graph.js';
import { vfs } from '../vfs/container.js';

// Resolve directory for skill files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills');

/**
 * AIService — Singleton Pattern
 * Prevents memory spikes and repeated client initialization.
 */
class AIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (this.apiKey) {
            this.client = new GoogleGenerativeAI(this.apiKey);
            this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
        }
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new AIService();
        }
        return this.instance;
    }
}

/**
 * Router — Principal Systems Architect Implementation
 * 
 * Implements a two-pass architecture for hyper-optimized agent routing.
 * L1: Local heuristic mapping (zero latency)
 * L2: LLM-based intent classification
 */
class Router {
    constructor() {
        this.ai = AIService.getInstance();
        this.skillCache = new Map(); // path -> content
        
        // Expert Domain Mapping
        this.domains = {
            git: { file: 'core.md', triggers: [/git/i, /commit/i, /branch/i, /push/i, /clone/i] },
            debug: { file: 'debugging.md', triggers: [/error/i, /failed/i, /bug/i, /fix/i, /crash/i, /stack trace/i] },
            ui: { file: 'react.md', triggers: [/navbar/i, /css/i, /tailwind/i, /component/i, /color/i, /design/i, /style/i, /layout/i] },
            code: { file: 'surgical-edit.md', triggers: [/function/i, /refactor/i, /implement/i, /create/i, /add/i, /write/i, /logic/i] },
            manager: { file: 'planning.md', triggers: [/plan/i, /architecture/i, /overview/i, /multi-step/i, /large-scale/i, /roadmap/i] },
            security: { file: 'cloud-sandboxing.md', triggers: [/audit/i, /security/i, /vulnerability/i, /scan/i, /hardening/i, /sandbox/i] },
            creative: { file: 'core.md', triggers: [/creative/i, /aesthetic/i, /brand/i, /concept/i, /mood/i] },
        };
    }

    /**
     * Determine the best expert for the given prompt.
     * @param {string} prompt - The raw user input.
     * @returns {Promise<{domain: string, systemPrompt: string}>}
     */
    async route(prompt) {
        const skillProfile = selectSkillProfile(prompt);
        if (skillProfile.selectedSkills.length > 0) {
            return await this.getExpertConfig(skillProfile.domain, skillProfile);
        }

        // L1: Fast Heuristic Pass (Zero Latency)
        for (const [domain, config] of Object.entries(this.domains)) {
            if (config.triggers.some(regex => regex.test(prompt))) {
                return await this.getExpertConfig(domain, skillProfile);
            }
        }

        // L2: LLM Intent Classification (Zero-Shot)
        if (!this.ai.model) {
            return await this.getExpertConfig('code');
        }

        try {
            const classificationPrompt = `
                Act as a lightweight intent classifier. Classify the user prompt into exactly ONE of these domains: 
                git, debug, ui, code, manager, security, creative.
                
                - manager: High-level planning, architectural changes, or complex tasks.
                - security: Scans, audits, or running code in sandboxes.
                - creative: Aesthetic vision, brand concepts, or UI polish.
                - debug: Fixing errors, analyzing logs, or troubleshooting.
                - ui: Building React components, CSS, or Tailwind styling.
                - code: General programming tasks, logic implementation, or refactoring.
                - git: Repository management, branching, or commits.
 
                User Prompt: "${prompt}"
                Respond with only the domain name.
            `;

            const result = await this.ai.model.generateContent(classificationPrompt);
            const domain = result.response.text().trim().toLowerCase();
            
            if (this.domains[domain]) {
                return await this.getExpertConfig(domain, skillProfile);
            }
        } catch (err) {
            // L2 classification failed
        }

        return await this.getExpertConfig('code', skillProfile);
    }

    /**
     * Loads the system instruction (expert skill) from disk with caching.
     */
    async getExpertConfig(domain, skillProfile = null) {
        const config = this.domains[domain] || this.domains.code;
        const skillPath = path.join(SKILLS_DIR, config.file);

        if (!this.skillCache.has(skillPath)) {
            try {
                const content = await fs.readFile(skillPath, 'utf-8');
                this.skillCache.set(skillPath, content);
            } catch (err) {
                return { domain, systemPrompt: `You are a ${domain} expert.` };
            }
        }

        return {
            domain,
            systemPrompt: this.skillCache.get(skillPath),
            skillProfile,
        };
    }

    /**
     * Wraps the prompt with VFS context protection to prevent prompt injection.
     */
    wrapContext(prompt, vfsSummary) {
        return `
[VFS_WORKSPACE_CONTEXT_START]
${vfsSummary}
[VFS_WORKSPACE_CONTEXT_END]

[USER_INSTRUCTION]
${prompt}
        `.trim();
    }

    /**
     * Execute task through XState machine with rollback capability
     * Streams state transitions via Socket.io for real-time UI updates
     */
    async executeWithStateMachine(prompt, userId, targetFile, io, socketId) {
        // Set up VFS listener to broadcast staged files via WebSocket
        const onFileStaged = (entry) => {
            if (io && socketId) {
                io.to(socketId).emit('file_staged', {
                    filePath: entry.filePath,
                    originalContent: entry.originalContent,
                    proposedContent: entry.proposedContent,
                    metadata: entry.metadata,
                    status: entry.status,
                    timestamp: entry.metadata.timestamp
                });
                console.log(`[Router] Broadcasted staged file: ${entry.filePath}`);
            }
        };
        vfs.on('file_staged', onFileStaged);

        // Load original file content for diff comparison
        let originalCode = '';
        try {
            originalCode = await fs.readFile(targetFile, 'utf-8');
        } catch (err) {
            // File doesn't exist yet (new file creation)
            originalCode = '';
        }

        return new Promise((resolve, reject) => {
            const agentService = interpret(agentMachine).onTransition((state) => {
                console.log(`Agent Status: transitioned to [${state.value}]`);
                
                // Stream the internal agent status to the frontend via Socket.io
                if (io && socketId) {
                    io.to(socketId).emit('agent_status', {
                        status: state.value,
                        message: this.mapStateToMessage(state.value),
                        retries: state.context.retries,
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (state.value === 'success') {
                    // Clean up VFS listener
                    vfs.off('file_staged', onFileStaged);
                    
                    resolve({
                        success: true,
                        code: state.context.generatedCode,
                        astGraph: state.context.astGraph,
                        retries: state.context.retries,
                        stagedFile: state.context.stagedFile
                    });
                } else if (state.value === 'fatal_failure') {
                    // Clean up VFS listener
                    vfs.off('file_staged', onFileStaged);
                    
                    reject(new Error(`Fatal failure: ${state.context.sandboxError || 'Unknown error'}`));
                }
            });

            agentService.start();
            agentService.send({ 
                type: 'START_TASK', 
                prompt, 
                userId,
                targetFile,
                originalCode
            });
        });
    }

    /**
     * Translates raw XState nodes into user-facing UI text.
     */
    mapStateToMessage(stateValue) {
        const messages = {
            idle: "Waiting to start...",
            loading_contexts: "Locking organizational and user boundaries...",
            parsing_ast: "Building semantic code graph...",
            drafting_code: "Synthesizing logic with LLM...",
            sandboxing: "Executing in offline Docker sandbox...",
            evaluating_failure: "Sandbox execution failed. Analyzing trace...",
            rollback: "CRITICAL: Forcing architectural rollback. Pivoting approach...",
            success: "Code verified and ready.",
            fatal_failure: "Fatal error occurred. Orchestration halted."
        };
        return messages[stateValue] || "Processing...";
    }
}

const router = new Router();

/**
 * API endpoint handler for code requests
 * Supports WebSocket streaming via socketId in request body
 */
async function handleCodeRequest(req, res) {
    const { prompt, userId, targetFile, socketId } = req.body;
    const io = req.app.get('io');

    if (!socketId) {
        return res.status(400).json({ 
            error: "socketId is required for real-time orchestration tracking." 
        });
    }

    try {
        // Option 1: Use XState machine with rollback and WebSocket streaming
        const result = await router.executeWithStateMachine(prompt, userId, targetFile, io, socketId);
        res.status(200).json({ 
            success: true,
            message: "Agent completed successfully",
            data: result
        });
    } catch (error) {
        // Option 2: Fallback to legacy routing (no rollback)
        const config = await router.route(prompt);
        res.status(202).json({ 
            success: false,
            message: "Agent entered rollback loop",
            error: error.message,
            fallback: config
        });
    }
}

/**
 * API endpoint to commit approved VFS changes to physical disk
 * ONLY this endpoint performs actual fs.writeFile operations
 */
async function handleCommitRequest(req, res) {
    const { filePath, approved } = req.body;

    if (!filePath) {
        return res.status(400).json({
            success: false,
            error: "filePath is required"
        });
    }

    try {
        if (!approved) {
            // User rejected the changes - drop from VFS
            vfs.rejectFile(filePath, 'User rejected changes');
            return res.status(200).json({
                success: true,
                message: "Changes rejected. File not modified.",
                filePath
            });
        }

        // User approved - commit to physical disk
        await vfs.approveFile(filePath);
        const entry = await vfs.commitToDisk(filePath, fs);

        res.status(200).json({
            success: true,
            message: "Changes committed to disk successfully",
            filePath: entry.filePath,
            committedAt: entry.metadata.committedAt
        });

    } catch (error) {
        console.error(`[Commit] Failed to commit ${filePath}:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            filePath
        });
    }
}

/**
 * API endpoint to get pending VFS files for review
 */
async function handleGetPendingFiles(req, res) {
    try {
        const pending = vfs.getPendingFiles();
        res.status(200).json({
            success: true,
            files: pending
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

/**
 * API endpoint to get VFS statistics
 */
async function handleGetVfsStats(req, res) {
    try {
        const stats = vfs.getStats();
        res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

export { 
    Router, 
    router, 
    handleCodeRequest, 
    handleCommitRequest, 
    handleGetPendingFiles,
    handleGetVfsStats 
};
