import { App } from 'octokit';

/**
 * GitHubService — Vibe Hub v3.1
 * 
 * Handles GitHub App authentication and repository interactions.
 */
export class GitHubService {
  constructor() {
    this.appId = process.env.GITHUB_APP_ID;
    this.privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (this.appId && this.privateKey) {
      this.app = new App({
        appId: this.appId,
        privateKey: this.privateKey,
        webhooks: {
          secret: this.webhookSecret
        },
      });
      console.log('[GitHub] App service initialized.');
    } else {
      console.warn('[GitHub] Missing credentials. GitHub integration disabled.');
    }
  }

  /**
   * Get an Octokit instance for a specific installation.
   */
  async getInstallationClient(installationId) {
    if (!this.app) throw new Error('GitHub App not initialized.');
    return await this.app.getInstallationOctokit(installationId);
  }

  /**
   * Post a comment on an issue or pull request.
   */
  async postComment(installationId, { owner, repo, issue_number, body }) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
  }

  /**
   * Create a new pull request.
   */
  async createPR(installationId, { owner, repo, title, body, head, base = 'main' }) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
  }

  /**
   * Create a Check Run to report build/test results.
   */
  async createCheckRun(installationId, { owner, repo, name, head_sha, status, conclusion, output }) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.checks.create({
      owner,
      repo,
      name,
      head_sha,
      status,
      conclusion,
      output,
    });
  }

  // === CODESPACES (Phase 2) ===

  /**
   * Create a new Codespace for a repository.
   */
  async createCodespace(installationId, { owner, repo, ref, machine_type_name }) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.codespaces.createWithRepoForAuthenticatedUser({
      owner,
      repo,
      ref,
      machine_type_name,
    });
  }

  /**
   * List available machine types for Codespaces.
   */
  async getMachineTypes(installationId, { owner, repo }) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.codespaces.repoMachinesForAuthenticatedUser({
      owner,
      repo,
    });
  }

  /**
   * Delete a Codespace.
   */
  async deleteCodespace(installationId, codespace_name) {
    const octokit = await this.getInstallationClient(installationId);
    return await octokit.rest.codespaces.deleteForAuthenticatedUser({
      codespace_name,
    });
  }
}

export const githubService = new GitHubService();
