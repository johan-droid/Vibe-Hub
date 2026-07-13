// DEPRECATED: Key rotation is now handled by OmniRoute gateway.
// This file is kept for backward compatibility and test imports only.

export class ProviderExhaustedError extends Error {
    constructor(provider) {
        super(`PROVIDER_EXHAUSTED: ${provider}`);
        this.name = 'ProviderExhaustedError';
    }
}

export class KeyRotator {
    constructor() {
        this.keys = {
            freellmapi: splitKeys(process.env.FREELLMAPI_KEYS || process.env.FREELLMAPI_API_KEY),
            groq: splitKeys(process.env.GROQ_KEYS || process.env.GROQ_API_KEY),
            qwen: splitKeys(process.env.QWEN_KEYS || process.env.QWEN_API_KEY),
            deepseek: splitKeys(process.env.DEEPSEEK_KEYS || process.env.DEEPSEEK_API_KEY),
            nim: splitKeys(process.env.NVIDIA_NIM_KEYS || process.env.NIM_API_KEY || process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY),
            gemini: splitKeys(process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY)
        };
        this.currentIndex = {
            freellmapi: 0,
            groq: 0,
            qwen: 0,
            deepseek: 0,
            nim: 0,
            gemini: 0
        };
    }

    async executeWithRotation(provider, apiCallFn) {
        const providerKeys = this.keys[provider];
        if (!providerKeys || providerKeys.length === 0) {
            throw new Error(`No keys configured for provider: ${provider}`);
        }

        let attempts = 0;
        const maxAttempts = providerKeys.length;

        while (attempts < maxAttempts) {
            const currentKey = providerKeys[this.currentIndex[provider]];
            try {
                return await apiCallFn(currentKey);
            } catch (error) {
                const status = error.status || error.statusCode || (error.response && error.response.status);
                if (status === 429 || status === 403) {
                    const currentIdx = this.currentIndex[provider];
                    const nextIdx = (currentIdx + 1) % providerKeys.length;
                    console.warn(`[Rotator] ${provider.toUpperCase()} Key ${currentIdx + 1} exhausted, swapping to Key ${nextIdx + 1}`);
                    this.currentIndex[provider] = nextIdx;
                    attempts++;
                } else {
                    throw error;
                }
            }
        }

        throw new ProviderExhaustedError(provider);
    }
}

function splitKeys(value = '') {
    return value.split(',').map(key => key.trim()).filter(Boolean);
}
