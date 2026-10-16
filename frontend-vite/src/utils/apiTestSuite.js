/**
 * End-to-end API test suite (admin → Testing page).
 *
 * The suite walks the whole product flow against the LIVE backend, in order:
 *
 *   auth → quick register (user + building + meters + wallet) → buildings →
 *   meters → energy logs & charts → wallet top-up → market trade →
 *   invoice generation & payment → receipt → system endpoints → cleanup
 *
 * Every case declares the endpoint it exercises, so the page can show exactly
 * which endpoint failed. Cases run sequentially and share a `ctx` object, so a
 * case can build on what an earlier case created (ids, snids, wallets…).
 *
 * Contract for a case:
 *   { id, phase, name, method, path, run(ctx) }
 *   run() returns { detail, res }   — res is an apiRequest result (status/ms)
 *   throw TestFailure → step failed
 *   throw TestSkip    → step skipped (precondition missing, not a bug)
 *   return { warned: true } → optional/cleanup step that failed but is not
 *                             counted as a failure
 */

import { apiGet, apiPost, apiPut, apiDelete, setApiTestToken } from '../core/data_connecter/apiTest';

export class TestFailure extends Error {}
export class TestSkip extends Error {}

const fail = (msg, res) => {
    const err = new TestFailure(msg);
    err.res = res;
    throw err;
};

const skip = (msg) => { throw new TestSkip(msg); };

