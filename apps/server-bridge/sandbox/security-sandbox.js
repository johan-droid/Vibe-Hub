/**
 * security-sandbox.js — Vibe-Hub Code Execution Sandbox Controller
 * ─────────────────────────────────────────────────────────────────
 * Orchestrates Docker containers to execute untrusted LLM-generated
 * scripts in strict isolation.
 *
 * Architecture overview
 * ─────────────────────
 *   Agent → [this module] → docker run (one-shot) → stdout/stderr captured
 *                         → hard timeout kills container if hung
 *                         → streams piped to frontend Terminal.jsx via WS
 *
 * One-shot model (v2 redesign)
 * ────────────────────────────
 * The previous implementation used a long-running container and exec().
 * That model has two critical flaws for our use case:
 *
 *   1. exec() inside a running container inherits that container's PID
 *      namespace. A hung exec call cannot be killed without killing the
 *      entire container, which disrupts other exec calls in the same session.
 *
 *   2. Long-running containers leak CPU even when idle due to Docker's
 *      monitoring daemons — unacceptable on a shared Ryzen 5 5500U host.
 *
 * The new model: one container per script execution, started fresh,
 * captured to completion, then force-removed. This gives us:
 *   - Independent per-execution resource quotas
 *   - Atomic timeout enforcement via container.kill()
 *   - Zero idle CPU cost between executions
 *   - Clean stdout/stderr separation via Docker's multiplexed stream
 */

import Docker from 'dockerode';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { EventEmitter } from 'events';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SANDBOX_IMAGE = 'vibe-hub-sandbox:latest';

/**
 * RESOURCE LIMIT RATIONALE (Ryzen 5 5500U / 16 GB host)
 * ────────────────────────────────────────────────────────
 * The host runs: VS Code, Docker Desktop (WSL2), the Node server-bridge,
 * and a browser with the React IDE — easily 6–8 GB baseline.
 *
 * Memory: 256 MB is generous for running a Node test suite or a Python
 *   script. 512 MB (previous) could allow a single sandbox to trigger
 *   Windows memory compression thrashing under heavy swapping.
 *   MemorySwap == Memory → swap disabled entirely (no silent OOM hiding).
 *
 * CPU: 0.5 cores (NanoCpus = 500_000_000). Node.js is single-threaded;
 *   a script needing > 0.5 cores is likely in an infinite loop or doing
 *   something it shouldn't. This leaves ≥ 5.5 cores for the IDE.
 *
 * PIDs: 32. A Node.js process + mocha/jest worker pool needs ~10–15 PIDs.
 *   Capping at 32 prevents fork-bomb escalation while allowing real tests.
 *
 * Timeout: 10 000 ms default. LLM-generated tests should complete in < 5s.
 *   We give 10s to tolerate slow cold imports. Caller can override down to
 *   5 000 ms for simple scripts.
 */
const LIMITS = {
  Memory:      256 * 1024 * 1024,    // 256 MB hard cap
  MemorySwap:  256 * 1024 * 1024,    // Equal → swap disabled
  NanoCpus:    500_000_000,           // 0.5 CPU cores
  PidsLimit:   32,                    // Fork-bomb prevention
  DEFAULT_TIMEOUT_MS: 10_000,        // 10 s execution timeout
};

// Docker socket path. Under Docker Desktop / WSL2, the default socket works.
const docker = new Docker({ socketPath: process.platform === 'win32'
  ? '//./pipe/docker_engine'
  : '/var/run/docker.sock',
});

// ─── Image readiness ───────────────────────────────────────────────────────────

let _imageVerified = false; // module-level singleton flag

/**
 * Verify the sandbox image exists exactly once per process lifetime.
 * Throws a descriptive error if not found so the startup log is clear.
 */
async function ensureSandboxImage() {
  if (_imageVerified) return;
  try {
    const images = await docker.listImages({
      filters: { reference: [SANDBOX_IMAGE] },
    });
    if (images.length === 0) {
      throw new Error(
        `[Sandbox] Image "${SANDBOX_IMAGE}" not found. ` +
        `Run: docker build -t ${SANDBOX_IMAGE} -f Dockerfile.security .`
      );
    }
    _imageVerified = true;
    console.log(`[Sandbox] Image verified: ${SANDBOX_IMAGE}`);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
      throw new Error('[Sandbox] Docker daemon unreachable. Is Docker Desktop running?');
    }
    throw err;
  }
}

// ─── Stream demultiplexer ──────────────────────────────────────────────────────

