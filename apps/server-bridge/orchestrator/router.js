import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createActor } from 'xstate';
import agentMachine from './state_machine.js';
import { selectSkillProfile } from './skill-graph.js';
import { vfs } from '../vfs/container.js';
import { logStateTransition } from '../utils/logger.js';
import logger from '../utils/detailed-logger.js';
import { codeRequestSchema, vfsCommitSchema, validateRequest } from '../utils/validation.js';
import { captureException } from '../utils/sentry.js';
import { recordSandboxDuration } from '../utils/metrics.js';
import { repoManager } from './repository_manager.js';
import { mcpManager } from '../mcp/MCPManager.js';
import { ToolSchemaError } from './tool_schema.js';
import { modelService } from './models.js';
import { resolveExpertProfile } from './expert-routing.js';
import { authorizeToolCall, ToolAuthError } from './tool_auth_guard.js';
import { hashToolParams, verifyActionGrant } from '../auth/action-grants.js';
import {
    ToolExecutionPolicyError,
    recordToolExecutionOutcome,
    validateToolInvocationPolicy,
} from './tool-execution-policy.js';
import {
    acquireRun,
    getConcurrencyRetryAfterSeconds,
    getRunConcurrencyLimit,
    releaseRun
} from '../auth/concurrency-governor.js';
import { registerSessionCleanup, unregisterSessionCleanup } from '../auth/session.js';


// Resolve directory for skill files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = path.join(__dirname, 'skills');

/**
 * Router — Principal Systems Architect Implementation
 * 
 * Implements a two-pass architecture for hyper-optimized agent routing.
 * L1: Local heuristic mapping (zero latency)
 * L2: LLM-based intent classification
 */
