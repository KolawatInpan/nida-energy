// Runtime config: reads from window.__RUNTIME_CONFIG__ (set by docker-entrypoint.sh)
// Falls back to process.env for local dev (Vite)
export function getApiBase() {
  const url = (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.BACKEND_URL)
    || process.env.BACKEND_URL
    || 'http://localhost:8000/api';
  return url.replace(/\/$/, '');
}