/**
 * Docker's attach/log streams multiplex stdout and stderr into a single TCP
 * stream using an 8-byte framing header:
 *
 *   [stream_type: 1 byte] [0x00 0x00 0x00: 3 bytes] [size: 4 bytes BE] [payload]
 *
 *   stream_type: 1 = stdout, 2 = stderr
 *
 * The previous implementation used `chunk.toString()` directly on the raw
 * multiplexed stream, which produces garbled output with binary framing bytes
 * mixed into the log text. This function correctly demultiplexes the frames.
 *
 * @param {Buffer} buffer - Raw multiplexed buffer from Docker
 * @returns {{ stdout: string, stderr: string }}
 */
function demuxDockerStream(buffer) {
  let stdout = '';
  let stderr = '';
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least 8 bytes for the header
    if (offset + 8 > buffer.length) break;

    const streamType = buffer[offset];          // 1=stdout, 2=stderr
    const payloadSize = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + payloadSize > buffer.length) break;

    const payload = buffer.slice(offset, offset + payloadSize).toString('utf8');
    offset += payloadSize;

    if (streamType === 1) stdout += payload;
    else if (streamType === 2) stderr += payload;
    // streamType === 3 is stdin echo; we ignore it
  }

  return { stdout, stderr };
}

// ─── Streaming helper ─────────────────────────────────────────────────────────

/**
 * Collect a Docker stream into a Buffer.
 * Resolves with the full accumulated buffer when the stream ends.
 */
function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end',  () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// ─── ExecutionResult type ─────────────────────────────────────────────────────

/**
 * @typedef {Object} ExecutionResult
 * @property {boolean} success     - true if exit code was 0
 * @property {number}  exitCode    - container process exit code
 * @property {string}  stdout      - captured standard output
 * @property {string}  stderr      - captured standard error
 * @property {boolean} timedOut    - true if killed by timeout watchdog
 * @property {number}  durationMs  - wall-clock execution time
 * @property {string}  containerId - short Docker container ID (for audit logs)
 */

// ─── Main service ─────────────────────────────────────────────────────────────

export class SecuritySandboxService extends EventEmitter {
  constructor() {
    super();
    // Active container map: executionId → Docker container object
    // Kept for emergency cleanup on process exit (see shutdown handler below).
    this._active = new Map();
  }

