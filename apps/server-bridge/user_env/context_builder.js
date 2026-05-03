import fs from 'fs/promises';
import path from 'path';

class UserContextBuilder {
  static async buildUserPreferences(userId) {
    // Static example matching your architectural requirements.
    const userPrefs = {
      aesthetics: "minimalist, clean UI, similar to Vercel/Fly.io",
      supported_locales: ["en", "hi", "or"], // Hard-locked
      offline_mode: true
    };

    // The Failsafe Filter: 
    // Even if a user requests a new language in the DB, this prevents it from reaching the LLM
    const allowedLocales = ['en', 'hi', 'or'];
    const enforcedLocales = userPrefs.supported_locales.filter(lang => 
      allowedLocales.includes(lang)
    );

    return {
      type: 'USER_PREFERENCE',
      preferences: {
        ...userPrefs,
        // If the array is empty after filtering, default back to 'en'
        supported_locales: enforcedLocales.length > 0 ? enforcedLocales : ['en'] 
      }
    };
  }
}

export default UserContextBuilder;
