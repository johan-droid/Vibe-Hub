import { KeyRotator, ProviderExhaustedError } from './key-rotator.js';

export class TokenGovernor {
    constructor() {
        this.rotator = new KeyRotator();
    }

    async getCompute(taskComplexity, requiredRole, apiCallFn) {
        if (typeof apiCallFn !== 'function') {
            throw new TypeError('TokenGovernor.getCompute requires an API execution callback');
        }

        if (requiredRole === 'worker') {
            const workerProvider = normalizeWorkerProvider(process.env.SELINA_CODING_MODEL_PROVIDER || process.env.SELINA_WORKER_PROVIDER || 'groq');
            const workerModel = workerModelForProvider(workerProvider);
            return this.rotator.executeWithRotation(workerProvider, (key) => apiCallFn(key, workerModel, workerProvider));
        }

        if (taskComplexity === 'low') {
            if (requiredRole === 'planner') {
                return this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, 'gemini-1.5-flash', 'gemini'));
            } else {
                return this.rotator.executeWithRotation('groq', (key) => apiCallFn(key, 'llama3-8b', 'groq'));
            }
        }

        if (taskComplexity === 'high' && requiredRole === 'planner') {
            try {
                return await this.rotator.executeWithRotation('nim', (key) => apiCallFn(key, 'nemotron-70b', 'nim'));
            } catch (error) {
                if (isProviderUnavailable(error, 'nim')) {
                    console.warn('[Governor] NIM compute unavailable, failing over to Gemini Pro 1.5');
                    return await this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, 'gemini-1.5-pro', 'gemini'));
                }
                throw error;
            }
        }

        throw new Error('No routing rule matched the specified complexity and role');
    }

    /**
     * Returns a pre-configured apiCall function bound to the correct model
     */
    async requestModel(taskComplexity, requiredRole) {
        return async (systemPrompt, userPrompt, options = {}) => {
            return this.getCompute(taskComplexity, requiredRole, (key, model, provider) => (
                callRoutedTextModel(key, model, systemPrompt, userPrompt, { ...options, provider })
            ));
        };
    }

    static async getCompute(taskComplexity, requiredRole, apiCallFn) {
        return new TokenGovernor().getCompute(taskComplexity, requiredRole, apiCallFn);
    }
}

export async function callRoutedTextModel(key, model, systemPrompt, userPrompt, options = {}) {
    const provider = options.provider || inferProvider(model);

    if (provider === 'gemini') {
        const response = await callRoutedGenerateContent(key, model, {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.maxOutputTokens ?? 2048,
                ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
                ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {})
            }
        }, { provider });
        return response.response.text();
    }

    return callOpenAICompatibleChat(key, model, systemPrompt, userPrompt, {
        ...options,
        provider
    });
}

export async function callRoutedGenerateContent(key, model, request, options = {}) {
    const provider = options.provider || inferProvider(model);

    if (provider === 'gemini') {
        return callGeminiGenerateContent(key, model, request);
    }

    const systemPrompt = extractGeminiText(request.systemInstruction);
    const userPrompt = extractGeminiText(request.contents);
    const text = await callOpenAICompatibleChat(key, model, systemPrompt, userPrompt, {
        ...options,
        provider
    });

    return {
        response: { text: () => text },
        raw: null
    };
}

function isProviderUnavailable(error, provider) {
    if (error instanceof ProviderExhaustedError && error.message.includes(provider)) {
        return true;
    }
    return error?.message?.includes(`No keys configured for provider: ${provider}`);
}

function inferProvider(model) {
    if (model.startsWith('gemini')) return 'gemini';
    if (model.includes('nemotron')) return 'nim';
    if (model.includes('qwen')) return 'qwen';
    if (model.includes('deepseek')) return 'deepseek';
    return 'groq';
}

function normalizeWorkerProvider(provider) {
    const normalized = String(provider || 'groq').trim().toLowerCase();
    if (['qwen', 'deepseek', 'groq'].includes(normalized)) return normalized;
    return 'groq';
}

function workerModelForProvider(provider) {
    if (provider === 'qwen') {
        return process.env.QWEN_CODER_MODEL || process.env.QWEN_MODEL || 'qwen/qwen2.5-coder-32b-instruct';
    }
    if (provider === 'deepseek') {
        return process.env.DEEPSEEK_CODER_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-coder';
    }
    return process.env.GROQ_WORKER_MODEL || 'llama3-70b';
}

async function callGeminiGenerateContent(key, model, request) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw await responseError(response, 'Gemini');
    }

    const data = await response.json();
    return {
        response: {
            text: () => data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim() || ''
        },
        raw: data
    };
}

async function callOpenAICompatibleChat(key, model, systemPrompt, userPrompt, options) {
    const provider = options.provider || inferProvider(model);
    const baseUrl = provider === 'nim'
        ? (process.env.NVIDIA_NIM_BASE_URL || process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1')
        : provider === 'qwen'
            ? (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1')
            : provider === 'deepseek'
                ? (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1')
                : (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1');

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxOutputTokens ?? 2048,
            stream: false,
            ...((options.jsonMode || options.responseFormat) ? {
                response_format: options.responseFormat || { type: 'json_object' }
            } : {})
        })
    });

    if (!response.ok) {
        throw await responseError(response, provider.toUpperCase());
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

function extractGeminiText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
        return value.map(extractGeminiText).filter(Boolean).join('\n');
    }
    if (Array.isArray(value.parts)) {
        return value.parts.map(part => part.text || '').filter(Boolean).join('\n');
    }
    return '';
}

async function responseError(response, provider) {
    const body = await response.text();
    const error = new Error(`${provider} API returned status ${response.status}: ${body}`);
    error.status = response.status;
    error.statusCode = response.status;
    return error;
}
