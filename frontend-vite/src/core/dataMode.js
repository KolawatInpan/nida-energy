import axios from 'axios';

export const DATA_MODE_HEADER = 'x-data-mode';
export const REAL_MODE = 'real';
export const DEMO_MODE = 'demo';
const STORAGE_KEY = 'DATA_MODE';

/**
 * Normalize a mode string to either 'real' or 'demo'.
 * Any falsy or unrecognized value defaults to 'real'.
 */
export function normalizeDataMode(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === DEMO_MODE) return DEMO_MODE;
  return REAL_MODE;
}

/**
 * Get the currently stored data mode, defaulting to 'real'.
 */
export function getStoredDataMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeDataMode(stored);
  } catch (e) {
    return REAL_MODE;
  }
}

/**
 * Persist a data mode and apply it to all axios requests.
 */
export function setStoredDataMode(mode) {
  const normalized = normalizeDataMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch (e) {
    // ignore storage failures
  }
  applyDataModeHeader(normalized);
  return normalized;
}

/**
 * Apply the data mode header to axios defaults.
 */
export function applyDataModeHeader(mode = getStoredDataMode()) {
  const normalized = normalizeDataMode(mode);
  axios.defaults.headers.common[DATA_MODE_HEADER] = normalized;
  return normalized;
}
