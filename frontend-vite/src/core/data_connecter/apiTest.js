import axios from 'axios';
import { getApiBase } from './apiBase';
import { getStoredDataMode, DATA_MODE_HEADER } from '../dataMode';
import Key from '../../global/key';

/**
 * HTTP layer for the admin API test runner (pages/admin/apiTestPage).
 *
 * Every request the test suite makes funnels through `apiRequest`, so the page
 * itself never touches axios (see AGENTS.md: no axios in page files) and all
 * calls share the same base URL, auth header and data-mode header as the rest
 * of the app.
 *
 * A non-2xx response is a TEST RESULT, not an exception, so the request opts
 * out of axios' throw-on-error behaviour and always resolves.
 */

export function getStoredToken() {
    try {
        return localStorage.getItem(Key.TOKEN);
    } catch (e) {
        return null;
    }
}

// A test run logs in on its own (POST /users/admin-login) and then uses THAT
// fresh token for the remaining steps — otherwise a stale localStorage token
// from a previous database would make authenticated endpoints fail for reasons
// that have nothing to do with the code under test. Null = fall back to it.
let runToken = null;

export function setApiTestToken(token) {
    runToken = token || null;
}

function errorText(res) {
    const data = res?.data;
    if (!data) return res?.error || `HTTP ${res?.status}`;
    if (typeof data === 'string') return data.slice(0, 300);
    return data.error || data.message || JSON.stringify(data).slice(0, 300);
}

/**
 * @param {Object} opts
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [opts.method]
 * @param {string} opts.path   path after /api, e.g. '/buildings'
 * @param {Object} [opts.data] JSON body
 * @param {Object} [opts.params] query params
 * @param {Object} [opts.headers]
 * @param {number} [opts.timeout] ms
 * @returns {Promise<{ok:boolean,status:number,ms:number,data:any,error?:string,path:string,errorText:string}>}
 */
export async function apiRequest({ method = 'GET', path, data, params, headers = {}, timeout = 30000, token } = {}) {
    const base = getApiBase();
    const startedAt = Date.now();
    const authToken = token !== undefined ? token : (runToken || getStoredToken());
    try {
        const res = await axios.request({
            url: `${base}${path}`,
            method,
            data,
            params,
            timeout,
            headers: {
                'Content-Type': 'application/json',
                [DATA_MODE_HEADER]: getStoredDataMode(),
                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                ...headers,
            },
            // 4xx/5xx are inspected by the suite instead of thrown
            validateStatus: () => true,
        });
        const out = {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            ms: Date.now() - startedAt,
            data: res.data,
            path,
        };
        out.errorText = out.ok ? '' : errorText(out);
        return out;
    } catch (err) {
        const out = {
            ok: false,
            status: 0,
            ms: Date.now() - startedAt,
            data: null,
            path,
            error: err?.code === 'ECONNABORTED' ? `timeout after ${timeout}ms` : (err?.message || 'network error'),
        };
        out.errorText = out.error;
        return out;
    }
}

/** Small helpers so the suite reads like a checklist rather than axios calls. */
export const apiGet = (path, params, opts) => apiRequest({ method: 'GET', path, params, ...opts });
export const apiPost = (path, data, opts) => apiRequest({ method: 'POST', path, data, ...opts });
export const apiPut = (path, data, opts) => apiRequest({ method: 'PUT', path, data, ...opts });
export const apiDelete = (path, params, opts) => apiRequest({ method: 'DELETE', path, params, ...opts });