  /**
   * Execute a script file inside an isolated, resource-limited container.
   *
   * @param {Object}  opts
   * @param {string}  opts.workspacePath  - Absolute host path to mount read-only
   * @param {string}  opts.scriptPath     - Path *inside* the container to execute
   *                                        (relative to /workspace, e.g. "test/run.js")
   * @param {string}  [opts.runtime]      - "node" (default) | "sh" | "python3"
   * @param {number}  [opts.timeoutMs]    - Override default timeout (max 60 000)
   * @param {Function}[opts.onChunk]      - Optional streaming callback(chunk: string)
   *                                        called as stdout/stderr bytes arrive
   * @returns {Promise<ExecutionResult>}
   */
  async execute({
    workspacePath,
    scriptPath,
    runtime = 'node',
    timeoutMs = LIMITS.DEFAULT_TIMEOUT_MS,
    onChunk,
  }) {
    // ── Validate inputs ────────────────────────────────────────────────────
    if (!workspacePath || !scriptPath) {
      throw new Error('[Sandbox] workspacePath and scriptPath are required.');
    }

    // Clamp timeout: minimum 1 s, maximum 60 s.
    // This prevents the caller from setting 0 (instant kill) or 3 600 000
    // (accidental hour-long hang that starves the Ryzen host).
    const clampedTimeout = Math.max(1_000, Math.min(60_000, timeoutMs));

    // Whitelist runtime interpreters. Never pass the runtime string directly
    // to the shell — it must match this list to prevent command injection.
    const ALLOWED_RUNTIMES = new Set(['node', 'sh', 'python3', 'bun']);
    if (!ALLOWED_RUNTIMES.has(runtime)) {
      throw new Error(`[Sandbox] Runtime "${runtime}" is not permitted.`);
    }

    // Ensure no path traversal in scriptPath (e.g. "../../etc/passwd")
    const normalised = path.posix.normalize(scriptPath);
    if (normalised.startsWith('..') || path.isAbsolute(normalised)) {
      throw new Error(`[Sandbox] scriptPath must be relative and non-traversal. Got: "${scriptPath}"`);
    }

    await ensureSandboxImage();

    const executionId = uuid();
    const startTime   = Date.now();
    let container     = null;
    let timedOut      = false;
    let watchdog      = null;

    try {
      // ── Create container (not started yet) ──────────────────────────────
      container = await docker.createContainer({
        name: `vibe-sandbox-${executionId.slice(0, 8)}`,
        Image: SANDBOX_IMAGE,

        // Command: [runtime, scriptPath]
        // We pass args as an array — never interpolated into a shell string —
        // to prevent command injection if scriptPath contains shell metacharacters.
        Cmd: [runtime, `/workspace/${normalised}`],

        // Attach streams for capture
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin:  false,  // No stdin — untrusted code cannot read from it

        // No interactive TTY: ensures Docker uses the multiplexed framing
        // protocol that demuxDockerStream() expects.
        Tty: false,

        // Block root privilege escalation inside the container via setuid bins.
        // Combined with USER sandbox in the Dockerfile, this is defence-in-depth.
        User: 'sandbox',

        HostConfig: {
          // ── Filesystem ────────────────────────────────────────────────
          //   Workspace bind-mounted read-only: the LLM can read all project
          //   files but cannot write them directly. Any file creation must go
          //   through the VFS tools exposed by the MCP server.
          Binds: [`${path.resolve(workspacePath)}:/workspace:ro,Z`],

          //   Root filesystem is read-only. The container image itself cannot
          //   be mutated at runtime (prevents in-container package installs).
          ReadonlyRootfs: true,

          //   tmpfs mounts provide the ONLY writable surfaces:
          //     /tmp      — scratch space for the script (100 MB, no exec bit)
          //     /tmp/node — npm's temp dir when importing packages (25 MB)
          //   `noexec` prevents the LLM from writing and executing a binary blob.
          //   `nosuid`  prevents privilege escalation via setuid binaries in tmp.
          Tmpfs: {
            '/tmp':           'rw,noexec,nosuid,size=100m',
            '/home/sandbox':  'rw,noexec,nosuid,size=10m',
          },

          // ── Network ───────────────────────────────────────────────────
          //   None. The container has no NIC. It cannot:
          //     • Phone home (data exfiltration)
          //     • Download additional payloads
          //     • Make unauthorised API calls (even with a stolen key)
          //     • Perform lateral movement inside the host's Docker network
          NetworkMode: 'none',

          // ── Resources ─────────────────────────────────────────────────
          Memory:     LIMITS.Memory,       // 256 MB hard cap (see LIMITS note)
          MemorySwap: LIMITS.MemorySwap,   // Swap disabled — same value as Memory
          NanoCpus:   LIMITS.NanoCpus,     // 0.5 cores
          PidsLimit:  LIMITS.PidsLimit,    // 32 pids — fork-bomb protection

          // ── Kernel capabilities ───────────────────────────────────────
          //   Drop ALL Linux capabilities. Node.js test runners need zero
          //   privileged caps (no raw sockets, no mount, no ptrace etc.).
          //   CapAdd is left empty — we never re-add any.
          CapDrop: ['ALL'],

          // ── Security options ──────────────────────────────────────────
          //   no-new-privileges: child processes cannot gain more privileges
          //   than the parent via setuid/setgid binaries or Linux capabilities.
          SecurityOpt: ['no-new-privileges:true'],

          // ── Auto-remove ───────────────────────────────────────────────
          //   Container is deleted automatically when it exits.
          //   This prevents container accumulation if our cleanup code is
          //   skipped (e.g. a process crash between kill and remove).
          AutoRemove: true,

          // ── Logging ───────────────────────────────────────────────────
          //   json-file with a 1 MB cap. Prevents disk exhaustion from a
          //   script that `console.log`s millions of lines.
          LogConfig: {
            Type: 'json-file',
            Config: { 'max-size': '1m', 'max-file': '1' },
          },
        },
      });

      this._active.set(executionId, container);

      // ── Attach streams BEFORE starting ────────────────────────────────
      // Attaching after start() creates a race condition where early output
      // lines are lost before the stream listener is registered.
      const attachStream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true,
        logs:   false, // historical logs only needed after detach; we capture live
      });

      // ── Start container ───────────────────────────────────────────────
      await container.start();
      this.emit('execution:start', { executionId, scriptPath, runtime });

      // ── Timeout watchdog ──────────────────────────────────────────────
      // If the script exceeds clampedTimeout ms, we issue SIGKILL.
      // container.kill() sends SIGKILL by default — instant, no grace period.
      // We do NOT use SIGTERM first because an LLM-generated infinite loop
      // will ignore SIGTERM just as readily as it ignores real termination.
      watchdog = setTimeout(async () => {
        timedOut = true;
        console.warn(`[Sandbox] Timeout! Killing container ${executionId.slice(0, 8)} after ${clampedTimeout}ms`);
        try {
          await container.kill({ Signal: 'SIGKILL' });
        } catch {
          // Container may have already exited — safe to ignore
        }
      }, clampedTimeout);

