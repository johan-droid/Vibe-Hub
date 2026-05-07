export class ApprovalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApprovalError';
  }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ApprovalEngine {
  constructor({ timeoutMs = 120_000 } = {}) {
    this.rules = [];
    this.approveOnceUntil = 0;
    this.timeoutMs = timeoutMs;
  }

  addRule(rule) {
    this.rules.push(rule);
  }

  async request(operation, context, uiFn) {
    const target = `${context.toolName}${context.params || ''}`;
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.pattern.test(target)) continue;
      if (rule.action === 'allow') return true;
      if (rule.action === 'deny') return false;
      break;
    }

    if (Date.now() < this.approveOnceUntil) return true;
    if (typeof uiFn !== 'function') return false;

    const result = await Promise.race([
      uiFn(`Approve: ${operation}`),
      new Promise(resolve => setTimeout(() => resolve('deny'), this.timeoutMs)),
    ]);

    if (result === 'deny_always') {
      this.addRule({
        pattern: new RegExp(`^${escapeRegex(context.toolName)}$`),
        action: 'deny',
        priority: 100,
      });
    }

    if (result === 'approve' || result === 'approve_always') {
      this.approveOnceUntil = Date.now() + 300_000;
      return true;
    }

    return false;
  }
}

export const approvalEngine = new ApprovalEngine({
  timeoutMs: Number.parseInt(process.env.SELINA_TOOL_APPROVAL_TIMEOUT_MS || '120000', 10),
});
