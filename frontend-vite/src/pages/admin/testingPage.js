import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiBase } from '../../core/data_connecter/apiBase';

const API = getApiBase();

function LogLine({ log }) {
    const cls = log.error ? 'text-red-400' : log.ok ? 'text-emerald-300' : 'text-slate-400';
    const icon = log.error ? '✕' : log.ok ? '✓' : ' ';
    return <div className={`${cls} font-mono text-xs py-0.5`}>{icon} {log.msg}</div>;
}

export default function TestingPage() {
    const [logs, setLogs] = useState({});
    const [loading, setLoading] = useState(null);
    const [state, setState] = useState({ offers: 0, bids: 0, orders: 0, matches: 0 });

    const addLog = (marketKey, msg, status) => setLogs(prev => ({
        ...prev,
        [marketKey]: [...(prev[marketKey] || []), { msg, error: status === 'error', ok: status === 'ok' }],
    }));

    const clearLogs = (marketKey) => setLogs(prev => ({ ...prev, [marketKey]: [] }));

    const run = async (marketKey, label, fn) => {
        setLoading(label);
        addLog(marketKey, `▶ ${label}`, '');
        try {
            const result = await fn();
            addLog(marketKey, `  OK: ${JSON.stringify(result?.data || result).slice(0, 800)}`, 'ok');
            return result;
        } catch (e) {
            addLog(marketKey, `  FAIL: ${e?.response?.data?.error || e.message}`, 'error');
        } finally {
            setLoading(null);
            refreshState();
        }
    };

    const refreshState = async () => {
        try {
            const [o, b, ord, m] = await Promise.all([
                axios.get(`${API}/offers`).catch(() => ({ data: [] })),
                axios.get(`${API}/offers/bids`).catch(() => ({ data: [] })),
                axios.get(`${API}/market/orders`).catch(() => ({ data: [] })),
                axios.get(`${API}/market/matches`).catch(() => ({ data: [] })),
            ]);
            setState({ offers: o.data?.length || 0, bids: b.data?.length || 0, orders: ord.data?.length || 0, matches: m.data?.length || 0 });
        } catch {}
    };

    useEffect(() => { refreshState(); }, []);

    const findBuildingWallet = async (name) => {
        const b = await axios.get(`${API}/buildings`);
        const { data: wallets } = await axios.get(`${API}/wallets`);
        const building = (Array.isArray(b.data) ? b.data : []).find(x => x.name === name);
        if (!building) throw new Error(`${name} not found`);
        const wallet = wallets.find(w => w.email === building.email);
        if (!wallet) throw new Error(`${name} wallet not found`);
        return wallet;
    };

    const dayAhead = {
        label: '🌅 Day-Ahead Market',
        groups: [
            {
                group: 'Offer Energy',
                items: [
                    { label: 'Malai 200kWh @ ฿3.60', fn: async () => {
                        const w = await findBuildingWallet('Malai');
                        const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
                        return axios.post(`${API}/offers`, { sellerWalletId: w.id, kwh: 200, ratePerKwh: 3.6, sourceType: 'produce', marketType: 'DAY_AHEAD', trigger: 'manual', bypassLock: 'admin123', targetDate: d.toISOString() });
                    }},
                    { label: 'Ratchaphruek 150kWh @ ฿3.55', fn: async () => {
                        const w = await findBuildingWallet('Ratchaphruek');
                        const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
                        return axios.post(`${API}/offers`, { sellerWalletId: w.id, kwh: 150, ratePerKwh: 3.55, sourceType: 'produce', marketType: 'DAY_AHEAD', trigger: 'manual', bypassLock: 'admin123', targetDate: d.toISOString() });
                    }},
                ],
            },
            {
                group: 'Bid Energy',
                items: [
                    { label: 'Nidasumpan 80kWh @ ฿3.85', fn: async () => {
                        const w = await findBuildingWallet('Nidasumpan');
                        const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
                        return axios.post(`${API}/offers/bids`, { buyerWalletId: w.id, kwh: 80, ratePerKwh: 3.85, marketType: 'DAY_AHEAD', bypassLock: 'admin123', targetDate: d.toISOString() });
                    }},
                    { label: 'Navamin 60kWh @ ฿3.75', fn: async () => {
                        const w = await findBuildingWallet('Navamin');
                        const d = new Date(); d.setDate(d.getDate()+1); d.setHours(0,0,0,0);
                        return axios.post(`${API}/offers/bids`, { buyerWalletId: w.id, kwh: 60, ratePerKwh: 3.75, marketType: 'DAY_AHEAD', bypassLock: 'admin123', targetDate: d.toISOString() });
                    }},
                ],
            },
            {
                group: 'Actions',
                items: [
                    { label: '▶ Run Clearing', fn: () => axios.post(`${API}/market/trigger-clearing`, { bypassLock: 'admin123' }) },
                ],
            },
        ],
    };

    const intraday = {
        label: '⚡ Intraday Market',
        groups: [
            {
                group: 'Offer Energy',
                items: [
                    { label: 'Malai 100kWh @ ฿4.00', fn: async () => {
                        const w = await findBuildingWallet('Malai');
                        return axios.post(`${API}/offers`, { sellerWalletId: w.id, kwh: 100, ratePerKwh: 4.0, sourceType: 'produce', marketType: 'INTRADAY', trigger: 'manual' });
                    }},
                    { label: 'Ratchaphruek 80kWh @ ฿3.90', fn: async () => {
                        const w = await findBuildingWallet('Ratchaphruek');
                        return axios.post(`${API}/offers`, { sellerWalletId: w.id, kwh: 80, ratePerKwh: 3.90, sourceType: 'produce', marketType: 'INTRADAY', trigger: 'manual' });
                    }},
                ],
            },
            {
                group: 'Bid Energy',
                items: [
                    { label: 'Nidasumpan 50kWh @ ฿4.00', fn: async () => {
                        const w = await findBuildingWallet('Nidasumpan');
                        return axios.post(`${API}/offers/bids`, { buyerWalletId: w.id, kwh: 50, ratePerKwh: 4.0, marketType: 'INTRADAY' });
                    }},
                    { label: 'Navamin 40kWh @ ฿4.20', fn: async () => {
                        const w = await findBuildingWallet('Navamin');
                        return axios.post(`${API}/offers/bids`, { buyerWalletId: w.id, kwh: 40, ratePerKwh: 4.20, marketType: 'INTRADAY' });
                    }},
                ],
            },
            {
                group: 'Actions',
                items: [
                    { label: 'P2P Match (highest bid wins)', fn: async () => {
                        const bRes = await axios.get(`${API}/offers/bids`);
                        const oRes = await axios.get(`${API}/offers`);
                        const bids = (bRes.data || []).filter(b => b.status === 'OPEN');
                        const offers = (oRes.data || []).filter(o => o.status === 'AVAILABLE');
                        if (bids.length === 0) throw new Error('No open bids');
                        if (offers.length === 0) throw new Error('No available offers');
                        // Highest bid price wins
                        bids.sort((a, b) => (b.ratePerkWH || 0) - (a.ratePerkWH || 0));
                        const bestBid = bids[0];
                        // Cheapest matching offer
                        const matchOffer = offers.find(o => (o.ratePerkWH || 999) <= (bestBid.ratePerkWH || 0));
                        if (!matchOffer) throw new Error(`No offer with price ≤ bid ${bestBid.ratePerkWH}`);
                        return axios.post(`${API}/market/sell-to-bid`, { orderId: bestBid.id, sellerWalletId: matchOffer.sellerWalletId, kwh: Math.min(20, bestBid.kWH - (bestBid.kWHBought || 0)) });
                    }},
                    { label: 'Auto-Trade (Malai)', fn: () => axios.post(`${API}/offers/run-auto`, { buildingName: 'Malai' }) },
                ],
            },
        ],
    };

    const modeTesting = {
        label: '🧪 Mode Testing',
        groups: [
            {
                group: '☀️ Solar Modes (Malai)',
                items: [
                    { label: 'Solar: AUTO_BATTERY_THRESHOLD', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Malai');
                        await axios.put(`${API}/buildings/${b.id}`, { solarTradeMode: 'AUTO_BATTERY_THRESHOLD', solarSelfPercent: 80, solarOfferPrice: 3.8 });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Malai' })).data;
                    }},
                    { label: 'Solar: SELF_CONSUME', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Malai');
                        await axios.put(`${API}/buildings/${b.id}`, { solarTradeMode: 'SELF_CONSUME' });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Malai' })).data;
                    }},
                    { label: 'Solar: MANUAL', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Malai');
                        await axios.put(`${API}/buildings/${b.id}`, { solarTradeMode: 'MANUAL' });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Malai' })).data;
                    }},
                ],
            },
            {
                group: '🔋 Battery Modes (Nidasumpan)',
                items: [
                    { label: 'Battery: AUTO_BATTERY_THRESHOLD', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Nidasumpan');
                        await axios.put(`${API}/buildings/${b.id}`, { batteryTradeMode: 'AUTO_BATTERY_THRESHOLD', batterySellThreshold: 80, batteryOfferPrice: 4.0, batteryBidPrice: 3.9 });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Nidasumpan' })).data;
                    }},
                    { label: 'Battery: SELF_CONSUME', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Nidasumpan');
                        await axios.put(`${API}/buildings/${b.id}`, { batteryTradeMode: 'SELF_CONSUME' });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Nidasumpan' })).data;
                    }},
                    { label: 'Battery: MANUAL', fn: async () => {
                        const b = (await axios.get(`${API}/buildings`)).data.find(x => x.name === 'Nidasumpan');
                        await axios.put(`${API}/buildings/${b.id}`, { batteryTradeMode: 'MANUAL' });
                        return (await axios.post(`${API}/offers/run-auto`, { buildingName: 'Nidasumpan' })).data;
                    }},
                ],
            },
            {
                group: 'Verify',
                items: [
                    { label: 'Check All Offers', fn: () => axios.get(`${API}/offers`) },
                    { label: 'Check All Bids', fn: () => axios.get(`${API}/offers/bids`) },
                    { label: 'Reset All → MANUAL', fn: async () => {
                        const blds = (await axios.get(`${API}/buildings`)).data;
                        for (const name of ['Malai', 'Nidasumpan']) {
                            const b = blds.find(x => x.name === name);
                            if (b) await axios.put(`${API}/buildings/${b.id}`, { solarTradeMode: 'MANUAL', batteryTradeMode: 'MANUAL' });
                        }
                        return { reset: ['Malai', 'Nidasumpan'] };
                    }},
                ],
            },
        ],
    };

    const markets = [dayAhead, intraday, modeTesting];

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="max-w-5xl mx-auto p-6 lg:p-10">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Trading Test Suite</h1>
                    <p className="text-sm text-slate-500 mt-1">Systematic trading flow testing</p>
                </div>

                {/* Status bar */}
                <div className="flex gap-4 mb-8">
                    {[
                        { label: 'Offers', val: state.offers, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                        { label: 'Bids', val: state.bids, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
                        { label: 'Orders', val: state.orders, cls: 'bg-purple-50 border-purple-200 text-purple-700' },
                        { label: 'Matches', val: state.matches, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    ].map(s => (
                        <div key={s.label} className={`${s.cls} rounded-xl px-5 py-3 border flex items-center gap-3 flex-1`}>
                            <span className="text-2xl font-bold">{s.val}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Market rows — 1 row per market: Offer | Bid | Actions */}
                {markets.map(market => (
                    <div key={market.label} className="mb-6">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{market.label}</h2>
                        <div className="flex gap-6 items-stretch">
                            {market.groups.map(group => (
                                <div key={group.group} className="flex-1 min-w-0 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 shrink-0">{group.group}</h3>
                                    <div className="space-y-2 flex-1">
                                        {group.items.map(item => (
                                            <button
                                                key={item.label}
                                                onClick={() => run(market.label, item.label, item.fn)}
                                                disabled={!!loading}
                                                className="w-full overflow-hidden text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition text-sm font-medium text-slate-700 flex items-center gap-3"
                                            >
                                                <span className="text-lg shrink-0">{loading === item.label ? '⏳' : '▸'}</span>
                                                <span className="truncate min-w-0">{item.label}</span>
                                            </button>
                                        ))}
                                        {group.items.length < 3 && (
                                            <div className="flex-1" style={{ minHeight: (3 - group.items.length) * 52 }} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Console per market */}
                        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{market.label} · Console</span>
                                <button onClick={() => clearLogs(market.label)} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
                            </div>
                            <div className="bg-slate-900 p-4 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
                                {(logs[market.label] || []).length === 0 ? (
                                    <div className="text-slate-500">Ready — run tests above</div>
                                ) : (
                                    (logs[market.label] || []).map((l, i) => <LogLine key={i} log={l} />)
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