      // ── Collect output ────────────────────────────────────────────────
      // If caller provided onChunk(), we stream raw bytes as they arrive
      // for live terminal updates. We also accumulate the full buffer for
      // the final demux + return value.
      const rawChunks = [];

      attachStream.on('data', (chunk) => {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        rawChunks.push(buf);

        // Optional live streaming to frontend Terminal.jsx via the
        // WebSocket `appendTerminalOutput` path. We strip the 8-byte
        // Docker frame header before forwarding to keep the terminal clean.
        if (onChunk) {
          try {
            const { stdout, stderr } = demuxDockerStream(buf);
            if (stdout) onChunk(stdout);
            if (stderr) onChunk(`\x1b[31m${stderr}\x1b[0m`); // red for stderr
          } catch {
            // Partial frame — skip, will be handled in full-buffer demux
          }
        }
      });

      // Wait for stream to close (container has exited)
      await collectStream(attachStream);

      // ── Wait for exit code ────────────────────────────────────────────
      // container.wait() returns { StatusCode: N }
      // Note: AutoRemove means the container is gone by the time wait()
      // resolves. We must capture the status before it disappears.
      // dockerode handles this correctly — wait() resolves with the exit code
      // even after the container is removed.
      let exitCode = 0;
      try {
        const waitResult = await container.wait();
        // BUG #11 FIX: With AutoRemove:true, the container is deleted immediately
        // on exit. If our collectStream() drain overlaps with the removal,
        // dockerode may return { StatusCode: null }. The previous code used
        // `?? 0` which silently reported success (exitCode 0) for any race.
        // Now we treat null as exit-1 (generic error) unless we know it was
        // a SIGKILL timeout.
        if (typeof waitResult.StatusCode === 'number') {
          exitCode = waitResult.StatusCode;
        } else {
          exitCode = timedOut ? 137 : 1;
        }
      } catch (err) {
        if (timedOut) {
          exitCode = 137; // SIGKILL
        } else {
          // Container already removed by AutoRemove before wait() resolved.
          // This is a benign race — log it and treat as generic failure.
          console.warn(`[Sandbox] container.wait() AutoRemove race: ${err.message}`);
          exitCode = 1;
        }
      }

      clearTimeout(watchdog);
      watchdog = null;

      // ── Demux the full accumulated buffer ─────────────────────────────
      const rawBuffer = Buffer.concat(rawChunks);
      const { stdout, stderr } = demuxDockerStream(rawBuffer);

      const durationMs = Date.now() - startTime;
      const result = {
        success:     !timedOut && exitCode === 0,
        exitCode:    timedOut ? 137 : exitCode,
        stdout:      stdout.trim(),
        stderr:      stderr.trim(),
        timedOut,
        durationMs,
        containerId: executionId.slice(0, 8),
      };

      this.emit('execution:complete', result);
      console.log(
        `[Sandbox] ${executionId.slice(0, 8)} exited ${exitCode} in ${durationMs}ms` +
        (timedOut ? ' [KILLED: TIMEOUT]' : '')
      );

      return result;

    } catch (err) {
      clearTimeout(watchdog);

      // Best-effort cleanup if AutoRemove didn't fire (e.g. create succeeded
      // but start failed — container stays in "created" state indefinitely).
      if (container) {
        try {
          await container.remove({ force: true });
        } catch { /* already removed */ }
      }

      throw new Error(`[Sandbox] Execution failed: ${err.message}`);

    } finally {
      if (container) this._active.delete(executionId);
    }
  }

  /**
   * Emergency drain: kill all active containers.
   * Called by the process SIGTERM handler to prevent orphaned containers
   * persisting in Docker after the server-bridge process exits.
   */
  async shutdown() {
    const ids = [...this._active.keys()];
    if (ids.length === 0) return;
    console.log(`[Sandbox] Shutdown: killing ${ids.length} active container(s)...`);
    await Promise.allSettled(
      [...this._active.values()].map((c) => c.kill({ Signal: 'SIGKILL' }).catch(() => {}))
    );
    this._active.clear();
  }
}

// ─── Singleton export ──────────────────────────────────────────────────────────

export const securitySandboxService = new SecuritySandboxService();

// ─── Process-level safety net ──────────────────────────────────────────────────
// Register shutdown drainer once. This ensures no orphaned sandbox containers
// linger in Docker Desktop after a server crash or Ctrl-C.
process.once('SIGTERM', () => securitySandboxService.shutdown().then(() => process.exit(0)));
process.once('SIGINT',  () => securitySandboxService.shutdown().then(() => process.exit(0)));
