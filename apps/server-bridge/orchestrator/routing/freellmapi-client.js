
export async function callFreeLLMAPI({ mode, messages, profile, metadata }) {
  const baseUrl = process.env.FREELLMAPI_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.FREELLMAPI_API_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("FreeLLMAPI is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY, or OPENAI_BASE_URL and OPENAI_API_KEY.");
  }

  let chatUrl = baseUrl;
  if (chatUrl.endsWith('/v1/chat/completions')) {
    // already correct
  } else if (chatUrl.endsWith('/chat/completions')) {
    // missing /v1 but has chat completions, leave it or fix it depending on spec, but spec says if baseUrl is .../v1/chat/completions remain that.
  } else if (chatUrl.endsWith('/v1')) {
    chatUrl += '/chat/completions';
  } else if (chatUrl.endsWith('/v1/')) {
    chatUrl += 'chat/completions';
  } else {
    chatUrl += chatUrl.endsWith('/') ? 'v1/chat/completions' : '/v1/chat/completions';
  }

  // Use the exact logger statement
  // But wait, logger might not be imported. The prompt says "Add clear config validation... Allowed log: [Selina] FreeLLMAPI gateway configured: https://freellmapi-uqzq.onrender.com/v1"
  // Let's use console.log or standard logging, but wait, the prompt doesn't specify using a specific logger, just "Allowed log:"
  console.log(`[Selina] FreeLLMAPI gateway configured: ${baseUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), profile.timeoutMs);
  const started = Date.now();

  try {
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: profile.model || 'auto',
        messages,
        temperature: profile.temperature,
        max_tokens: profile.maxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const routedVia = response.headers.get('x-routed-via') || null;
    const fallbackAttempts = response.headers.get('x-fallback-attempts') ? Number.parseInt(response.headers.get('x-fallback-attempts'), 10) : null;

    if (!response.ok) {
      const errorText = await response.text();
      const sanitizedError = new Error(`FreeLLMAPI error ${response.status}: ${errorText}`);
      sanitizedError.status = response.status;
      sanitizedError.routedVia = routedVia;
      sanitizedError.fallbackAttempts = fallbackAttempts;
      throw sanitizedError;
    }

    const data = await response.json();
    const durationMs = Date.now() - started;

    return {
      text: data.choices?.[0]?.message?.content || '',
      raw: data,
      routedVia,
      fallbackAttempts,
      status: response.status,
      durationMs,
      mode,
      model: profile.model || 'auto'
    };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const sanitizedError = new Error('FreeLLMAPI request timed out');
      sanitizedError.status = 408;
      throw sanitizedError;
    }
    throw error;
  }
}
