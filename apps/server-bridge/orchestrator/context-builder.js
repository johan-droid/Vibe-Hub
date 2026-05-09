/**
 * Context Builder V6 — Strict Architectural Isolation
 * ==================================================
 *
 * Separates organizational constraints (MUST follow) from user preferences (flexible).
 * Prevents bleeding of user aesthetic choices into organizational security middleware.
 *
 * Hierarchy:
 *   1. ORGANIZATIONAL CONSTRAINTS (immutable, highest priority)
 *   2. USER PREFERENCES (flexible, lower priority)
 *   3. Language restricted to: English, Hindi, Odia only
 */

import pool from '../db.js';

// ─── Strict Language Enforcement ─────────────────────────────────────────────

export const ALLOWED_LANGUAGES = Object.freeze(['en', 'hi', 'or']);

export class LanguageEnforcer {
  /**
   * Validates and enforces language restriction.
   * Returns validated language code or defaults to 'en'.
   */
  static validateLanguage(requestedLang) {
    const normalized = (requestedLang || 'en').toLowerCase().trim();
    if (ALLOWED_LANGUAGES.includes(normalized)) {
      return normalized;
    }
    // Strict: refuse other languages, default to English
    return 'en';
  }

  /**
   * Returns system prompt fragment enforcing language policy.
   */
  static getLanguagePrompt(userLang = 'en') {
    const validated = this.validateLanguage(userLang);
    const langNames = { en: 'English', hi: 'Hindi', or: 'Odia' };
    
    return `=== LANGUAGE POLICY ===
You MUST respond in ${langNames[validated]} only. 
Supported languages: English (en), Hindi (hi), Odia (or).
Current user preference: ${langNames[validated]}.

If user input is in another language, acknowledge it but respond in ${langNames[validated]}.
`;
  }
}

// ─── Organization Constraints Loader ─────────────────────────────────────────

export class OrgConstraintsLoader {
  /**
   * Load all organizational constraints for a project.
   * These are rigid rules that MUST be followed (CI/CD, lint, security, deployment).
   */
  static async load(projectName) {
    try {
      const result = await pool.query(
        `SELECT constraint_type, content, priority
         FROM org_constraints
         WHERE project_name = $1 AND is_active = true
         ORDER BY priority DESC`,
        [projectName]
      );

      return result.rows.map(row => ({
        type: row.constraint_type,
        content: row.content,
        priority: row.priority
      }));
    } catch (err) {
      return [];
    }
  }

  /**
   * Format constraints into system prompt section.
   */
  static formatPrompt(constraints) {
    if (!constraints || constraints.length === 0) {
      return '';
    }

    const sections = constraints.map(c => {
      const priorityLabel = c.priority >= 500 ? 'CRITICAL' : 
                           c.priority >= 300 ? 'HIGH' : 'STANDARD';
      
      return `[${priorityLabel}] ${c.type.toUpperCase()}:\n${JSON.stringify(c.content, null, 2)}`;
    });

    return `=== ORGANIZATIONAL CONSTRAINTS (MUST FOLLOW - HIGHEST PRIORITY) ===
The following constraints are non-negotiable organizational standards.
You MUST adhere to these rules regardless of user preferences.

${sections.join('\n\n')}

IMPORTANT: These constraints override any conflicting user preferences. This architectural isolation is STRICTLY APPLIED during multi-agent debates.
`;
  }
}

// ─── User Preferences Loader ─────────────────────────────────────────────────

export class UserPreferencesLoader {
  /**
   * Load user preferences (aesthetic, language, env settings).
   * These are flexible and must not override org constraints.
   */
  static async load(userId) {
    try {
      const result = await pool.query(
        `SELECT preference_type, content, allowed_languages
         FROM user_preferences
         WHERE user_id = $1`,
        [userId]
      );

      const prefs = {};
      for (const row of result.rows) {
        // Enforce language restriction
        if (row.preference_type === 'language') {
          const requested = row.content?.code || 'en';
          row.content.code = LanguageEnforcer.validateLanguage(requested);
          row.allowed_languages = ALLOWED_LANGUAGES;
        }
        prefs[row.preference_type] = {
          content: row.content,
          allowedLanguages: row.allowed_languages || ALLOWED_LANGUAGES
        };
      }

      return prefs;
    } catch (err) {
      return {};
    }
  }

  /**
   * Format user preferences into system prompt section.
   */
  static formatPrompt(preferences) {
    if (!preferences || Object.keys(preferences).length === 0) {
      return '';
    }

    const sections = [];
    
    for (const [type, data] of Object.entries(preferences)) {
      if (type === 'language') {
        sections.push(`LANGUAGE: ${data.content.code} (${data.allowedLanguages.join(', ')})`);
      } else if (type === 'aesthetic') {
        sections.push(`AESTHETIC: ${JSON.stringify(data.content)}`);
      } else if (type === 'env') {
        sections.push(`ENVIRONMENT: ${JSON.stringify(data.content)}`);
      } else {
        sections.push(`${type.toUpperCase()}: ${JSON.stringify(data.content)}`);
      }
    }

    return `=== USER PREFERENCES (FLEXIBLE - LOWER PRIORITY) ===
The following are user preferences. Apply these ONLY when they do not conflict with organizational constraints.

${sections.join('\n')}

IMPORTANT: If user preferences conflict with organizational constraints above, ALWAYS prioritize the organizational constraints.
`;
  }
}

