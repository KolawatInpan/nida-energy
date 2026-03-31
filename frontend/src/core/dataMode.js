import axios from 'axios';

export const DATA_MODE_HEADER = 'x-data-mode';
export const REAL_MODE = 'real';
export const DEMO_MODE = 'demo';
const STORAGE_KEY = 'DATA_MODE';

export function normalizeDataMode(value) {
    return REAL_MODE;
}

export function getStoredDataMode() {
    try {
        localStorage.setItem(STORAGE_KEY, REAL_MODE);
        return REAL_MODE;
    } catch (e) {
        return REAL_MODE;
    }
}

export function setStoredDataMode(mode) {
    const normalized = REAL_MODE;
    try {
        localStorage.setItem(STORAGE_KEY, normalized);
    } catch (e) {
        // ignore storage failures
    }
    applyDataModeHeader(normalized);
    return normalized;
}

export function applyDataModeHeader(mode = getStoredDataMode()) {
    const normalized = normalizeDataMode(mode);
    axios.defaults.headers.common[DATA_MODE_HEADER] = normalized;
    return normalized;
}
