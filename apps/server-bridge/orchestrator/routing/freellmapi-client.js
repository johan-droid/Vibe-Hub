export async function callFreeLLMAPI({ capability, mode, messages, profile, metadata = {} }) {
  const baseUrl = process.env.FREELLMAPI_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.FREELLMAPI_API_KEY || process.env.OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("FreeLLMAPI is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY, or OPENAI_BASE_URL and OPENAI_API_KEY.");
  }

  let chatUrl = baseUrl;

  // Normalize URL to always end in /v1/chat/completions exactly once
  if (chatUrl.endsWith('/v1/chat/completions')) {
    // already correct
  } else if (chatUrl.endsWith('/chat/completions')) {
    // missing /v1 but has chat completions
    chatUrl = chatUrl.replace(/\/chat\/completions$/, '/v1/chat/completions');
  } else if (chatUrl.endsWith('/v1')) {
    chatUrl += '/chat/completions';
  } else if (chatUrl.endsWith('/v1/')) {
    chatUrl += 'chat/completions';
  } else {
    chatUrl += chatUrl.endsWith('/') ? 'v1/chat/completions' : '/v1/chat/completions';
  }

  // Capability determines the fallback model from environment
  const capabilityUpper = (capability || mode || '').toUpperCase();
  const envModel = process.env.SELINA_FORCE_MODEL || process.env[`SELINA_${capabilityUpper}_MODEL`] || 'auto';
  const targetModel = envModel;

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
        model: targetModel,
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
      capability: capability || mode,
      model: targetModel
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
