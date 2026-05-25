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
import { hardenSystemPrompt } from './prompt-hardening.js';
import { formatEvidencePacketForPrompt } from '../memory/rag-layers.js';
import { countTokens, fitTextToTokenBudget } from '../memory/tokenizer.js';

export const CONTEXT_SECTION_TOKEN_BUDGETS = Object.freeze({
  orgConstraints: 320,
  userPreferences: 220,
  projectTree: 320,
  packageJson: 220,
  userMemory: 180,
  retrievalPlan: 120,
  evidencePacket: 900,
  brainJournal: 160,
  mcpTools: 320,
  linkedProjects: 140,
});

const MCP_TOOL_SUMMARY_LIMIT = 12;
const LINKED_PROJECT_SUMMARY_LIMIT = 8;
const EVIDENCE_FIRST_PATH_LIMIT = 6;

function compactText(value, tokenBudget, options = {}) {
  const fitted = fitTextToTokenBudget(String(value || ''), tokenBudget, {
    mode: 'head-tail',
    ...options,
  });
  return fitted.text;
}

function compactJson(value, tokenBudget) {
  if (value === undefined || value === null) return '';
  try {
    return compactText(JSON.stringify(value, null, 2), tokenBudget);
  } catch {
    return compactText(String(value), tokenBudget);
  }
}

function summarizeMcpSchema(parameters) {
  if (!parameters || typeof parameters !== 'object') return 'No structured parameters';

  const properties = parameters.properties && typeof parameters.properties === 'object'
    ? parameters.properties
    : {};
  const required = Array.isArray(parameters.required) ? parameters.required.slice(0, 6) : [];
  const topLevelFields = Object.entries(properties)
    .slice(0, 6)
    .map(([name, definition]) => `${name}:${definition?.type || 'any'}`);

  const parts = [];
  if (required.length > 0) parts.push(`required=${required.join(', ')}`);
  if (topLevelFields.length > 0) parts.push(`fields=${topLevelFields.join(', ')}`);
  if (parameters.additionalProperties === false) parts.push('strict-object');
  return parts.join(' | ') || 'No structured parameters';
}

function inferToolRisk(tool = {}) {
  const text = `${tool.name || ''} ${tool.description || ''}`.toLowerCase();
  if (/(delete|remove|destroy|write|patch|commit|deploy|execute|command|shell|approve)/u.test(text)) return 'high';
  if (/(create|update|edit|run|trigger|push|merge)/u.test(text)) return 'medium';
  return 'low';
}

function summarizeMcpTool(tool = {}) {
  const description = compactText(tool.description || 'No description provided.', 40);
  const schemaSummary = summarizeMcpSchema(tool.parameters);
  return `- ${tool.name} [risk:${inferToolRisk(tool)}]\n  ${description}\n  ${schemaSummary}`;
}

function hasPackedEvidence(evidencePacket) {
  return Number(evidencePacket?.selectedCount || 0) > 0;
}

function summarizePackageInfo(packageJson) {
  if (!packageJson || typeof packageJson !== 'object') return 'No package.json found';

  const summary = {
    name: packageJson.name || null,
    type: packageJson.type || null,
    scripts: packageJson.scripts ? Object.keys(packageJson.scripts).slice(0, 8) : [],
    dependencies: packageJson.dependencies ? Object.keys(packageJson.dependencies).slice(0, 12) : [],
    devDependencies: packageJson.devDependencies ? Object.keys(packageJson.devDependencies).slice(0, 8) : [],
  };

  return compactJson(summary, CONTEXT_SECTION_TOKEN_BUDGETS.packageJson);
}

function buildEvidenceAnchors(evidencePacket) {
  if (!hasPackedEvidence(evidencePacket)) return [];

  return [...new Set(
    (evidencePacket.evidence || [])
      .map(item => item.sourcePath || item.sourceName)
      .filter(Boolean)
  )].slice(0, EVIDENCE_FIRST_PATH_LIMIT);
}

