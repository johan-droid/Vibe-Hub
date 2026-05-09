import { KeyRotator, ProviderExhaustedError } from './key-rotator.js';

export class TokenGovernor {
    constructor() {
        this.rotator = new KeyRotator();
    }

    async getCompute(taskComplexity, requiredRole, apiCallFn = async () => {}) {
        if (requiredRole === 'worker') {
            return this.rotator.executeWithRotation('groq', (key) => apiCallFn(key, 'llama3-70b'));
        }

        if (taskComplexity === 'low') {
            if (requiredRole === 'planner') {
                return this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, 'gemini-1.5-flash'));
            } else {
                return this.rotator.executeWithRotation('groq', (key) => apiCallFn(key, 'llama3-8b'));
            }
        }

        if (taskComplexity === 'high' && requiredRole === 'planner') {
            try {
                return await this.rotator.executeWithRotation('nim', (key) => apiCallFn(key, 'nemotron-70b'));
            } catch (error) {
                if (error instanceof ProviderExhaustedError && error.message.includes('nim')) {
                    console.warn('[Governor] NIM keys exhausted, failing over to Gemini Pro 1.5');
                    return await this.rotator.executeWithRotation('gemini', (key) => apiCallFn(key, 'gemini-1.5-pro'));
                }
                throw error;
            }
        }

        throw new Error('No routing rule matched the specified complexity and role');
    }
}
