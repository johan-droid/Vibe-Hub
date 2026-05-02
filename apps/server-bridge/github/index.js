/**
 * github/index.js — Vibe-Hub GitHub Operations Module v4.0
 * ──────────────────────────────────────────────────────────
 * Provides the agent swarm with safe, collaborative Git/GitHub operations.
 *
 * Design Decisions
 * ────────────────
 * 1. DUAL AUTH STRATEGY
 *    The module supports both GitHub App auth (for org/repo installations)
 *    and Personal Access Token (PAT) auth (for personal repos / dev mode).
 *    The token is NEVER logged, stored in env dump outputs, or written to
 *    disk. It lives exclusively as a private class field (#token) for its
 *    entire lifetime, then is garbage-collected when the Octokit instance
 *    goes out of scope.
 *
 * 2. CONFLICT-SAFE PULL STRATEGY
 *    Before fetching upstream, we use the GitHub Commits API to compare
 *    the agent's working branch HEAD against the upstream base. If the
 *    merge base has diverged (i.e., upstream has commits the branch hasn't
 *    seen), we surface a structured ConflictRisk object instead of merging
 *    blindly. The orchestrator then asks the user to resolve before
 *    continuing. This prevents the agent from producing broken merges.
 *
 * 3. AGENT BRANCHING CONVENTION
 *    All agent-created branches follow: `vibe/<timestamp>/<slug>`.
 *    This namespace prevents collisions with human branches and makes
 *    automated cleanup easy (delete all `vibe/*` branches older than N days).
 */

import { App, Octokit } from 'octokit';

// ─── Token safety ─────────────────────────────────────────────────────────────
// Wrap any Octokit call so auth tokens are scrubbed from error messages before
// they propagate to logs or the WebSocket response.
function scrubToken(token, message) {
  if (!token || !message) return message;
  // Replace the raw token string wherever it appears (e.g., in URL traces)
  return message.replaceAll(token, '[REDACTED]');
}

// ─── ConflictRisk type ────────────────────────────────────────────────────────
/**
 * @typedef {Object} ConflictRisk
 * @property {boolean} hasRisk              - true when upstream has diverged
 * @property {number}  aheadBy              - commits the agent branch is ahead
 * @property {number}  behindBy             - commits the agent branch is behind upstream
 * @property {string[]} conflictingFiles    - files changed in both branches (potential conflicts)
 * @property {string}  recommendation       - human-readable action for the user
 */

// ─── GitHubService ────────────────────────────────────────────────────────────
export class GitHubService {
  // Private class field — inaccessible from outside, never serialised by
  // JSON.stringify, never surfaced in console.log(this).
  #pat = null;

  constructor() {
    this.appId         = process.env.GITHUB_APP_ID;
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

    // GitHub App path — used in production with org installations.
    // The private key is kept as a class property (not #private) because
    // it is a PEM certificate, not an access token. It's still never logged.
    const rawKey = process.env.GITHUB_PRIVATE_KEY;
    this.privateKey = rawKey?.replace(/\\n/g, '\n') ?? null;

    if (this.appId && this.privateKey) {
      this.app = new App({
        appId:    this.appId,
        privateKey: this.privateKey,
        webhooks: { secret: this.webhookSecret ?? '' },
      });
      console.log('[GitHub] App authentication initialised.');
    } else {
      this.app = null;
      console.warn('[GitHub] No App credentials — will use PAT mode if provided at runtime.');
    }
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────

  /**
   * Return an Octokit instance authenticated via GitHub App installation token.
   * Installation tokens are short-lived (~1 h) and scoped to a single repo.
   */
  async #getAppClient(installationId) {
    if (!this.app) throw new Error('[GitHub] App not initialised. Check GITHUB_APP_ID and GITHUB_PRIVATE_KEY.');
    return this.app.getInstallationOctokit(installationId);
  }

