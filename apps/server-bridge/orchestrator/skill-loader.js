import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, 'skills');

// Cache loaded skills to avoid repeated file reads
const skillCache = new Map();

/**
 * Load a skill file by name. Returns markdown content.
 */
function loadSkill(name) {
  if (skillCache.has(name)) return skillCache.get(name);
  
  try {
    const content = readFileSync(join(SKILLS_DIR, `${name}.md`), 'utf-8');
    skillCache.set(name, content);
    return content;
  } catch {
    console.warn(`[Skills] Skill file not found: ${name}.md`);
    return '';
  }
}

/**
 * Detect the tech stack from the project's file tree and package.json.
 */
function detectStack(projectTree, packageJson) {
  const stack = new Set();
  
  if (packageJson) {
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    if (deps['react'] || deps['react-dom']) stack.add('react');
    if (deps['next']) stack.add('react');
    if (deps['vue']) stack.add('vue');
    if (deps['tailwindcss']) stack.add('css');
    if (deps['express'] || deps['fastify']) stack.add('node');
    if (deps['prisma'] || deps['@prisma/client']) stack.add('node');
  }
  
  // Check file extensions in tree
  if (projectTree) {
    const treeStr = JSON.stringify(projectTree);
    if (treeStr.includes('.tsx') || treeStr.includes('.ts')) stack.add('typescript');
    if (treeStr.includes('.jsx') || treeStr.includes('.js')) stack.add('javascript');
    if (treeStr.includes('.css') || treeStr.includes('.scss')) stack.add('css');
  }
  
  return Array.from(stack);
}

// Rough token estimate: ~4 chars per token for English text
const estimateTokens = (text) => Math.ceil(text.length / 4);

/**
 * Token budgets by effort level.
 * Students on free-tier Gemini can't afford 5000 tokens of system prompt on every call.
 * - quick:    Minimal — core rules only (~400 tokens)
 * - standard: Core + domain skill + memory (~1500 tokens)
 * - deep:     Full load (~3000 tokens)
 */
const TOKEN_BUDGETS = {
  quick: 400,
  standard: 1500,
  deep: 3000,
};

/**
 * Build the system prompt with TOKEN BUDGETING.
 * Skills are loaded in priority order and dropped if over budget.
 */
export function buildSystemPrompt({ domain, projectTree, packageJson, userMemory, brainJournal, effortLevel = 'standard' }) {
  const budget = TOKEN_BUDGETS[effortLevel] || TOKEN_BUDGETS.standard;
  const sections = [];
  let usedTokens = 0;

  const addIfBudget = (content, label) => {
    if (!content) return false;
    const cost = estimateTokens(content);
    if (usedTokens + cost > budget) {
      console.log(`[Skills] Skipped "${label}" (${cost} tokens, ${budget - usedTokens} remaining)`);
      return false;
    }
    sections.push(content);
    usedTokens += cost;
    return true;
  };

  // Priority 1: Core constitution (always loaded, but truncated for 'quick')
  const core = loadSkill('core');
  if (effortLevel === 'quick' && core) {
    // Quick mode: extract only the critical rules sections
    const criticalSections = core.split('---').slice(0, 4).join('---');
    addIfBudget(criticalSections, 'core (compact)');
  } else {
    addIfBudget(core, 'core');
  }

  // Priority 2: User memory (most valuable — user's own preferences)
  if (userMemory) {
    addIfBudget(`# Project Memory\n${userMemory}`, 'user memory');
  }

  // Priority 3: Brain journal (recent learnings — high value, low cost)
  if (brainJournal?.length > 0) {
    const maxEntries = effortLevel === 'quick' ? 5 : 15;
    const entries = brainJournal.slice(-maxEntries).map(e => `- [${e.type}] ${e.content}`).join('\n');
    addIfBudget(`# Brain Journal\n${entries}`, 'brain journal');
  }

  // Priority 4: Domain skill (only for standard+)
  if (effortLevel !== 'quick') {
    if (['code', 'ui', 'debug'].includes(domain)) {
      addIfBudget(loadSkill('surgical-edit'), 'surgical-edit');
    }
    if (domain === 'debug') addIfBudget(loadSkill('debugging'), 'debugging');
    addIfBudget(loadSkill('planning'), 'planning');
  }

  // Priority 5: Stack-specific skills (only for deep)
  if (effortLevel === 'deep') {
    const stack = detectStack(projectTree, packageJson);
    for (const tech of stack) {
      addIfBudget(loadSkill(tech), tech);
    }
  }

  console.log(`[Skills] Loaded ${sections.length} sections, ~${usedTokens} tokens (budget: ${budget})`);
  return sections.filter(Boolean).join('\n\n---\n\n');
}

/**
 * List all available skill files for debugging.
 */
export function listSkills() {
  try {
    return readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}
