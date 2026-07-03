export function checkSecurity(userPrompt) {
  const patterns = [
    /eval\s*\(/,
    /child_process/,
    /exec\s*\(/,
    /rm\s+-rf/,
    /sk-[a-zA-Z0-9]{32,}/,
    /nvapi-[a-zA-Z0-9\-]{32,}/
  ];

  for (const pattern of patterns) {
    if (pattern.test(userPrompt)) {
      const err = new Error('SECURITY_VIOLATION');
      err.status = 403;
      throw err;
    }
  }
}
