import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createActor } from 'xstate';
import agentMachine from './state_machine.js';
import { selectSkillProfile } from './skill-graph.js';
import { vfs } from '../vfs/container.js';
import { logger, logStateTransition } from '../utils/logger.js';
import { codeRequestSchema, vfsCommitSchema, validateRequest } from '../utils/validation.js';
import { captureException } from '../utils/sentry.js';
import { recordSandboxDuration } from '../utils/metrics.js';
import { repoManager } from './repository_manager.js';
import { mcpManager } from '../mcp/MCPManager.js';


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
    async executeWithStateMachine(prompt, userId, targetFile, io, socketId, requestId = null) {
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

        let originalCode = '';
        try {
            originalCode = await fs.readFile(targetFile, 'utf-8');
        } catch (err) {
            originalCode = '';
        }

        return new Promise((resolve, reject) => {
            let sandboxStartedAt = null;
            let settled = false;
            let previousState = 'unknown';
            const agentService = createActor(agentMachine);
            const subscription = agentService.subscribe({
              next: (state) => {
                console.log(`Agent Status: transitioned to [${state.value}]`);
                if (state.value === 'sandboxing') {
                    sandboxStartedAt = Date.now();
                }

                if (sandboxStartedAt && ['success', 'evaluating_failure', 'fatal_failure'].includes(String(state.value))) {
                    recordSandboxDuration((Date.now() - sandboxStartedAt) / 1000, {
                        userId,
                        targetFile,
                        result: String(state.value)
                    });
                    sandboxStartedAt = null;
                }
                
                logStateTransition(previousState, state.value, state.context, userId);
                previousState = state.value;
                
                if (io && socketId) {
                    io.to(socketId).emit('agent_status', {
                        status: state.value,
                        message: this.mapStateToMessage(state.value),
                        retries: state.context.retries,
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (state.value === 'success') {
                    if (settled) return;
                    settled = true;
                    subscription.unsubscribe();
                    vfs.off('file_staged', onFileStaged);
                    resolve({
                        success: true,
                        code: state.context.generatedCode,
                        astGraph: state.context.astGraph,
                        retries: state.context.retries,
                        stagedFile: state.context.stagedFile
                    });
                } else if (state.value === 'fatal_failure') {
                    if (settled) return;
                    settled = true;
                    subscription.unsubscribe();
                    vfs.off('file_staged', onFileStaged);
                    captureException(new Error(`Fatal failure: ${state.context.sandboxError || 'Unknown error'}`), {
                        userId,
                        targetFile,
                        context: state.context
                    });
                    reject(new Error(`Fatal failure: ${state.context.sandboxError || 'Unknown error'}`));
                }
              },
              error: (error) => {
                if (settled) return;
                settled = true;
                subscription.unsubscribe();
                vfs.off('file_staged', onFileStaged);
                reject(error);
              }
            });

            agentService.start();
            agentService.send({ 
                type: 'START_TASK', 
                prompt, 
                userId,
                targetFile,
                originalCode,
                requestId
            });
        });
    }

    mapStateToMessage(stateValue) {
        const messages = {
            idle: "Waiting to start...",
            loading_contexts: "Locking organizational and user boundaries...",
            parsing_ast: "Building semantic code graph...",
            drafting_code: "Synthesizing logic with LLM...",
            sandboxing: "Executing in offline GitHub Actions sandbox...",
            evaluating_failure: "Sandbox execution failed. Analyzing trace...",
            rollback: "CRITICAL: Forcing architectural rollback. Pivoting approach...",
            success: "Code verified and ready.",
            fatal_failure: "Fatal error occurred. Orchestration halted."
        };
        return messages[stateValue] || "Processing...";
    }
}

const router = new Router();
const rollbackTracker = new Map();
const RETRY_WINDOW_MS = 10 * 60 * 1000;
const MAX_CONSECUTIVE_ROLLBACKS = Number.parseInt(process.env.MAX_CONSECUTIVE_ROLLBACKS || '3', 10);

function getRetryState(userId) {
    const now = Date.now();
    const current = rollbackTracker.get(userId);
    if (!current || now - current.updatedAt > RETRY_WINDOW_MS) {
        const fresh = { count: 0, updatedAt: now };
        rollbackTracker.set(userId, fresh);
        return fresh;
    }
    return current;
}

function resetRetryState(userId) {
    rollbackTracker.delete(userId);
}

function recordRollback(userId) {
    const state = getRetryState(userId);
    state.count += 1;
    state.updatedAt = Date.now();
    rollbackTracker.set(userId, state);
    return state;
}

function authorizeVfsEntry(filePath, userId) {
    const entry = typeof vfs.getStagedFile === 'function' ? vfs.getStagedFile(filePath) : null;
    if (!entry) return { ok: false, status: 404, error: 'Staged file not found.' };

    const ownerId = entry.metadata?.userId;
    if (!ownerId) return { ok: false, status: 403, error: 'Staged file is missing ownership metadata.' };
    if (String(ownerId) !== String(userId)) return { ok: false, status: 403, error: 'You do not have access to this staged file.' };

    return { ok: true, entry };
}

async function handleCodeRequest(req, res) {
    const parsed = req.validatedBody ? { success: true, data: req.validatedBody } : codeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: parsed.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
            requestId: req.id
        });
    }

    const { prompt, targetFile, socketId } = parsed.data;
    const userId = req.user?.id || parsed.data.userId;
    const io = req.app.get('io');
    const codeQueue = req.app.get('codeQueue');
    const retryState = getRetryState(userId);

    if (retryState.count >= MAX_CONSECUTIVE_ROLLBACKS) {
        return res.status(429).json({
            success: false,
            error: 'Retry limit exceeded. Please adjust the prompt or wait.',
            retryAfterMs: RETRY_WINDOW_MS,
            requestId: req.id
        });
    }

    if (!socketId) {
        return res.status(400).json({ error: "socketId is required", requestId: req.id });
    }

    if (codeQueue) {
        const queued = await codeQueue.enqueue({ prompt, userId, targetFile, socketId, requestId: req.id });
        if (io && socketId) {
            io.to(socketId).emit('agent_status', {
                status: 'queued',
                message: `Job ${queued.jobId} queued.`,
                jobId: queued.jobId,
                requestId: req.id,
                timestamp: new Date().toISOString()
            });
        }
        return res.status(202).json({ success: true, jobId: queued.jobId, requestId: req.id });
    }

    try {
        const result = await router.executeWithStateMachine(prompt, userId, targetFile, io, socketId, req.id);
        resetRetryState(userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        const rollbackState = recordRollback(userId);
        const config = await router.route(prompt);
        res.status(202).json({ success: false, error: error.message, rollbackCount: rollbackState.count, fallback: config });
    }
}

