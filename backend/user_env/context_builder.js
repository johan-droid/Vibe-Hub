import fs from 'fs/promises';
import path from 'path';
import { withJsonCache } from '../utils/cache.js';

export const ALLOWED_USER_LOCALES = Object.freeze(['en', 'hi', 'or']);

class UserContextBuilder {
  static async buildUserPreferences(userId) {
    const { value } = await withJsonCache(
      `cache:context:user:${userId}`,
      Number.parseInt(process.env.CONTEXT_CACHE_TTL_SECONDS || '300', 10),
      async () => this.loadUserPreferences(userId)
    );
    return value;
  }

  static async loadUserPreferences(userId) {
    try {
      const { getUserPreferences } = await import('../db.js');
      const preferences = await getUserPreferences(userId);
      
      // Transform array to structured object
      const userPrefs = preferences.reduce((acc, pref) => {
        acc[pref.preference_type] = pref.content;
        return acc;
      }, {});

      // Fallback/Default values if none exist
      const defaults = {
        language: { code: 'en' },
        aesthetic: { theme: 'coffee-milky', mode: 'light' },
        workflow: { auto_accept: false, max_retries: 3 }
      };

      const finalPrefs = { ...defaults, ...userPrefs };

      // Language Lock Enforcement (Neural OS Protocol)
      const allowedLocales = ALLOWED_USER_LOCALES;
      const currentLang = finalPrefs.language?.code || 'en';
      const validatedLang = allowedLocales.includes(currentLang) ? currentLang : 'en';

      return {
        type: 'USER_PREFERENCE',
        preferences: {
          ...finalPrefs,
          language: { code: validatedLang },
          supported_locales: allowedLocales // Hard-locked system capability
        }
      };
    } catch (error) {
      console.error('[UserContextBuilder] Failed to load preferences:', error);
      return {
        type: 'USER_PREFERENCE',
        preferences: {
          language: { code: 'en' },
          supported_locales: ALLOWED_USER_LOCALES
        }
      };
    }
  }
}

export default UserContextBuilder;