class Router {
    constructor() {
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
        // Check for multiple domains using regex
        const matchedDomains = [];
        for (const [domain, config] of Object.entries(this.domains)) {
            if (config.triggers.some(regex => regex.test(prompt))) {
                matchedDomains.push(domain);
            }
        }
        
        if (matchedDomains.length > 0) {
            const configs = await Promise.all(matchedDomains.map(d => this.getExpertConfig(d, skillProfile)));
            return { domain: matchedDomains[0], swarm: configs, skillProfile };
        }

        // L2: LLM Intent Classification (Zero-Shot)
        try {
            const classificationPrompt = `
                Act as a lightweight intent classifier. Classify the user prompt into ONE OR MORE of these domains: 
                git, debug, ui, code, manager, security, creative.
                
                - manager: High-level planning, architectural changes, or complex tasks.
                - security: Scans, audits, or running code in sandboxes.
                - creative: Aesthetic vision, brand concepts, or UI polish.
                - debug: Fixing errors, analyzing logs, or troubleshooting.
                - ui: Building React components, CSS, or Tailwind styling.
                - code: General programming tasks, logic implementation, or refactoring.
                - git: Repository management, branching, or commits.
 
                User Prompt: "${prompt}"
                Respond with only a comma-separated list of the domain names.
            `;

            const result = await modelService.completeText({
                prompt: classificationPrompt,
                provider: process.env.SELINA_EXPERT_MANAGER_PROVIDER || process.env.SELINA_MODEL_PROVIDER,
                effortLevel: 'quick',
                domain: 'manager',
                meta: { phase: 'router_classification' },
            });
            const domainsStr = result.content.trim().toLowerCase();
            const domains = domainsStr.split(',').map(d => d.trim()).filter(d => this.domains[d]);
            
            if (domains.length > 0) {
                const configs = await Promise.all(domains.map(d => this.getExpertConfig(d, skillProfile)));
                return { domain: domains[0], swarm: configs, skillProfile };
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
                return {
                    domain,
                    systemPrompt: `You are a ${domain} expert.`,
                    skillProfile,
                    expertProfile: resolveExpertProfile({ domain, modelService }),
                };
            }
        }

        return {
            domain,
            systemPrompt: this.skillCache.get(skillPath),
            skillProfile,
            expertProfile: resolveExpertProfile({
                domain,
                effortLevel: skillProfile?.effortLevel || 'standard',
                modelService,
            }),
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
    async executeWithStateMachine(prompt, userId, targetFile, io, socketId, requestId = null, effortLevel = 'standard', options = {}) {
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
                logger.info('Router', `Broadcasted staged file: ${entry.filePath}`);
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
            let subscription = null;
            const abortExecution = (reason = 'ORCHESTRATION_ABORTED') => {
                if (settled) return;
                settled = true;
                subscription?.unsubscribe?.();
                vfs.off('file_staged', onFileStaged);
                try {
                    agentService.stop();
                } catch {
                    // Best effort only; we still reject to unwind the caller.
                }
                reject(new Error(reason));
            };

            options.onAbortReady?.(abortExecution);
            subscription = agentService.subscribe({
              next: (state) => {
                logger.info('Agent', `transitioned to [${state.value}]`);
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
                        maxRetries: state.context.maxRetries,
                        effortLevel: state.context.effortLevel,
                        crossFileCoherenceEnabled: state.context.crossFileCoherenceEnabled,
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
                        effortLevel: state.context.effortLevel,
                        crossFileCoherenceEnabled: state.context.crossFileCoherenceEnabled,
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
                requestId,
                effortLevel
            });
        });
    }

    mapStateToMessage(stateValue) {
        const messages = {
            idle: "Waiting to start...",
            loading_contexts: "Locking organizational and user boundaries...",
            parsing_ast: "Building semantic code graph...",
            drafting_code: "Synthesizing logic with LLM...",
            sandboxing: "Executing in local Docker sandbox with network disabled...",
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

function validationDetails(error) {
    const issues = error?.issues || error?.errors || [];
    return issues.map(issue => ({
        field: Array.isArray(issue.path) ? issue.path.join('.') : '',
        message: issue.message
    }));
}

function publicErrorMessage(error) {
    if (process.env.NODE_ENV === 'production') return 'Internal server error';
    return error?.message || 'Internal server error';
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

    const { prompt, targetFile, socketId, effortLevel } = parsed.data;
    const userId = req.user?.id || parsed.data.userId;
    const io = req.app.get('io');
    const codeQueue = req.app.get('codeQueue');
    const retryState = getRetryState(userId);
    const allowHeadlessExecution = req.allowHeadlessExecution === true;

    if (retryState.count >= MAX_CONSECUTIVE_ROLLBACKS) {
        return res.status(429).json({
            success: false,
            error: 'Retry limit exceeded. Please adjust the prompt or wait.',
            retryAfterMs: RETRY_WINDOW_MS,
            requestId: req.id
        });
    }

    if (!socketId && !allowHeadlessExecution) {
        return res.status(400).json({ error: "socketId is required", requestId: req.id });
    }

    const runId = req.id || 'http-run-' + Math.random().toString(36).substring(2, 11);
    if (!acquireRun(userId, runId)) {
        res.setHeader('Retry-After', String(getConcurrencyRetryAfterSeconds()));
        return res.status(429).json({
            success: false,
            error: `Concurrency limit exceeded. A maximum of ${getRunConcurrencyLimit()} concurrent agent runs is permitted per user.`,
            requestId: req.id
        });
    }

    if (codeQueue) {
        try {
            const queued = await codeQueue.enqueue({
                prompt,
                userId,
                targetFile,
                socketId,
                requestId: runId,
                effortLevel,
                sessionId: req.sessionId || null,
                authMode: req.authMode || 'user-session'
            });
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
        } catch (enqueueError) {
            releaseRun(userId, runId);
            throw enqueueError;
        }
    }

    let abortRun = null;
    const sessionCleanup = req.sessionId ? (() => {
        if (io && socketId) {
            io.to(socketId).emit('agent_status', {
                status: 'reauth_required',
                message: 'Session fingerprint changed. Re-authentication is required and the current run has been terminated.',
                requestId: req.id,
                timestamp: new Date().toISOString()
            });
        }
        abortRun?.('ORCHESTRATION_ABORTED');
    }) : null;

    if (sessionCleanup) {
        registerSessionCleanup(req.sessionId, sessionCleanup);
    }

    try {
        const result = await router.executeWithStateMachine(
            prompt,
            userId,
            targetFile,
            io,
            socketId,
            req.id,
            effortLevel,
            {
                onAbortReady: (abortHandler) => {
                    abortRun = abortHandler;
                }
            }
        );
        resetRetryState(userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        if (error.message === 'ORCHESTRATION_ABORTED') {
            return res.status(401).json({
                success: false,
                error: 'Session fingerprint changed. Re-authentication is required.',
                code: 'SESSION_REAUTH_REQUIRED',
                requestId: req.id
            });
        }
        const rollbackState = recordRollback(userId);
        const config = await router.route(prompt);
        res.status(202).json({ success: false, error: error.message, rollbackCount: rollbackState.count, fallback: config });
    } finally {
        if (sessionCleanup) {
            unregisterSessionCleanup(req.sessionId, sessionCleanup);
        }
        releaseRun(userId, runId);
    }
}

async function handleCodeJobStatus(req, res) {
    const codeQueue = req.app.get('codeQueue');
    if (!codeQueue) return res.status(404).json({ success: false, error: 'Queue not enabled' });

    const job = await codeQueue.getStatus(req.params.jobId, req.user?.id);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.forbidden) return res.status(403).json({ success: false, error: 'You do not have access to this job.' });

    res.json({ success: true, job });
}

async function handleCommitRequest(req, res) {
    const parsed = req.validatedBody ? { success: true, data: req.validatedBody } : vfsCommitSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: validationDetails(parsed.error),
            requestId: req.id
        });
    }

    const { filePath, approved } = parsed.data;
    const authorization = authorizeVfsEntry(filePath, req.user?.id);
    if (!authorization.ok) return res.status(authorization.status).json({ success: false, error: authorization.error });

    try {
        if (!approved) {
            vfs.rejectFile(filePath, 'User rejected', { userId: req.user?.id });
            return res.json({ success: true, message: 'rejected', filePath });
        }
        await vfs.approveFile(filePath, { userId: req.user?.id });
        const entry = await vfs.commitToDisk(filePath, fs, { userId: req.user?.id });
        res.json({ success: true, message: 'committed', filePath: entry.filePath });
    } catch (error) {
        res.status(500).json({ success: false, error: publicErrorMessage(error) });
    }
}

async function handleGetPendingFiles(req, res) {
    try {
        const pending = typeof vfs.getPendingFilesForUser === 'function'
            ? vfs.getPendingFilesForUser(req.user?.id)
            : vfs.getPendingFiles({ userId: req.user?.id }).filter(e => String(e.metadata?.userId) === String(req.user?.id));
        res.json({ success: true, files: pending });
    } catch (error) {
        res.status(500).json({ success: false, error: publicErrorMessage(error) });
    }
}

async function handleGetVfsStats(req, res) {
    try {
        const stats = vfs.getStats({ userId: req.user?.id });
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: publicErrorMessage(error) });
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

async function handleMcpDiagnostics(req, res) {
    try {
        res.json({ success: true, diagnostics: mcpManager.diagnostics() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

async function handleCallTool(req, res) {
    try {
        const { toolId, arguments: rawArgs, actionGrant, runId } = req.body;
        if (!toolId) {
            res.status(400).json({ success: false, code: 'MCP_TOOL_ID_REQUIRED', error: 'toolId is required' });
            return;
        }
        const tool = mcpManager.tools.find(item => item.uniqueId === toolId) || mcpManager.localTools?.get?.(toolId);
        const llmToolName = toolId.replace(/:/g, '__');
        const policy = validateToolInvocationPolicy(llmToolName, rawArgs || {}, {
            toolDefinition: tool,
            user: req.user || null,
            tenantId: req.user?.tenantId || req.tenantId || null,
        });
        const args = policy.args;
        const paramsHash = hashToolParams(args || {});
        await authorizeToolCall(llmToolName, args || {}, {
            authSnapshot: req.user ? { type: 'user-session', userId: req.user.id, expiresAt: null } : null,
            toolDefinition: tool,
            paramsHash,
            approvalFn: async () => {
                if (!actionGrant || !runId) return false;
                return verifyActionGrant(actionGrant, {
                    userId: req.user.id,
                    runId,
                    toolName: toolId,
                    paramsHash,
                }).ok;
            },
        });
        try {
            const result = await mcpManager.callTool(toolId, args);
            recordToolExecutionOutcome(llmToolName, true);
            res.json({
                success: true,
                result,
                metadata: {
                    timeoutMs: policy.timeoutMs,
                    credentialScope: policy.credentialScope,
                },
            });
        } catch (error) {
            recordToolExecutionOutcome(llmToolName, false);
            throw error;
        }
    } catch (error) {
        if (error instanceof ToolExecutionPolicyError) {
            res.status(error.status || 400).json({ success: false, code: error.code, error: error.message });
            return;
        }
        if (error instanceof ToolAuthError) {
            res.status(403).json({ success: false, code: 'TOOL_AUTH_DENIED', error: error.message });
            return;
        }
        if (error instanceof ToolSchemaError) {
            res.status(400).json({
                success: false,
                code: 'TOOL_SCHEMA_INVALID',
                error: error.message,
                details: error.details || [],
            });
            return;
        }
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
    handleListTools, handleListServers, handleMcpDiagnostics, handleCallTool, handleRegisterServer 
};