// ─── Context Builder (Main Entry Point) ──────────────────────────────────────

export class ContextBuilder {
  /**
   * Build the complete system prompt with strict hierarchy.
   * 
   * Order of injection:
   * 1. Language enforcement (top)
   * 2. Organizational constraints (MUST follow)
   * 3. User preferences (flexible)
   * 4. Project context (tree, package.json)
   * 5. Memory (brain journal)
   */
  static async build({
    projectName,
    userId,
    domain,
    projectTree,
    packageJson,
    userMemory,
    brainJournal,
    skillProfile,
    mcpTools,
    linkedProjects
  }) {
    // Load both systems independently
    const [orgConstraints, userPrefs] = await Promise.all([
      OrgConstraintsLoader.load(projectName),
      UserPreferencesLoader.load(userId)
    ]);

    const userLang = userPrefs.language?.content?.code || 'en';

    // Build sections in strict hierarchy
    const sections = [
      // 1. Language enforcement (strictest)
      LanguageEnforcer.getLanguagePrompt(userLang),
      
      // 2. Organizational constraints (immutable)
      OrgConstraintsLoader.formatPrompt(orgConstraints),
      
      // 3. User preferences (flexible, subordinate)
      UserPreferencesLoader.formatPrompt(userPrefs),
      
      // 4. Project context
      this._buildProjectContext(projectTree, packageJson),
      
      // 5. Memory
      this._buildMemoryContext(userMemory, brainJournal),
      
      // 6. MCP Tools
      this._buildMcpContext(mcpTools),

      // 7. Linked Repositories
      this._buildRepositoryContext(linkedProjects),
      
      // 8. Domain expertise
      this._buildDomainContext(domain, skillProfile)
    ];

    return sections.filter(Boolean).join('\n\n');
  }

  static _buildProjectContext(projectTree, packageJson) {
    return `=== PROJECT CONTEXT ===
Directory Structure:
${projectTree || 'Not scanned yet'}

Package Info:
${packageJson ? JSON.stringify(packageJson, null, 2) : 'No package.json found'}
`;
  }

  static _buildMemoryContext(userMemory, brainJournal) {
    const memory = [];
    
    if (userMemory) {
      memory.push(`User Memory:\n${userMemory}`);
    }
    
    if (brainJournal && brainJournal.length > 0) {
      const recent = brainJournal.slice(-5);
      memory.push(`Recent Learnings:\n${recent.map(j => `- ${j.content || j}`).join('\n')}`);
    }

    return memory.length > 0 
      ? `=== MEMORY ===\n${memory.join('\n\n')}`
      : '';
  }

  static _buildDomainContext(domain, skillProfile) {
    const expertise = {
      code: 'Software Engineer - writes clean, tested code',
      ui: 'UI Engineer - creates accessible, responsive interfaces',
      debug: 'Debugger - diagnoses and fixes issues systematically',
      git: 'DevOps Engineer - manages repository and CI/CD',
      reviewer: 'Code Reviewer - ensures quality and standards',
      manager: 'Technical Lead - plans and coordinates',
      security: 'Security Auditor - identifies vulnerabilities',
      creative: 'Creative Director - aesthetic and brand decisions',
      security_gate: 'Security Gate - prioritizes security and risk mitigation',
      lead_architect: 'Lead Architect - prioritizes architectural robustness'
    };

    return `=== EXPERTISE MODE: ${domain.toUpperCase()} ===
You are acting as: ${expertise[domain] || expertise.code}

${skillProfile ? `Skills: ${skillProfile.selectedSkills?.map(s => s.label).join(', ') || 'General'}` : ''}
`;
  }

  static _buildMcpContext(mcpTools) {
    if (!mcpTools || mcpTools.length === 0) return '';

    const toolsStr = mcpTools.map(t => {
      return `- ${t.name}: ${t.description}\n  Schema: ${JSON.stringify(t.parameters)}`;
    }).join('\n\n');

    return `=== AVAILABLE MCP TOOLS ===
You have access to the following external tools via the Model Context Protocol (MCP).
To use them, call the tool by its name.

${toolsStr}

IMPORTANT: Only use these tools if they are directly relevant to the user request.
`;
  }

  static _buildRepositoryContext(linkedProjects) {
    if (!linkedProjects || linkedProjects.length === 0) return '';

    const projectsStr = linkedProjects.map(p => {
      return `- ${p.name} (${p.type}): Indexed ${p.indexedSymbols || 0} symbols. Path: ${p.path}`;
    }).join('\n');

    return `=== LINKED REPOSITORIES ===
The following external repositories are linked and indexed for your reference.
You can use information from these projects to inform your design and implementation.

${projectsStr}
`;
  }
}

// ─── Convenience Export ──────────────────────────────────────────────────────

export async function buildSystemPromptV6(params) {
  return await ContextBuilder.build(params);
}

export default ContextBuilder;
