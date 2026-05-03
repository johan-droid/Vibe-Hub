const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
const { interpret } = require('xstate');
const agentMachine = require('./state_machine');
const { selectSkillProfile } = require('./skill-graph.js');

// Resolve directory for skill files
const __dirname = path.dirname(__filename);
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
     */
    async executeWithStateMachine(prompt, userId, targetFile) {
        return new Promise((resolve, reject) => {
            const agentService = interpret(agentMachine).onTransition((state) => {
                console.log(`Agent Status: transitioned to [${state.value}]`);
                
                if (state.value === 'success') {
                    resolve({
                        success: true,
                        code: state.context.generatedCode,
                        astGraph: state.context.astGraph,
                        retries: state.context.retries
                    });
                } else if (state.value === 'fatal_failure') {
                    reject(new Error(`Fatal failure: ${state.context.sandboxError || 'Unknown error'}`));
                }
            });

            agentService.start();
            agentService.send({ 
                type: 'START_TASK', 
                prompt, 
                userId,
                targetFile 
            });
        });
    }
}

const router = new Router();

/**
 * API endpoint handler for code requests
 */
async function handleCodeRequest(req, res) {
    const { prompt, userId, targetFile } = req.body;

    try {
        // Option 1: Use XState machine with rollback
        const result = await router.executeWithStateMachine(prompt, userId, targetFile);
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

module.exports = { Router, router, handleCodeRequest };
