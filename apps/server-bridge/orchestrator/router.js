import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Hybrid Fallback Router (Server-Side)
 * L1: Local Regex (zero latency)
 * L2: 1-Shot Micro-Prompt via Gemini (fallback)
 */
export class Router {
  constructor() {
    this.dictionaries = {
      git: [/git/i, /commit/i, /branch/i, /push/i, /clone/i],
      debug: [/error/i, /failed/i, /stderr/i, /bug/i, /fix/i, /crash/i],
      ui: [/navbar/i, /css/i, /tailwind/i, /look/i, /component/i, /color/i, /design/i, /style/i],
      code: [/function/i, /refactor/i, /implement/i, /create/i, /add/i, /write/i, /build/i],
    };
  }

  async route(prompt) {
    // L1: Regex match
    for (const [domain, patterns] of Object.entries(this.dictionaries)) {
      if (patterns.some(p => p.test(prompt))) {
        console.log(`[Router] L1 Match: ${domain}`);
        return domain;
      }
    }

    // L2: LLM fallback
    console.log('[Router] L1 Miss. Falling back to LLM.');
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(
        `Classify this prompt into exactly one domain: git, debug, ui, code.\nPrompt: "${prompt}"\nRespond with only the domain name.`
      );
      return result.response.text().trim().toLowerCase();
    } catch {
      console.error('[Router] L2 fallback failed. Defaulting to code.');
      return 'code';
    }
  }
}