const asArray = (data, ...keys) => {
    if (Array.isArray(data)) return data;
    for (const key of keys) {
        if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
};

/** Unwrap a request that MUST succeed; anything else fails the step. */
const ok = (res, detail) => {
    if (!res.ok) fail(res.errorText || `HTTP ${res.status}`, res);
    return { res, detail: typeof detail === 'function' ? detail(res.data) : (detail || `HTTP ${res.status}`) };
};

/** Best-effort step: a failure is reported but does not fail the run. */
const optional = (fn) => async (ctx) => {
    try {
        return await fn(ctx);
    } catch (err) {
        if (err instanceof TestSkip) throw err;
        return { res: err.res, detail: `cleanup skipped — ${err.message}`, warned: true };
    }
};

const shortId = (value) => (value == null ? '—' : `${String(value).slice(0, 8)}…`);

const pad = (n) => String(n).padStart(2, '0');
const dayStr = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** `E2E-A-153012` style names keep repeated runs from colliding. */
function makeStamp(now = new Date()) {
    return `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function pickMeter(snids = [], kind) {
    const needle = kind === 'producer' ? 'PRD' : 'CON';
    return snids.find((s) => String(s).toUpperCase().includes(needle)) || null;
}

export function createTestContext({ stamp, adminPassword } = {}) {
    const now = new Date();
    return {
        stamp: stamp || makeStamp(now),
        adminPassword: adminPassword || 'nidaadmin1',
        userEmail: 'nida_blockchain.user@nida.ac.th',
        today: dayStr(now),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        buildingA: null,      // producer building created by quick register
        buildingB: null,      // consumer building created by quick register
        buildingC: null,      // second consumer building created with meters
        walletA: null,
        walletB: null,
        snidsA: [],
        snidsB: [],
        producerSnidA: null,
        consumerSnidA: null,
        extraSnid: null,
        offerOrderId: null,
        bidOrderId: null,
        invoiceId: null,
        invoicePaid: false,
    };
}

/**
 * All test phases. Each phase = { key, label, cases: [...] }.
 */
export function buildApiTestPhases(ctx) {
    const A = `E2E-A-${ctx.stamp}`;
    const B = `E2E-B-${ctx.stamp}`;
    const C = `E2E-C-${ctx.stamp}`;

    const phases = [
        {
            key: 'auth',
            label: '1 · Connectivity & Auth',
            cases: [
                {
                    id: 'health', name: 'Health check', method: 'GET', path: '/health',
                    run: async () => ok(await apiGet('/health'), 'backend responding'),
                },
                {
                    id: 'admin-login', name: 'Admin login (password)', method: 'POST', path: '/users/admin-login',
                    run: async () => {
                        const res = await apiPost('/users/admin-login', { password: ctx.adminPassword });
                        if (!res.ok && res.status === 401) skip('wrong admin password — set it in the field above');
                        const out = ok(res, (d) => `token for ${d?.user?.name || d?.user?.email || 'admin'}`);
                        ctx.adminToken = res.data?.token || null;
                        // use the fresh token for every following step
                        setApiTestToken(ctx.adminToken);
                        ctx.adminUserId = res.data?.user?.credId || res.data?.user?.id || null;
                        return out;
                    },
                },
                {
                    id: 'users-list', name: 'List users', method: 'GET', path: '/users',
                    run: async () => {
                        const res = await apiGet('/users');
                        const out = ok(res, (d) => `${asArray(d, 'users').length} user(s)`);
                        ctx.anyUserId = ctx.anyUserId || asArray(res.data, 'users')[0]?.credId || null;
                        return out;
                    },
                },
                {
                    id: 'check-user', name: 'Check user (shared email)', method: 'POST', path: '/users/check-user',
                    run: async () => ok(await apiPost('/users/check-user', { email: ctx.userEmail }),
                        (d) => `real=${Boolean(d?.real)} demo=${Boolean(d?.demo)}`),
                },
                {
                    id: 'user-buildings', name: 'Buildings of a user', method: 'GET', path: '/users/:credId/buildings',
                    run: async () => {
                        const credId = ctx.adminUserId || ctx.anyUserId;
                        if (!credId) skip('no user credId available');
                        return ok(await apiGet(`/users/${encodeURIComponent(credId)}/buildings`),
                            (d) => `${asArray(d, 'buildings').length} assignment(s)`);
                    },
                },
                {
                    id: 'quick-register-a', name: `Quick register producer building (${A})`, method: 'POST', path: '/users/admin-quick-register',
                    run: async () => {
                        const res = await apiPost('/users/admin-quick-register', {
                            buildingName: A,
                            password: 'nida123',
                            address: 'E2E test address',
                            city: 'Bangkok',
                            postalCode: '10240',
                            mapUrl: 'https://maps.google.com/?q=13.8,100.5',
                            phoneNumber: '0800000000',
                            buildingRole: 'producer',
                        });
                        const out = ok(res, (d) => `building #${d?.building?.id} with ${(d?.meters || []).length} meter(s)`);
                        ctx.buildingA = res.data?.building || null;
                        ctx.snidsA = res.data?.meters || [];
                        ctx.producerSnidA = pickMeter(ctx.snidsA, 'producer');
                        ctx.consumerSnidA = pickMeter(ctx.snidsA, 'consumer');
                        return out;
                    },
                },
                {
                    id: 'quick-register-b', name: `Quick register consumer building (${B})`, method: 'POST', path: '/users/admin-quick-register',
                    run: async () => {
                        const res = await apiPost('/users/admin-quick-register', {
                            buildingName: B,
                            password: 'nida123',
                            address: 'E2E buyer address',
                            city: 'Bangkok',
                            postalCode: '10240',
                            buildingRole: 'consumer',
                        });
                        const out = ok(res, (d) => `building #${d?.building?.id} with ${(d?.meters || []).length} meter(s)`);
                        ctx.buildingB = res.data?.building || null;
                        ctx.snidsB = res.data?.meters || [];
                        return out;
                    },
                },
            ],
        },

        {
            key: 'buildings',
            label: '2 · Buildings',
            cases: [
                {
                    id: 'buildings-list', name: 'List buildings', method: 'GET', path: '/buildings',
                    run: async () => ok(await apiGet('/buildings'), (d) => `${asArray(d, 'buildings').length} building(s)`),
                },
                {
                    id: 'building-get', name: 'Get building by id', method: 'GET', path: '/buildings/:id',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiGet(`/buildings/${ctx.buildingA.id}`), (d) => `${d?.name} (${d?.status || 'n/a'})`);
                    },
                },
                {
                    id: 'building-update', name: 'Update building (trade mode)', method: 'PUT', path: '/buildings/:id',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiPut(`/buildings/${ctx.buildingA.id}`, {
                            tradeMode: 'MANUAL',
                            solarSelfPercent: 90,
                            batterySellThreshold: 80,
                        }), (d) => `tradeMode=${d?.tradeMode || 'updated'}`);
                    },
                },
                {
                    id: 'building-meters-count', name: 'Meter count of building', method: 'GET', path: '/buildings/:id/meters/count',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiGet(`/buildings/${ctx.buildingA.id}/meters/count`), (d) => JSON.stringify(d).slice(0, 120));
                    },
                },
                {
                    id: 'building-assignments', name: 'Building assignments', method: 'GET', path: '/buildings/:id/assignments',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiGet(`/buildings/${ctx.buildingA.id}/assignments`),
                            (d) => `${asArray(d, 'assignments').length} assignment(s)`);
                    },
                },
                {
                    id: 'building-assign', name: 'Assign user to building', method: 'POST', path: '/buildings/:id/assign',
                    run: async () => {
                        const userId = ctx.adminUserId || ctx.anyUserId;
                        if (!ctx.buildingA?.id || !userId) skip('no building or user to assign');
                        return ok(await apiPost(`/buildings/${ctx.buildingA.id}/assign`, { userId, role: 'member' }),
                            (d) => `assigned ${shortId(userId)}`);
                    },
                },
                {
                    id: 'buildings-pending', name: 'Pending buildings', method: 'GET', path: '/buildings/pending/list',
                    run: async () => ok(await apiGet('/buildings/pending/list'),
                        (d) => `${asArray(d, 'buildings').length} pending`),
                },
                {
                    id: 'building-register', name: `Register building (${C})`, method: 'POST', path: '/buildings/register',
                    run: async () => {
                        const res = await apiPost('/buildings/register', {
                            name: C,
                            address: 'E2E approval flow address',
                            province: 'Bangkok',
                            postalCode: '10240',
                            mapURL: 'https://maps.google.com/?q=13.8,100.5',
                        });
                        const out = ok(res, (d) => `building #${d?.id} created (approvalStatus=${d?.approvalStatus || 'n/a'})`);
                        ctx.buildingC = res.data?.id ? { id: res.data.id, name: res.data.name || C } : null;
                        return out;
                    },
                },
                {
                    id: 'building-approve', name: 'Approve pending building', method: 'PUT', path: '/buildings/:id/approve',
                    run: async () => {
                        if (!ctx.buildingC?.id) skip('building registration failed');
                        return ok(await apiPut(`/buildings/${ctx.buildingC.id}/approve`),
                            (d) => `status=${d?.status || d?.approvalStatus || 'approved'}`);
                    },
                },
            ],
        },

        {
            key: 'meters',
            label: '3 · Meters',
            cases: [
                {
                    id: 'meters-list', name: 'List meters', method: 'GET', path: '/meters',
                    run: async () => ok(await apiGet('/meters'), (d) => `${asArray(d, 'meters').length} meter(s)`),
                },
                {
                    id: 'meters-by-building', name: 'Meters of building', method: 'GET', path: '/meters/building/:buildingId',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiGet(`/meters/building/${ctx.buildingA.id}`),
                            (d) => `${asArray(d, 'meters').length} meter(s)`);
                    },
                },
                {
                    id: 'meter-get', name: 'Get meter by SNID', method: 'GET', path: '/meters/snid/:snid',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter from quick register');
                        return ok(await apiGet(`/meters/snid/${encodeURIComponent(snid)}`),
                            (d) => `${d?.snid} type=${d?.type} status=${d?.approveStatus}`);
                    },
                },
                {
                    id: 'meters-approved', name: 'Approved meters', method: 'GET', path: '/meters/approved',
                    run: async () => ok(await apiGet('/meters/approved'), (d) => `${asArray(d, 'meters').length} approved`),
                },
                {
                    id: 'meters-approved-building', name: 'Approved meters of building', method: 'GET', path: '/meters/approved/building/:buildingId',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiGet(`/meters/approved/building/${ctx.buildingA.id}`),
                            (d) => `${asArray(d, 'meters').length} approved`);
                    },
                },
                {
                    id: 'meters-pending', name: 'Pending meters', method: 'GET', path: '/meters/pending',
                    run: async () => ok(await apiGet('/meters/pending'), (d) => `${asArray(d, 'meters').length} pending`),
                },
                {
                    id: 'meter-register', name: 'Register meter', method: 'POST', path: '/meters/register',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        const snid = `E2E-CON-${ctx.stamp}`;
                        const res = await apiPost('/meters/register', {
                            buildingId: ctx.buildingA.id,
                            meterType: 'consumer',
                            meterNumber: snid,
                            capacity: 12,
                            dateInstalled: ctx.today,
                        });
                        const out = ok(res, (d) => `meter ${d?.snid || snid} created (approveStatus=${d?.approveStatus || 'pending'})`);
                        ctx.extraSnid = res.data?.snid || snid;
                        return out;
                    },
                },
                {
                    id: 'meter-update', name: 'Approve / update meter', method: 'PUT', path: '/meters/snid/:snid',
                    run: async () => {
                        if (!ctx.extraSnid) skip('no meter to update');
                        return ok(await apiPut(`/meters/snid/${encodeURIComponent(ctx.extraSnid)}`, { approveStatus: 'approved', capacity: 15 }),
                            (d) => `approveStatus=${d?.approveStatus || 'updated'}`);
                    },
                },
            ],
        },

        {
            key: 'energy',
            label: '4 · Energy data & charts',
            cases: [
                {
                    id: 'generate-hourly-producer', name: 'Generate hourly data — producer meter (3 days)', method: 'POST', path: '/runningMeters/generate-hourly',
                    run: async () => {
                        const snid = ctx.producerSnidA;
                        if (!snid) skip('test building has no producer meter');
                        const now = new Date();
                        const start = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
                        start.setHours(0, 0, 0, 0);
                        return ok(await apiPost('/runningMeters/generate-hourly', {
                            snid,
                            start: start.toISOString(),
                            end: now.toISOString(),
                            intervalHours: 1,
                            // fixed profile keeps the value deterministic — the seller
                            // needs real energy before an offer can be created
                            valueProfile: 'fixed',
                            profileParams: { kW: 6 },
                        }), (d) => `${d?.count ?? 0} hourly record(s)`);
                    },
                },
                {
                    id: 'generate-hourly-consumer', name: 'Generate hourly data — consumer meter (3 days)', method: 'POST', path: '/runningMeters/generate-hourly',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no consumer meter to fill');
                        const now = new Date();
                        const start = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
                        start.setHours(0, 0, 0, 0);
                        return ok(await apiPost('/runningMeters/generate-hourly', {
                            snid,
                            start: start.toISOString(),
                            end: now.toISOString(),
                            intervalHours: 1,
                            valueProfile: 'fixed',
                            profileParams: { kW: 4 },
                        }), (d) => `${d?.count ?? 0} hourly record(s)`);
                    },
                },
                {
                    id: 'logs-bulk', name: 'Insert meter logs (today)', method: 'POST', path: '/runningMeters/insert-logs-bulk',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter to fill');
                        const logs = [];
                        for (let h = 0; h < 24; h += 2) {
                            const ts = new Date();
                            ts.setHours(h, 30, 0, 0); // :30 avoids the :00 marks the mock cron writes
                            logs.push({ snid, timestamp: ts.toISOString(), kW: 4, kWH: 8 });
                        }
                        if (ctx.producerSnidA) {
                            const ts = new Date();
                            ts.setHours(12, 30, 0, 0);
                            logs.push({ snid: ctx.producerSnidA, timestamp: ts.toISOString(), kW: 6, kWH: 12 });
                        }
                        return ok(await apiPost('/runningMeters/insert-logs-bulk', { logs }),
                            (d) => `${d?.inserted ?? d?.count ?? logs.length} log(s) inserted`);
                    },
                },
                {
                    id: 'running-status', name: 'Running-meter status', method: 'GET', path: '/runningMeters/status',
                    run: async () => ok(await apiGet('/runningMeters/status'), (d) => JSON.stringify(d).slice(0, 120)),
                },
                {
                    id: 'chart-search-day', name: 'Chart source — daily aggregate', method: 'GET', path: '/dashboard/search?timeunit=day',
                    run: async () => {
                        if (!ctx.buildingA?.name) skip('no test building');
                        const start = new Date(); start.setDate(start.getDate() - 6);
                        const res = await apiGet('/dashboard/search', {
                            building: ctx.buildingA.name,
                            buildingId: ctx.buildingA.id,
                            start: dayStr(start),
                            end: ctx.today,
                            timeunit: 'day',
                        });
                        const out = ok(res, (d) => `result=${d?.result} points=${(d?.production?.value || []).length}`);
                        if (res.data?.result !== 'success') fail(`aggregate query returned result=${res.data?.result}`, res);
                        return out;
                    },
                },
                {
                    id: 'chart-search-hour', name: 'Chart source — hourly aggregate', method: 'GET', path: '/dashboard/search?timeunit=hour',
                    run: async () => {
                        if (!ctx.buildingA?.name) skip('no test building');
                        const res = await apiGet('/dashboard/search', {
                            building: ctx.buildingA.name,
                            buildingId: ctx.buildingA.id,
                            start: ctx.today,
                            end: ctx.today,
                            timeunit: 'hour',
                        });
                        const out = ok(res, (d) => `result=${d?.result} points=${(d?.production?.value || []).length}`);
                        if (res.data?.result !== 'success') fail(`hourly query returned result=${res.data?.result}`, res);
                        return out;
                    },
                },
                {
                    id: 'chart-hourly', name: 'Meter hourly series', method: 'GET', path: '/dashboard/hourly',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter');
                        return ok(await apiGet('/dashboard/hourly', { meterId: snid, date: ctx.today }),
                            (d) => `${(d?.labels || d?.value || []).length} point(s)`);
                    },
                },
                {
                    id: 'chart-daily', name: 'Meter daily series', method: 'GET', path: '/dashboard/daily',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter');
                        return ok(await apiGet('/dashboard/daily', { meterId: snid, monthId: ctx.month, year: ctx.year }),
                            (d) => `${(d?.labels || d?.value || []).length} point(s)`);
                    },
                },
                {
                    id: 'chart-weekly', name: 'Meter weekly series', method: 'GET', path: '/dashboard/weekly',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter');
                        return ok(await apiGet('/dashboard/weekly', { meterId: snid }),
                            (d) => `${(d?.labels || d?.value || []).length} point(s)`);
                    },
                },
                {
                    id: 'chart-monthly', name: 'Meter monthly series', method: 'GET', path: '/dashboard/monthly',
                    run: async () => {
                        const snid = ctx.consumerSnidA || ctx.snidsA[0];
                        if (!snid) skip('no meter');
                        return ok(await apiGet('/dashboard/monthly', { meterId: snid, year: ctx.year }),
                            (d) => `${(d?.labels || d?.value || []).length} point(s)`);
                    },
                },
                {
                    id: 'chart-gaps', name: 'Gap bar data (silence)', method: 'GET', path: '/dashboard/gaps',
                    run: async () => {
                        const snids = ctx.snidsA.filter(Boolean);
                        if (!snids.length) skip('no meters');
                        const from = new Date(); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0);
                        const to = new Date(); to.setHours(24, 0, 0, 0);
                        return ok(await apiGet('/dashboard/gaps', {
                            meterIds: snids.join(','),
                            from: from.toISOString(),
                            to: to.toISOString(),
                            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        }), (d) => `${asArray(d, 'data', 'gaps').length} gap(s)`);
                    },
                },
                {
                    id: 'meters-produce', name: 'Producer meters (system)', method: 'GET', path: '/dashboard/getAllProduceMeters',
                    run: async () => ok(await apiGet('/dashboard/getAllProduceMeters'), (d) => `${asArray(d, 'meters').length} meter(s)`),
                },
                {
                    id: 'meters-consume', name: 'Consumer meters (system)', method: 'GET', path: '/dashboard/getAllConsumeMeters',
                    run: async () => ok(await apiGet('/dashboard/getAllConsumeMeters'), (d) => `${asArray(d, 'meters').length} meter(s)`),
                },
                {
                    id: 'meters-battery', name: 'Battery meters (system)', method: 'GET', path: '/dashboard/getAllBatteryMeters',
                    run: async () => ok(await apiGet('/dashboard/getAllBatteryMeters'), (d) => `${asArray(d, 'meters').length} meter(s)`),
                },
            ],
        },

        {
            key: 'wallet',
            label: '5 · Wallet & top-up',
            cases: [
                {
                    id: 'wallets-list', name: 'List wallets', method: 'GET', path: '/wallets',
                    run: async () => ok(await apiGet('/wallets'), (d) => `${asArray(d, 'wallets').length} wallet(s)`),
                },
                {
                    id: 'wallet-by-building', name: 'Wallet of building', method: 'GET', path: '/wallets/by-building/:buildingId',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        const res = await apiGet(`/wallets/by-building/${ctx.buildingA.id}`);
                        const out = ok(res, (d) => `wallet ${shortId(d?.id)} balance=${d?.tokenBalance ?? d?.balance ?? 0}`);
                        ctx.walletA = { id: res.data?.id, balance: Number(res.data?.tokenBalance ?? res.data?.balance ?? 0) };
                        return out;
                    },
                },
                {
                    id: 'wallet-by-building-b', name: 'Wallet of second building', method: 'GET', path: '/wallets/by-building/:buildingId',
                    run: async () => {
                        if (!ctx.buildingB?.id) skip('no second building');
                        const res = await apiGet(`/wallets/by-building/${ctx.buildingB.id}`);
                        const out = ok(res, (d) => `balance=${d?.tokenBalance ?? d?.balance ?? 0}`);
                        ctx.walletB = { id: res.data?.id, balance: Number(res.data?.tokenBalance ?? res.data?.balance ?? 0) };
                        return out;
                    },
                },
                {
                    id: 'wallet-balance', name: 'Wallet balance', method: 'GET', path: '/wallets/:walletId/balance',
                    run: async () => {
                        if (!ctx.walletA?.id) skip('no test wallet');
                        return ok(await apiGet(`/wallets/${ctx.walletA.id}/balance`), (d) => `balance=${d?.balance ?? d?.tokenBalance ?? 0}`);
                    },
                },
                {
                    id: 'wallet-topup', name: 'Top-up building wallet', method: 'POST', path: '/wallets/by-building/:buildingId/topup',
                    run: async () => {
                        if (!ctx.buildingA?.id) skip('no test building');
                        return ok(await apiPost(`/wallets/by-building/${ctx.buildingA.id}/topup`, { amount: 500, snid: ctx.consumerSnidA || undefined }),
                            (d) => `+500 tokens (balance=${d?.tokenBalance ?? d?.balance ?? 'ok'})`);
                    },
                },
                {
                    id: 'wallet-transactions', name: 'Wallet transactions', method: 'GET', path: '/wallets/:walletId/transactions',
                    run: async () => {
                        if (!ctx.walletA?.id) skip('no test wallet');
                        return ok(await apiGet(`/wallets/${ctx.walletA.id}/transactions`),
                            (d) => `${asArray(d, 'transactions', 'walletTx').length} entry(ies)`);
                    },
                },
            ],
        },

        {
            key: 'market',
            label: '6 · Market & trading',
            cases: [
                {
                    id: 'offer-create', name: 'Create sell offer', method: 'POST', path: '/market/orders (side=OFFER)',
                    run: async () => {
                        const walletId = ctx.walletA?.id;
                        if (!walletId) skip('no seller wallet');
                        const res = await apiPost('/market/orders', {
                            side: 'OFFER',
                            walletId,
                            kwh: 5,
                            price: 3.9, // IntraDay window is ฿3.85–฿4.00
                            marketType: 'INTRADAY',
                            sourceType: 'produce',
                        });
                        const out = ok(res, (d) => `order ${shortId(d?.id || d?.order?.id)} for 5 kWh @ ฿3.90`);
                        ctx.offerOrderId = res.data?.id || res.data?.order?.id || null;
                        return out;
                    },
                },
                {
                    id: 'bid-create', name: 'Create buy bid', method: 'POST', path: '/market/orders (side=BID)',
                    run: async () => {
                        const walletId = ctx.walletB?.id;
                        if (!walletId) skip('no buyer wallet');
                        const res = await apiPost('/market/orders', {
                            side: 'BID',
                            walletId,
                            kwh: 5,
                            price: 4,
                            marketType: 'INTRADAY',
                        });
                        const out = ok(res, (d) => `order ${shortId(d?.id || d?.order?.id)} for 5 kWh @ ฿4.00`);
                        ctx.bidOrderId = res.data?.id || res.data?.order?.id || null;
                        return out;
                    },
                },
                {
                    id: 'market-orders', name: 'Market order book', method: 'GET', path: '/market/orders',
                    run: async () => ok(await apiGet('/market/orders'),
                        (d) => `${(d?.orders || []).length} order(s) (offers+bids)`),
                },
                {
                    id: 'offers-legacy', name: 'Legacy offers list', method: 'GET', path: '/offers',
                    run: async () => ok(await apiGet('/offers'), (d) => `${asArray(d, 'offers').length} offer(s)`),
                },
                {
                    id: 'bids-legacy', name: 'Legacy bids list', method: 'GET', path: '/offers/bids',
                    run: async () => ok(await apiGet('/offers/bids'), (d) => `${asArray(d, 'bids').length} bid(s)`),
                },
                {
                    id: 'market-purchase', name: 'Buy energy from an offer (invoice flow)', method: 'POST', path: '/invoices/purchase',
                    run: async () => {
                        if (!ctx.offerOrderId || !ctx.walletB?.id || !ctx.buildingB?.id) skip('no offer/buyer from earlier steps');
                        return ok(await apiPost('/invoices/purchase', {
                            offerId: ctx.offerOrderId,
                            buyerWalletId: ctx.walletB.id,
                            targetBuildingId: ctx.buildingB.id,
                            amount: 5,
                        }), (d) => `purchased 5 kWh (${d?.invoice?.id ? `bill ${String(d.invoice.id).slice(0, 8)}…` : 'recorded'})`);
                    },
                },
                {
                    id: 'market-sell-to-bid', name: 'Sell energy into a bid', method: 'POST', path: '/market/sell-to-bid',
                    run: async () => {
                        if (!ctx.bidOrderId || !ctx.walletA?.id) skip('no bid/seller from earlier steps');
                        return ok(await apiPost('/market/sell-to-bid', {
                            orderId: ctx.bidOrderId,
                            sellerWalletId: ctx.walletA.id,
                            kwh: 3,
                            price: 4,
                            sourceType: 'produce',
                        }), (d) => `delivered 3 kWh (${d?.monthlyBill?.id ? `bill ${String(d.monthlyBill.id).slice(0, 8)}…` : 'recorded'})`);
                    },
                },
                {
                    id: 'market-trigger-matching', name: 'Run market matching', method: 'POST', path: '/market/trigger-matching',
                    run: async () => ok(await apiPost('/market/trigger-matching', {}), (d) => JSON.stringify(d).slice(0, 140)),
                },
                {
                    id: 'market-matches', name: 'Market matches', method: 'GET', path: '/market/matches',
                    run: async () => ok(await apiGet('/market/matches'), (d) => `${asArray(d, 'matches').length} match(es)`),
                },
                {
                    id: 'transactions', name: 'Transaction ledger', method: 'GET', path: '/transactions',
                    run: async () => ok(await apiGet('/transactions'), (d) => `${asArray(d, 'transactions').length} transaction(s)`),
                },
            ],
        },

        {
            key: 'billing',
            label: '7 · Invoice & receipt',
            cases: [
                {
                    id: 'invoice-generate', name: 'Generate monthly invoice', method: 'POST', path: '/invoices/generate',
                    run: async () => {
                        if (!ctx.buildingA?.name) skip('no test building');
                        return ok(await apiPost('/invoices/generate', {
                            month: ctx.month,
                            year: ctx.year,
                            buildingName: ctx.buildingA.name,
                        }), (d) => `created=${d?.createdCount ?? 0} existing=${d?.existingCount ?? 0} skipped=${d?.skippedCount ?? 0}`);
                    },
                },
                {
                    id: 'invoice-summary', name: 'Invoice summary', method: 'GET', path: '/invoices/summary',
                    run: async () => ok(await apiGet('/invoices/summary', { month: ctx.month, year: ctx.year }),
                        (d) => JSON.stringify(d).slice(0, 120)),
                },
                {
                    id: 'invoice-quota', name: 'Quota warnings', method: 'GET', path: '/invoices/quota-warnings',
                    run: async () => ok(await apiGet('/invoices/quota-warnings', { month: ctx.month, year: ctx.year }),
                        (d) => `${asArray(d, 'warnings').length} warning(s)`),
                },
                {
                    id: 'invoice-list', name: 'Invoice list', method: 'GET', path: '/invoices',
                    run: async () => {
                        const res = await apiGet('/invoices', { month: ctx.month, year: ctx.year });
                        const out = ok(res, (d) => `${asArray(d, 'invoices').length} invoice(s) this month`);
                        const list = asArray(res.data, 'invoices');
                        const mine = list.find((i) => i.buildingName === ctx.buildingA?.name) || list[0];
                        ctx.invoiceId = mine?.id || null;
                        ctx.invoiceStatus = mine?.status || null;
                        ctx.invoiceIsTestBuilding = Boolean(ctx.buildingA?.name && mine?.buildingName === ctx.buildingA.name);
                        return out;
                    },
                },
                {
                    id: 'invoice-get', name: 'Get invoice by id', method: 'GET', path: '/invoices/:id',
                    run: async () => {
                        if (!ctx.invoiceId) skip('no invoice was generated for the test building');
                        return ok(await apiGet(`/invoices/${encodeURIComponent(ctx.invoiceId)}`),
                            (d) => `${d?.status} · ${d?.tokenAmount ?? '?'} tokens`);
                    },
                },
                {
                    id: 'invoice-pay', name: 'Pay invoice (token transfer)', method: 'POST', path: '/invoices/:id/pay',
                    run: async () => {
                        if (!ctx.invoiceId) skip('no invoice to pay');
                        if (String(ctx.invoiceStatus || '').toLowerCase() === 'paid') skip('invoice already paid');
                        return ok(await apiPost(`/invoices/${encodeURIComponent(ctx.invoiceId)}/pay`),
                            (d) => `paid · ${d?.invoice?.status || d?.status || 'ok'}${d?.receipt?.id ? ` · receipt ${shortId(d.receipt.id)}` : ''}`);
                    },
                },
                {
                    id: 'receipts-list', name: 'Receipt list', method: 'GET', path: '/receipts',
                    run: async () => {
                        const res = await apiGet('/receipts');
                        const out = ok(res, (d) => `${asArray(d, 'receipts').length} receipt(s)`);
                        const list = asArray(res.data, 'receipts');
                        const mine = list.find((r) => r.buildingName === ctx.buildingA?.name) || list[0];
                        ctx.receiptId = mine?.id || mine?.receiptId || null;
                        return out;
                    },
                },
                {
                    id: 'receipt-get', name: 'Get receipt by id', method: 'GET', path: '/receipts/:id',
                    run: async () => {
                        if (!ctx.receiptId) skip('no receipt available');
                        return ok(await apiGet(`/receipts/${encodeURIComponent(ctx.receiptId)}`),
                            (d) => `receipt ${shortId(d?.id || ctx.receiptId)} ok`);
                    },
                },
            ],
        },

        {
            key: 'system',
            label: '8 · System & settings',
            cases: [
                {
                    id: 'rates-energy', name: 'Energy rate rules', method: 'GET', path: '/rates/energy',
                    run: async () => ok(await apiGet('/rates/energy'), (d) => `${asArray(d, 'rates').length} rule(s)`),
                },
                {
                    id: 'rates-token', name: 'Token rate rules', method: 'GET', path: '/rates/token',
                    run: async () => ok(await apiGet('/rates/token'), (d) => `${asArray(d, 'rates').length} rule(s)`),
                },
                {
                    id: 'settings-notification', name: 'Notification settings', method: 'GET', path: '/settings/notification',
                    run: async () => ok(await apiGet('/settings/notification'), (d) => `emailEnabled=${d?.emailEnabled ?? d?.notificationEmail ?? 'n/a'}`),
                },
                {
                    id: 'policy', name: 'Policy settings', method: 'GET', path: '/settings/policy',
                    run: async () => ok(await apiGet('/settings/policy'), (d) => JSON.stringify(d).slice(0, 120)),
                },
                {
                    id: 'system-notifications', name: 'System notifications (admin)', method: 'GET', path: '/system/notifications',
                    run: async () => ok(await apiGet('/system/notifications'), (d) => `${asArray(d, 'notifications').length} announcement(s)`),
                },
                {
                    id: 'user-notifications', name: 'User notifications', method: 'GET', path: '/notifications',
                    run: async () => ok(await apiGet('/notifications'), (d) => `${asArray(d, 'notifications').length} notification(s)`),
                },
                {
                    id: 'energy-feed-status', name: 'Energy feed status', method: 'GET', path: '/energy-feed/status',
                    run: async () => ok(await apiGet('/energy-feed/status'), (d) => JSON.stringify(d).slice(0, 120)),
                },
                {
                    id: 'energy-feed-mapping', name: 'Energy feed device mapping', method: 'GET', path: '/energy-feed/mapping',
                    run: async () => ok(await apiGet('/energy-feed/mapping'), (d) => `${Object.keys(d || {}).length} entr(ies)`),
                },
            ],
        },

        {
            key: 'cleanup',
            label: '9 · Cleanup (best effort)',
            cases: [
                {
                    id: 'cleanup-offer', name: 'Cancel test offer', method: 'PUT', path: '/market/orders/:id/cancel?side=OFFER',
                    run: optional(async () => {
                        if (!ctx.offerOrderId) skip('nothing to cancel');
                        // A consumed offer is already closed — treat both as fine.
                        const res = await apiPut(`/market/orders/${ctx.offerOrderId}/cancel?side=OFFER`, {});
                        if (!res.ok && res.status !== 404) fail(res.errorText, res);
                        return { res, detail: res.ok ? 'offer cancelled' : 'offer already gone' };
                    }),
                },
                {
                    id: 'cleanup-bid', name: 'Cancel test bid', method: 'PUT', path: '/market/orders/:id/cancel?side=BID',
                    run: optional(async () => {
                        if (!ctx.bidOrderId) skip('nothing to cancel');
                        const res = await apiPut(`/market/orders/${ctx.bidOrderId}/cancel?side=BID`, {});
                        if (!res.ok && res.status !== 404) fail(res.errorText, res);
                        return { res, detail: res.ok ? 'bid cancelled' : 'bid already gone' };
                    }),
                },
                {
                    id: 'cleanup-meter', name: 'Delete test meter', method: 'DELETE', path: '/meters/snid/:snid',
                    run: optional(async () => {
                        if (!ctx.extraSnid) skip('no extra meter');
                        return ok(await apiDelete(`/meters/snid/${encodeURIComponent(ctx.extraSnid)}`), 'meter deleted');
                    }),
                },
                {
                    id: 'cleanup-building-c', name: 'Delete approval-flow building', method: 'DELETE', path: '/buildings/:id?force=true',
                    run: optional(async () => {
                        if (!ctx.buildingC?.id) skip('no building C');
                        return ok(await apiDelete(`/buildings/${ctx.buildingC.id}?force=true`), 'building + related records deleted');
                    }),
                },
                {
                    id: 'cleanup-building-b', name: 'Delete test building B', method: 'DELETE', path: '/buildings/:id?force=true',
                    run: optional(async () => {
                        if (!ctx.buildingB?.id) skip('no building B');
                        return ok(await apiDelete(`/buildings/${ctx.buildingB.id}?force=true`), 'building + related records deleted');
                    }),
                },
                {
                    id: 'cleanup-building-a', name: 'Delete test building A', method: 'DELETE', path: '/buildings/:id?force=true',
                    run: optional(async () => {
                        if (!ctx.buildingA?.id) skip('no building A');
                        return ok(await apiDelete(`/buildings/${ctx.buildingA.id}?force=true`), 'building + related records deleted');
                    }),
                },
            ],
        },
    ];

    return phases;
}