async function handleCodeJobStatus(req, res) {
    const codeQueue = req.app.get('codeQueue');
    if (!codeQueue) return res.status(404).json({ success: false, error: 'Queue not enabled' });

    const job = await codeQueue.getStatus(req.params.jobId, req.user?.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.forbidden) return res.status(403).json({ success: false, error: 'Forbidden' });

    res.json({ success: true, job });
}

async function handleCommitRequest(req, res) {
    const parsed = req.validatedBody ? { success: true, data: req.validatedBody } : vfsCommitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Validation failed' });

    const { filePath, approved } = parsed.data;
    const authorization = authorizeVfsEntry(filePath, req.user?.id);
    if (!authorization.ok) return res.status(authorization.status).json({ success: false, error: authorization.error });

    try {
        if (!approved) {
            vfs.rejectFile(filePath, 'User rejected', { userId: req.user?.id });
            return res.json({ success: true, message: "Rejected" });
        }
        await vfs.approveFile(filePath, { userId: req.user?.id });
        const entry = await vfs.commitToDisk(filePath, fs, { userId: req.user?.id });
        res.json({ success: true, filePath: entry.filePath });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleGetPendingFiles(req, res) {
    try {
        const pending = vfs.getPendingFiles().filter(e => String(e.metadata?.userId) === String(req.user?.id));
        res.json({ success: true, files: pending });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleGetVfsStats(req, res) {
    try {
        const stats = vfs.getStats({ userId: req.user?.id });
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleLinkRepo(req, res) {
    try {
        const { url } = req.body;
        const result = await repoManager.linkRepository(url, req.user?.id || 'anonymous');
        res.json({ success: true, project: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleListRepos(req, res) {
    try {
        const repos = await repoManager.listRepositories(req.user?.id || 'anonymous');
        res.json({ success: true, repos });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleListTools(req, res) {
    try {
        const tools = await mcpManager.refreshTools();
        res.json({ success: true, tools });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleListServers(req, res) {
    try {
        const servers = mcpManager.listServers();
        res.json({ success: true, servers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleCallTool(req, res) {
    try {
        const { toolId, arguments: args } = req.body;
        const result = await mcpManager.callTool(toolId, args);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleRegisterServer(req, res) {
    try {
        const { name, command, args } = req.body;
        const success = await mcpManager.registerServer(name, command, args || []);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export { 
    Router, router, handleCodeRequest, handleCodeJobStatus, handleCommitRequest, 
    handleGetPendingFiles, handleGetVfsStats, handleLinkRepo, handleListRepos, 
    handleListTools, handleListServers, handleCallTool, handleRegisterServer 
};
