import { githubService } from '../github/index.js';

/**
 * ModelService — Phase 2
 * 
 * Orchestrates calls to free GitHub Models using GITHUB_TOKEN.
 */
export class ModelService {
  constructor() {
    this.endpoint = 'https://models.inference.ai.azure.com';
  }

  /**
   * Run a chat completion using a GitHub Model.
   * This allows Vibe Hub to perform "Heavy Brain" tasks for free.
   */
  async chat(installationId, { model = 'gpt-4o', messages, max_tokens = 2048 }) {
    // In a real scenario, installation client would provide the token
    const octokit = await githubService.getInstallationClient(installationId);
    
    // Retrieve the installation token
    const { token } = await octokit.auth({ type: 'installation' });

    const response = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`[GitHub Models] ${error.message || 'API Error'}`);
    }

    return await response.json();
  }
}

export const modelService = new ModelService();
