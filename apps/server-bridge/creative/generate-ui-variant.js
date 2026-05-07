import { v4 as uuid } from 'uuid';
import { agentAuthManager, authToken, callWithAuthRetry } from '../auth/agent-auth.js';

/**
 * UIVariantService — Phase 5
 * 
 * A specialized AI service that generates multiple visual interpretations 
 * of the same UI component based on creative descriptions and design tokens.
 */
class UIVariantService {
  constructor() {
    this.baseUrl = process.env.UI_VARIANT_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.authManager = agentAuthManager;
  }

  async generateVariants({ componentType, description, designTokens, count = 3 }) {
    if (!this.authManager.hasProvider('ui_variant')) {
      return this.getUnavailableVariants(componentType, 'UI variant provider is not configured.');
    }

    const systemPrompt = `You are a world-class UI designer. Given a component type, a description, and a design system, create ${count} alternative visual design solutions. Each variant should be distinct in layout, hierarchy, or style but still respect the design tokens where possible. Output must be a JSON array.`;

    const userMessage = `Component type: ${componentType}
Description: ${description}
Design tokens: ${JSON.stringify(designTokens, null, 2)}

Please generate ${count} variants. For each variant, provide:
- name (string)
- layoutDescription (string)
- cssSnippet (a minimal CSS/HTML snippet showing the distinct visual style)
- componentStructure (a JSON object describing the component tree)
- notes (why this variant works)

Return only the JSON array.`;

    try {
      const response = await callWithAuthRetry(this.authManager, 'ui_variant', auth => fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken(auth)}`
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Preferred model for design reasoning
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.9,
          response_format: { type: 'json_object' }
        })
      }));

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const parsed = JSON.parse(content);
      // Handle different JSON structures (some models wrap in a 'variants' key)
      const variants = Array.isArray(parsed) ? parsed : (parsed.variants || [parsed]);
      return variants.slice(0, count);
    } catch (e) {
      return this.getUnavailableVariants(componentType, e.message);
    }
  }

  getUnavailableVariants(componentType, reason) {
    return [{
      name: 'Variant generation unavailable',
      unavailable: true,
      componentType,
      layoutDescription: '',
      cssSnippet: '',
      componentStructure: null,
      notes: reason || 'Configure UI_VARIANT_API_KEY or OPENAI_API_KEY to generate production UI variants.',
    }];
  }
}

export const uiVariantService = new UIVariantService();
