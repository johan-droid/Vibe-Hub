import { GoogleGenerativeAI } from '@google/generative-ai';
import { modelService } from './models.js';

/**
 * Hybrid Fallback Router (Server-Side) - Phase 4
 * L1: Local Regex (zero latency)
 * L2: Structured JSON classification via native Google SDK (fallback)
 */
export class Router {
  constructor() {
    this.dictionaries = {
      git: [/git/i, /commit/i, /branch/i, /push/i, /clone/i],
      debug: [/error/i, /failed/i, /stderr/i, /bug/i, /fix/i, /crash/i],
      ui: [/navbar/i, /css/i, /tailwind/i, /look/i, /component/i, /color/i, /design/i, /style/i],
      code: [/function/i, /refactor/i, /implement/i, /create/i, /add/i, /write/i, /build/i],
      manager: [/plan/i, /architecture/i, /overview/i, /manage/i, /coordinate/i, /multi-step/i, /large-scale/i],
      security: [/audit/i, /security/i, /vulnerability/i, /exploit/i, /scan/i, /hardening/i, /pentest/i, /owasp/i],
      creative: [/creative/i, /aesthetic/i, /vision/i, /brand/i, /mood/i, /style/i, /concept/i],
    };
    
    this.validDomains = ['git', 'debug', 'ui', 'code', 'manager', 'security', 'creative'];
  }

  async route(prompt) {
    // L1: Regex match (zero latency)
    for (const [domain, patterns] of Object.entries(this.dictionaries)) {
      if (patterns.some(p => p.test(prompt))) {
        console.log(`[Router] L1 Match: ${domain}`);
        return domain;
      }
    }

    // L2: Native Google SDK with structured JSON output
    console.log('[Router] L1 Miss. Falling back to LLM with structured JSON.');
    try {
      const classificationPrompt = `Classify this prompt into exactly one domain from the list below.

Available domains:
- git: Version control operations (commit, branch, push, clone, merge)
- debug: Error diagnosis and fixing (bugs, crashes, stderr, failures)
- ui: User interface design (CSS, Tailwind, components, styling, layout)
- code: General programming (functions, refactoring, implementation, features)
- manager: High-level planning and coordination (architecture, multi-step tasks)
- security: Security auditing (vulnerabilities, scans, hardening, OWASP)
- creative: Design vision and aesthetics (brand, mood, concepts, style direction)

Respond ONLY with a JSON object in this exact format:
{"domain": "<domain_name>"}

Prompt: "${prompt}"`;

      const result = await modelService.generateStructuredJSON({
        model: 'gemini-1.5-flash',
        prompt: classificationPrompt,
        systemInstruction: 'You are a precise routing classifier. Always respond with valid JSON containing exactly one domain from the allowed list.',
      });

      const domain = result.domain?.toLowerCase();
      
      if (domain && this.validDomains.includes(domain)) {
        console.log(`[Router] L2 Classification: ${domain}`);
        return domain;
      }
      
      console.warn('[Router] L2 returned invalid domain, defaulting to code');
      return 'code';
    } catch (error) {
      console.error('[Router] L2 fallback failed:', error.message);
      return 'code';
    }
  }
}
