import { getCapabilityProfile, normalizeCapability, DEFAULT_CAPABILITY } from './capability-registry.js';

export const DEFAULT_PROFILE = DEFAULT_CAPABILITY;

// Preserve getModelProfile but make it map to capabilities
export function getModelProfile(mode) {
  const normalized = normalizeMode(mode);
  return getCapabilityProfile(normalized);
}

// Preserve normalizeMode but make it use capability logic
export function normalizeMode(mode) {
  return normalizeCapability(mode);
}

// Ensure tests that import MODEL_PROFILES don't break immediately,
// though they should ideally be updated.
export { SELINA_CAPABILITIES as MODEL_PROFILES } from './capability-registry.js';