  /**
   * Return an Octokit instance authenticated via a PAT.
   * The token is stored only in the private #pat field; it is NEVER forwarded
   * to any external logger or passed as a plain string to anything other than
   * the Octokit constructor's auth option.
   *
   * @param {string} token - GitHub Personal Access Token
   */
  #getPATClient(token) {
    this.#pat = token; // held only for scrubToken()
    return new Octokit({ auth: token });
  }

  /**
   * Resolve an Octokit client from either an installationId or a PAT.
   * Always prefer App auth if installationId is present.
   */
  async #client({ installationId, token }) {
    if (installationId) return this.#getAppClient(installationId);
    if (token)          return this.#getPATClient(token);
    throw new Error('[GitHub] Provide either installationId (App) or token (PAT) for authentication.');
  }

  // ── Branch management ─────────────────────────────────────────────────────

  /**
   * Create an isolated agent working branch.
   *
   * Convention: `vibe/<unix-timestamp>/<slug>`
   *   • The timestamp allows easy cleanup of stale agent branches.
   *   • The slug is derived from the task description, capped at 40 chars.
   *
   * @returns {{ branchName: string, sha: string }} — the new branch ref data
   */
  async createAgentBranch({ owner, repo, base = 'main', taskSlug = 'task', installationId, token }) {
    const octokit = await this.#client({ installationId, token });

    // Fetch the SHA of the base branch tip
    const { data: ref } = await octokit.rest.git.getRef({
      owner, repo,
      ref: `heads/${base}`,
    });

    const baseSha = ref.object.sha;
    const safeslug = taskSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 40)
      .replace(/-+$/, '');

    const branchName = `vibe/${Date.now()}/${safeslug}`;

    await octokit.rest.git.createRef({
      owner, repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    console.log(`[GitHub] Agent branch created: ${branchName} (from ${base}@${baseSha.slice(0, 7)})`);
    return { branchName, sha: baseSha };
  }

  // ── Conflict detection ────────────────────────────────────────────────────

  /**
   * Compare the agent's branch against the upstream base and surface any
   * divergence risk BEFORE the agent commits or raises a PR.
   *
   * This uses GitHub's Compare API which returns:
   *   - ahead_by:  commits the branch has that base doesn't (agent's work)
   *   - behind_by: commits the base has that branch doesn't (new upstream work)
   *   - files:     files changed on each side
   *
   * If behind_by > 0, the branch needs rebasing. We detect file-level
   * conflicts by intersecting the changed-files sets on both sides.
   *
   * @returns {ConflictRisk}
   */
  async detectConflictRisk({ owner, repo, agentBranch, baseBranch = 'main', installationId, token }) {
    const octokit = await this.#client({ installationId, token });

    // Compare: base...head (commits in head not yet in base = agent's ahead commits)
    const { data: fwdCompare } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner, repo,
      basehead: `${baseBranch}...${agentBranch}`,
    });

    // Compare: head...base (commits in base not yet in head = upstream ahead commits)
    const { data: revCompare } = await octokit.rest.repos.compareCommitsWithBasehead({
      owner, repo,
      basehead: `${agentBranch}...${baseBranch}`,
    });

    const aheadBy  = fwdCompare.ahead_by  ?? 0;
    const behindBy = revCompare.ahead_by  ?? 0; // ahead_by in reverse = behind in forward

    if (behindBy === 0) {
      // Branch is fully up to date with upstream — safe to proceed
      return {
        hasRisk: false,
        aheadBy,
        behindBy: 0,
        conflictingFiles: [],
        recommendation: 'Branch is up to date. Safe to open PR.',
      };
    }

    // Find files changed on both the agent branch AND in new upstream commits.
    // These are candidates for merge conflicts.
    const agentFiles    = new Set((fwdCompare.files ?? []).map(f => f.filename));
    const upstreamFiles = new Set((revCompare.files ?? []).map(f => f.filename));
    const conflictingFiles = [...agentFiles].filter(f => upstreamFiles.has(f));

    const recommendation = conflictingFiles.length > 0
      ? `⚠️ Upstream has ${behindBy} new commit(s) that touch ${conflictingFiles.length} file(s) also modified by the agent. ` +
        `Manual conflict resolution required before merging: ${conflictingFiles.slice(0, 5).join(', ')}` +
        (conflictingFiles.length > 5 ? ` …and ${conflictingFiles.length - 5} more.` : '')
      : `Upstream is ${behindBy} commit(s) ahead but no file overlaps found. A clean rebase is likely possible.`;

    console.log(`[GitHub] Conflict detection: behind=${behindBy}, overlapping files=${conflictingFiles.length}`);

    return {
      hasRisk: true,
      aheadBy,
      behindBy,
      conflictingFiles,
      recommendation,
    };
  }

  /**
   * Fetch the latest commit SHAs from the base branch.
   * Used by the agent to verify its branch is in sync before pushing.
   *
   * @returns {{ sha: string, message: string, author: string, date: string }[]}
   */
  async fetchUpstreamCommits({ owner, repo, branch = 'main', limit = 10, installationId, token }) {
    const octokit = await this.#client({ installationId, token });

    const { data } = await octokit.rest.repos.listCommits({
      owner, repo,
      sha: branch,
      per_page: limit,
    });

    return data.map(c => ({
      sha:     c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0], // first line only
      author:  c.commit.author?.name ?? 'unknown',
      date:    c.commit.author?.date,
    }));
  }

  // ── PR lifecycle ──────────────────────────────────────────────────────────

  /**
   * Open a Pull Request. Runs conflict detection first and refuses if
   * behind_by > 0 and conflicting files exist — the agent must never
   * silently create a broken PR.
   *
   * @returns {{ url: string, number: number } | { blocked: true, risk: ConflictRisk }}
   */
  async createPR({ owner, repo, title, body, head, base = 'main', installationId, token, skipConflictCheck = false }) {
    if (!skipConflictCheck) {
      const risk = await this.detectConflictRisk({
        owner, repo,
        agentBranch: head,
        baseBranch:  base,
        installationId,
        token,
      });

      if (risk.hasRisk && risk.conflictingFiles.length > 0) {
        console.warn(`[GitHub] PR blocked: conflict risk detected on ${head} → ${base}`);
        // Return a structured block — the orchestrator will surface this
        // to the user as a clarification request.
        return { blocked: true, risk };
      }
    }

    const octokit = await this.#client({ installationId, token });

    try {
      const { data } = await octokit.rest.pulls.create({
        owner, repo, title, body, head, base,
      });

      console.log(`[GitHub] PR #${data.number} created: ${data.html_url}`);
      return { url: data.html_url, number: data.number };
    } catch (err) {
      // Scrub any token that may appear in an Octokit error URL
      throw new Error(scrubToken(this.#pat, err.message));
    }
  }

  // ── Comments & Checks ─────────────────────────────────────────────────────

  /**
   * Post a comment on an issue or PR.
   */
  async postComment({ owner, repo, issue_number, body, installationId, token }) {
    const octokit = await this.#client({ installationId, token });
    const { data } = await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
    return { id: data.id, url: data.html_url };
  }

  /**
   * Create or update a GitHub Check Run (CI status badge).
   * Used by the agent to report sandbox execution results directly on the PR.
   */
  async createCheckRun({ owner, repo, name, head_sha, status, conclusion, output, installationId, token }) {
    const octokit = await this.#client({ installationId, token });
    const { data } = await octokit.rest.checks.create({
      owner, repo, name, head_sha, status, conclusion, output,
    });
    return { id: data.id, url: data.html_url };
  }

  // ── Codespaces ────────────────────────────────────────────────────────────

  async createCodespace({ owner, repo, ref, machine_type_name, installationId, token }) {
    const octokit = await this.#client({ installationId, token });
    const { data } = await octokit.rest.codespaces.createWithRepoForAuthenticatedUser({
      owner, repo, ref, machine_type_name,
    });
    return { name: data.name, state: data.state, url: data.web_url };
  }

  // ── Webhook verification ──────────────────────────────────────────────────

  /**
   * Verify GitHub's HMAC-SHA256 webhook signature.
   * Must be called on every incoming webhook to prevent spoofed payloads.
   * Returns true if valid, false otherwise. NEVER throws — let the caller
   * decide whether to 403 or silently drop.
   */
  async verifyWebhookSignature(rawBody, signatureHeader) {
    try {
      const { createHmac, timingSafeEqual } = await import('crypto');
      if (!this.webhookSecret || !signatureHeader) return false;

      const sig = Buffer.from(signatureHeader.replace('sha256=', ''), 'hex');
      const expected = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest();

      // timingSafeEqual prevents timing attacks against the signature comparison
      return sig.length === expected.length && timingSafeEqual(sig, expected);
    } catch {
      return false;
    }
  }
}

export const githubService = new GitHubService();
