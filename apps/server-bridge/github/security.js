import { githubService } from './index.js';

/**
 * In-Memory Token Vault - Phase 4
 * 
 * Security best practices:
 * - Tokens NEVER written to disk
 * - Stored only in volatile memory (Map)
 * - Automatic expiration
 * - Encrypted at rest (when DB storage is needed)
 */
class TokenVault {
  constructor() {
    this.tokens = new Map(); // tokenKey -> { token, expiresAt, metadata }
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000); // Cleanup every minute
    this.cleanupInterval.unref(); // Don't block process exit
  }

  /**
   * Store a token in volatile memory only
   */
  set(key, token, options = {}) {
    const { expiresInMs = 3600000, metadata = {} } = options; // Default 1 hour
    
    this.tokens.set(key, {
      token,
      expiresAt: Date.now() + expiresInMs,
      createdAt: Date.now(),
      metadata,
    });

    console.log(`[TokenVault] Stored token for key: ${key} (expires in ${expiresInMs / 1000}s)`);
  }

  /**
   * Retrieve a token if it exists and hasn't expired
   */
  get(key) {
    const entry = this.tokens.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.tokens.delete(key);
      console.log(`[TokenVault] Token expired for key: ${key}`);
      return null;
    }

    return entry.token;
  }

  /**
   * Delete a token immediately
   */
  delete(key) {
    const existed = this.tokens.has(key);
    this.tokens.delete(key);
    if (existed) {
      console.log(`[TokenVault] Deleted token for key: ${key}`);
    }
    return existed;
  }

  /**
   * Check if a token exists and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Get token metadata without exposing the token itself
   */
  getMetadata(key) {
    const entry = this.tokens.get(key);
    if (!entry) return null;

    return {
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      ...entry.metadata,
    };
  }

  /**
   * Cleanup expired tokens
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.tokens.entries()) {
      if (now > entry.expiresAt) {
        this.tokens.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TokenVault] Cleaned up ${cleaned} expired tokens`);
    }
  }

  /**
   * Get statistics (for monitoring)
   */
  getStats() {
    const now = Date.now();
    let active = 0;
    let expiringSoon = 0;

    for (const entry of this.tokens.values()) {
      if (now <= entry.expiresAt) {
        active++;
        if (entry.expiresAt - now < 300000) { // Expiring in 5 minutes
          expiringSoon++;
        }
      }
    }

    return {
      total: this.tokens.size,
      active,
      expiringSoon,
    };
  }

  /**
   * Clear all tokens (for shutdown or security incident)
   */
  clear() {
    const count = this.tokens.size;
    this.tokens.clear();
    console.log(`[TokenVault] Cleared all ${count} tokens`);
  }
}

// Global singleton instance
export const tokenVault = new TokenVault();

/**
 * SecuritySandboxService — Phase 4 (GitHub Codespaces Integration)
 * 
 * Uses in-memory token vault for secure token handling.
 */
export class SecuritySandboxService {
  constructor() {
    this.activeSandboxes = new Map();
  }

  /**
   * Create a fresh security sandbox.
   * Tokens are stored in memory-only vault, never written to disk.
   */
  async create(installationId, { owner, repo, ref, profile = 'standard' }) {
    console.log(`[Security] Provisioning ${profile} sandbox for ${owner}/${repo}...`);
    
    try {
      // Get GitHub token and store in memory vault
      const octokit = await githubService.getInstallationClient(installationId);
      const { token } = await octokit.auth({ type: 'installation' });
      
      // Store token in volatile memory with short expiration
      const tokenKey = `sandbox_${installationId}_${Date.now()}`;
      tokenVault.set(tokenKey, token, { expiresInMs: 1800000 }); // 30 minutes
      
      // In a real implementation, this would call a specific 'security' template
      const sandbox = await githubService.createCodespace(installationId, { owner, repo, ref });
      
      const id = sandbox.id || `sec-${Math.random().toString(36).slice(2)}`;
      this.activeSandboxes.set(id, { 
        ...sandbox, 
        profile,
        tokenKey, // Reference to in-memory token (not the token itself)
        installationId,
      });
      
      return { id, status: 'provisioning', profile };
    } catch (error) {
      console.error('[Security] Failed to provision sandbox:', error.message);
      throw error;
    }
  }

  /**
   * Execute a security command in the sandbox.
   * Retrieves token from memory vault for each operation.
   */
  async exec(id, command) {
    const sandbox = this.activeSandboxes.get(id);
    if (!sandbox) {
      throw new Error('Sandbox not found or already destroyed.');
    }
    
    console.log(`[Security] Executing in ${id}: ${command}`);
    
    // Retrieve token from memory vault for this operation
    const token = tokenVault.get(sandbox.tokenKey);
    if (!token) {
      throw new Error('Sandbox token expired or invalid. Please recreate the sandbox.');
    }
    
    // Simulate tool output for demonstration
    // In production, this would use the token to authenticate with GitHub APIs
    if (command.includes('semgrep')) {
      return {
        stdout: JSON.stringify([
          { check_id: 'js.lang.security.audit.sqli', path: 'db.js', line: 42, extra: { message: 'Potential SQL injection point' } }
        ]),
        stderr: ''
      };
    }
    
    if (command.includes('npm audit')) {
      return {
        stdout: 'Found 3 vulnerabilities (2 moderate, 1 high)',
        stderr: ''
      };
    }

    return { stdout: `Command executed: ${command}`, stderr: '' };
  }

  /**
   * Destroy sandbox and securely clean up tokens.
   */
  async destroy(id) {
    const sandbox = this.activeSandboxes.get(id);
    if (!sandbox) {
      return { status: 'not_found' };
    }
    
    // Securely delete the token from memory vault
    if (sandbox.tokenKey) {
      tokenVault.delete(sandbox.tokenKey);
    }
    
    this.activeSandboxes.delete(id);
    console.log(`[Security] Destroyed sandbox ${id} and cleaned up tokens`);
    
    return { status: 'destroyed' };
  }

  /**
   * Get active sandbox count (for monitoring)
   */
  getActiveCount() {
    return this.activeSandboxes.size;
  }
}

export const securitySandboxService = new SecuritySandboxService();