export function buildContextAuditSummary({
  projectTree,
  packageJson,
  userMemory,
  retrievalPlan,
  evidencePacket,
  brainJournal,
  mcpTools,
  linkedProjects,
} = {}) {
  const evidenceText = formatEvidencePacketForPrompt(evidencePacket);
  const evidenceFirstMode = hasPackedEvidence(evidencePacket);
  const projectContextText = evidenceFirstMode
    ? `Evidence-first mode is active. Broad project context is suppressed because grounded evidence is already available.\n${buildEvidenceAnchors(evidencePacket).join('\n') || 'No source anchors were available'}`
    : compactText(projectTree || 'Not scanned yet', CONTEXT_SECTION_TOKEN_BUDGETS.projectTree);
  const mcpContextText = evidenceFirstMode && retrievalPlan?.queryType && retrievalPlan.queryType !== 'tooling'
    ? 'Evidence-first mode is active. Tool inventory is intentionally compressed until a tooling-specific query requires broader MCP context.'
    : compactText((mcpTools || []).slice(0, MCP_TOOL_SUMMARY_LIMIT).map(summarizeMcpTool).join('\n\n'), CONTEXT_SECTION_TOKEN_BUDGETS.mcpTools);
  const linkedRepoText = evidenceFirstMode
    ? 'Evidence-first mode is active. Linked repository summaries are suppressed unless the retrieved evidence does not ground the task sufficiently.'
    : compactText((linkedProjects || []).slice(0, LINKED_PROJECT_SUMMARY_LIMIT).map(p => `- ${p.name} (${p.type})`).join('\n'), CONTEXT_SECTION_TOKEN_BUDGETS.linkedProjects);

  return {
    budgets: CONTEXT_SECTION_TOKEN_BUDGETS,
    tokens: {
      projectTree: countTokens(projectContextText),
      packageJson: countTokens(packageJson
        ? compactJson(packageJson, CONTEXT_SECTION_TOKEN_BUDGETS.packageJson)
        : 'No package.json found'),
      userMemory: countTokens(compactText(userMemory || '', CONTEXT_SECTION_TOKEN_BUDGETS.userMemory)),
      retrievalPlan: countTokens(compactText(retrievalPlan ? JSON.stringify(retrievalPlan, null, 2) : '', CONTEXT_SECTION_TOKEN_BUDGETS.retrievalPlan)),
      evidencePacket: countTokens(compactText(evidenceText || '', CONTEXT_SECTION_TOKEN_BUDGETS.evidencePacket)),
      brainJournal: countTokens(compactText((brainJournal || []).slice(-3).map(j => `- ${j.content || j}`).join('\n'), CONTEXT_SECTION_TOKEN_BUDGETS.brainJournal)),
      mcpTools: countTokens(mcpContextText),
      linkedProjects: countTokens(linkedRepoText),
    },
    counts: {
      evidence: evidencePacket?.selectedCount || 0,
      mcpTools: Array.isArray(mcpTools) ? mcpTools.length : 0,
      linkedProjects: Array.isArray(linkedProjects) ? linkedProjects.length : 0,
      brainJournalEntries: Array.isArray(brainJournal) ? brainJournal.length : 0,
    },
  };
}

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
      
      return `[${priorityLabel}] ${c.type.toUpperCase()}:\n${compactJson(c.content, 120)}`;
    });

    return compactText(`=== ORGANIZATIONAL CONSTRAINTS (MUST FOLLOW - HIGHEST PRIORITY) ===
The following constraints are non-negotiable organizational standards.
You MUST adhere to these rules regardless of user preferences.

${sections.join('\n\n')}

IMPORTANT: These constraints override any conflicting user preferences.
`, CONTEXT_SECTION_TOKEN_BUDGETS.orgConstraints);
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
        sections.push(`AESTHETIC: ${compactJson(data.content, 60)}`);
      } else if (type === 'env') {
        sections.push(`ENVIRONMENT: ${compactJson(data.content, 60)}`);
      } else {
        sections.push(`${type.toUpperCase()}: ${compactJson(data.content, 60)}`);
      }
    }

    return compactText(`=== USER PREFERENCES (FLEXIBLE - LOWER PRIORITY) ===
The following are user preferences. Apply these ONLY when they do not conflict with organizational constraints.

${sections.join('\n')}

IMPORTANT: If user preferences conflict with organizational constraints above, ALWAYS prioritize the organizational constraints.
`, CONTEXT_SECTION_TOKEN_BUDGETS.userPreferences);
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
    retrievalPlan,
    evidencePacket,
    skillProfile,
    mcpTools,
    linkedProjects
  }) {
    const evidenceFirstMode = hasPackedEvidence(evidencePacket);

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
      this._buildProjectContext(projectTree, packageJson, evidencePacket),
      
      // 5. Memory
      this._buildMemoryContext(userMemory, brainJournal, retrievalPlan, evidencePacket),
      
      // 6. MCP Tools
      this._buildMcpContext(mcpTools, retrievalPlan, evidenceFirstMode),

      // 7. Linked Repositories
      this._buildRepositoryContext(linkedProjects, evidenceFirstMode),
      
      // 8. Domain expertise
      this._buildDomainContext(domain, skillProfile)
    ];

    return hardenSystemPrompt(sections.filter(Boolean).join('\n\n'));
  }

  static _buildProjectContext(projectTree, packageJson, evidencePacket) {
    if (hasPackedEvidence(evidencePacket)) {
      const anchors = buildEvidenceAnchors(evidencePacket);
      const anchorBlock = anchors.length > 0
        ? anchors.map(item => `- ${item}`).join('\n')
        : '- No source anchors were available';

      return `=== PROJECT CONTEXT ===
Evidence-first mode is active. Broad project context is suppressed because grounded evidence is already available.

Evidence Anchors:
${anchorBlock}

Package Summary:
${summarizePackageInfo(packageJson)}
`;
    }

    const compactTree = compactText(projectTree || 'Not scanned yet', CONTEXT_SECTION_TOKEN_BUDGETS.projectTree);
    const compactPkg = summarizePackageInfo(packageJson);

    return `=== PROJECT CONTEXT ===
Directory Structure:
${compactTree}

Package Info:
${compactPkg}
`;
  }

  static _buildMemoryContext(userMemory, brainJournal, retrievalPlan, evidencePacket) {
    const sections = [];
    
    if (userMemory) {
      sections.push(`User Memory:\n${compactText(userMemory, CONTEXT_SECTION_TOKEN_BUDGETS.userMemory)}`);
    }

    if (retrievalPlan) {
      sections.push(compactText(`Retrieval Plan:
- Query Type: ${retrievalPlan.queryType}
- Recall Strategy: ${retrievalPlan.recallStrategy || 'lexical_first'}
- Risk Level: ${retrievalPlan.riskLevel || 'medium'}
- Rationale: ${retrievalPlan.rationale}
- Requires Source Evidence: ${retrievalPlan.requireSourceEvidence === true ? 'yes' : 'no'}
- Preferred Memory Classes: ${(retrievalPlan.preferredMemoryClasses || []).join(', ') || 'none'}
- Recall Terms: ${(retrievalPlan.terms || []).join(', ') || 'none'}`, CONTEXT_SECTION_TOKEN_BUDGETS.retrievalPlan));
    }

    const evidenceBlock = formatEvidencePacketForPrompt(evidencePacket);
    if (evidenceBlock) {
      sections.push(compactText(evidenceBlock, CONTEXT_SECTION_TOKEN_BUDGETS.evidencePacket));
    }
    
    if (brainJournal && brainJournal.length > 0) {
      const recent = brainJournal.slice(-3);
      sections.push(`Recent Learnings:\n${compactText(recent.map(j => `- ${j.content || j}`).join('\n'), CONTEXT_SECTION_TOKEN_BUDGETS.brainJournal)}`);
    }

    return sections.length > 0 
      ? `=== MEMORY AND EVIDENCE ===\n${sections.join('\n\n')}`
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
      creative: 'Creative Director - aesthetic and brand decisions'
    };

    return `=== EXPERTISE MODE: ${domain.toUpperCase()} ===
You are acting as: ${expertise[domain] || expertise.code}

${skillProfile ? `Skills: ${skillProfile.selectedSkills?.map(s => s.label).join(', ') || 'General'}` : ''}
`;
  }

  static _buildMcpContext(mcpTools, retrievalPlan = null, evidenceFirstMode = false) {
    if (!mcpTools || mcpTools.length === 0) return '';

    if (evidenceFirstMode && retrievalPlan?.queryType && retrievalPlan.queryType !== 'tooling') {
      return `=== AVAILABLE MCP TOOLS ===
Evidence-first mode is active. Tool inventory is intentionally compressed until a tooling-specific query requires broader MCP context.
`;
    }

    const toolsStr = mcpTools
      .slice(0, MCP_TOOL_SUMMARY_LIMIT)
      .map(summarizeMcpTool)
      .join('\n\n');

    return compactText(`=== AVAILABLE MCP TOOLS ===
You have access to the following external tools via the Model Context Protocol (MCP).
To use them, call the tool by its name.

${toolsStr}

${mcpTools.length > MCP_TOOL_SUMMARY_LIMIT ? `Additional tools not shown: ${mcpTools.length - MCP_TOOL_SUMMARY_LIMIT}` : ''}

IMPORTANT: Only use these tools if they are directly relevant to the user request.
`, CONTEXT_SECTION_TOKEN_BUDGETS.mcpTools);
  }

  static _buildRepositoryContext(linkedProjects, evidenceFirstMode = false) {
    if (!linkedProjects || linkedProjects.length === 0) return '';

    if (evidenceFirstMode) {
      return `=== LINKED REPOSITORIES ===
Evidence-first mode is active. Linked repository summaries are suppressed unless the retrieved evidence does not ground the task sufficiently.
`;
    }

    const projectsStr = linkedProjects.slice(0, LINKED_PROJECT_SUMMARY_LIMIT).map(p => {
      return `- ${p.name} (${p.type}): Indexed ${p.indexedSymbols || 0} symbols. Path: ${p.path}`;
    }).join('\n');

    return compactText(`=== LINKED REPOSITORIES ===
The following external repositories are linked and indexed for your reference.
You can use information from these projects to inform your design and implementation.

${projectsStr}

${linkedProjects.length > LINKED_PROJECT_SUMMARY_LIMIT ? `Additional linked repositories not shown: ${linkedProjects.length - LINKED_PROJECT_SUMMARY_LIMIT}` : ''}
`, CONTEXT_SECTION_TOKEN_BUDGETS.linkedProjects);
  }
}

// ─── Convenience Export ──────────────────────────────────────────────────────

export async function buildSystemPromptV6(params) {
  return await ContextBuilder.build(params);
}

export default ContextBuilder;