/**
 * Build one run: shared context + the phases and the flat, ordered case list.
 * The page renders `phases` (so pending steps are visible) and feeds `cases`
 * to `runCases`.
 */
export function createRun({ adminPassword, stamp } = {}) {
    const ctx = createTestContext({ adminPassword, stamp });
    const phases = buildApiTestPhases(ctx);
    const cases = phases.flatMap((phase) => phase.cases.map((c) => ({ ...c, phase: phase.label, phaseKey: phase.key })));
    return { ctx, phases, cases };
}

/**
 * Run every case in order (stops after the current step when cancelled).
 *
 * @param {Object} options
 * @param {Object} options.ctx             from createRun
 * @param {Array}  options.cases           from createRun
 * @param {(r)=>void} [options.onResult]   called after each case with the result
 * @param {(p)=>void} [options.onProgress] { done, total, index, case, phase }
 * @param {()=>boolean} [options.shouldCancel]
 * @returns {Promise<{results:Array, summary:Object}>}
 */
export async function runCases({ ctx, cases = [], onResult, onProgress, shouldCancel } = {}) {
    setApiTestToken(null); // start from the session token; admin-login swaps it in
    const total = cases.length;
    const results = [];
    const startedAt = Date.now();
    let done = 0;

    for (const testCase of cases) {
        const cancelled = Boolean(shouldCancel?.());
        let outcome = { status: 'skip', detail: cancelled ? 'cancelled' : 'skipped (run stopped)', httpStatus: null, ms: 0 };

        onProgress?.({ done, total, index: done + 1, case: testCase, phase: testCase.phase });

        if (!cancelled) {
            const t0 = Date.now();
            try {
                const out = await testCase.run(ctx);
                outcome = {
                    status: out?.warned ? 'warn' : 'pass',
                    detail: out?.detail || 'ok',
                    httpStatus: out?.res?.status ?? null,
                    ms: out?.res?.ms ?? (Date.now() - t0),
                };
            } catch (err) {
                if (err instanceof TestSkip) {
                    outcome = { status: 'skip', detail: err.message, httpStatus: err.res?.status ?? null, ms: Date.now() - t0 };
                } else {
                    outcome = {
                        status: 'fail',
                        detail: err?.res?.errorText || err?.message || 'failed',
                        httpStatus: err?.res?.status ?? null,
                        ms: err?.res?.ms ?? (Date.now() - t0),
                    };
                }
            }
        }

        const result = { ...testCase, ...outcome };
        results.push(result);
        onResult?.(result);
        done += 1;
        onProgress?.({ done, total, index: done, case: testCase, phase: testCase.phase, result });
    }

    const summary = {
        total,
        passed: results.filter((r) => r.status === 'pass').length,
        failed: results.filter((r) => r.status === 'fail').length,
        skipped: results.filter((r) => r.status === 'skip').length,
        warned: results.filter((r) => r.status === 'warn').length,
        elapsedMs: Date.now() - startedAt,
        failures: results.filter((r) => r.status === 'fail'),
    };

    return { results, summary };
}

/** Convenience wrapper: build a run and execute it in one call. */
export async function runApiTestSuite(options = {}) {
    const { ctx, cases } = createRun(options);
    const { results, summary } = await runCases({ ...options, ctx, cases });
    return { results, ctx, summary };
}
