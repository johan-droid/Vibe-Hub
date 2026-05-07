import express from 'express';
import { getUserPreferences, upsertUserPreference } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { z } from 'zod';
import { validateRequest } from '../utils/validation.js';

const router = express.Router();

// Preference sync schema
const preferenceUpdateSchema = z.object({
  preferenceType: z.enum(['language', 'aesthetic', 'env', 'workflow', 'ui_theme']),
  content: z.record(z.any())
});

/**
 * GET /api/v6/preferences
 * Fetch all preferences for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const preferences = await getUserPreferences(req.user.id);
    
    // Transform array to a structured object for easier frontend consumption
    const structured = preferences.reduce((acc, pref) => {
      acc[pref.preference_type] = pref.content;
      return acc;
    }, {});

    res.json({ success: true, preferences: structured });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v6/preferences
 * Update or create a specific preference type
 */
router.post('/', requireAuth, validateRequest(preferenceUpdateSchema), async (req, res) => {
  try {
    const { preferenceType, content } = req.validatedBody;
    
    const updated = await upsertUserPreference({
      user_id: req.user.id,
      preference_type: preferenceType,
      content
    });

    res.json({ success: true, preference: updated });
  } catch (error) {
    // Handle language lock rejection specifically if needed
    if (error.message.includes('not allowed')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v6/preferences/bulk
 * Update multiple preferences at once
 */
router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { preferences } = req.body; // Expects { language: {...}, aesthetic: {...}, ... }
    
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid preferences format' });
    }

    const results = [];
    for (const [type, content] of Object.entries(preferences)) {
      if (['language', 'aesthetic', 'env', 'workflow', 'ui_theme'].includes(type)) {
        const updated = await upsertUserPreference({
          user_id: req.user.id,
          preference_type: type,
          content
        });
        results.push(updated);
      }
    }

    res.json({ success: true, count: results.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as preferencesRouter };
