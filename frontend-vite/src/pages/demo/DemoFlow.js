import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiBase } from '../../core/data_connecter/apiBase';

const API = getApiBase();

const BUILDINGS = ['Ratchaphruek', 'Malai', 'Auditorium', 'Nida Sumpan'];
const COLORS = ['#2d7dd2', '#f59e0b', '#10b981', '#8b5cf6'];

function DemoFlow() {
  const [data, setData] = useState({ buildings: [], offers: [], bids: [], matches: [], transactions: [] });
  const [autoPlay, setAutoPlay] = useState(true);
  const [tick, setTick] = useState(0);
  const [cycleResult, setCycleResult] = useState(null);
  const [cycleRunning, setCycleRunning] = useState(false);
  const [animationStep, setAnimationStep] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, mRes, oRes, tRes] = await Promise.allSettled([
        axios.get(`${API}/buildings`),
        axios.get(`${API}/market/orders`),
        axios.get(`${API}/offers`),
        axios.get(`${API}/transactions`),
      ]);
      const buildings = bRes.status === 'fulfilled' ? (bRes.value.data || []) : [];
      const orders = mRes.status === 'fulfilled' ? (mRes.value.data?.orders || []) : [];
      const offers = oRes.status === 'fulfilled' ? (oRes.value.data || []) : [];
      const transactions = tRes.status === 'fulfilled' ? (tRes.value.data || []) : [];
      const bids = orders.filter(o => o.side === 'BID');
      setData({ buildings, offers, bids: orders.filter(o => o.side === 'BID'), matches: [], transactions });
    } catch (e) { /* ignore */ }
  }, []);

  const triggerCycle = async () => {
    setCycleRunning(true);
    setAnimationStep(1);
    try {
      const res = await axios.post(`${API}/demo/cycle`);
      setCycleResult(res.data);
      // Animate steps
      const steps = res.data?.cycle?.length || 0;
      for (let i = 2; i <= steps; i++) {
        await new Promise(r => setTimeout(r, 1000));
        setAnimationStep(i);
      }
    } catch (e) {
      console.error('Demo cycle error:', e);
    } finally {
      setCycleRunning(false);
      fetchData();
    }
  };

  useEffect(() => {
    fetchData();
    if (!autoPlay) return;
    const interval = setInterval(() => { setTick(t => t + 1); fetchData(); }, 3000);
    return () => clearInterval(interval);
  }, [autoPlay, fetchData]);

  const demoBuildings = data.buildings.length >= 4 ? data.buildings.slice(0, 4) : BUILDINGS.map((name, i) => ({
    name,
    id: i + 1,
    energy: (Math.random() * 500 + 500).toFixed(0),
    tokens: (Math.random() * 10000 + 5000).toFixed(0),
  }));

  // Simulate flows between buildings
  const flows = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (Math.random() > 0.5) {
        flows.push({ from: i, to: j, kwh: (Math.random() * 50 + 10).toFixed(0), tokens: (Math.random() * 200 + 50).toFixed(0) });
      }
    }
  }

  const positions = [
    { x: '10%', y: '15%' },   // top-left: Ratchaphruek
    { x: '75%', y: '15%' },   // top-right: Malai
    { x: '10%', y: '65%' },   // bottom-left: Auditorium
    { x: '75%', y: '65%' },   // bottom-right: Nida Sumpan
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 20, fontFamily: 'monospace' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#38bdf8' }}>⚡ NIDA Energy & Token Flow</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>Live Demo Visualization — Real-time Energy Trading Network</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Auto-refresh {autoPlay ? 'ON ⏱' : 'OFF'}</span>
          <button onClick={() => setAutoPlay(!autoPlay)} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: autoPlay ? '#ef4444' : '#10b981', color: '#fff',
            fontWeight: 700, cursor: 'pointer', fontSize: 12,
          }}>
            {autoPlay ? '⏸ PAUSE' : '▶ PLAY'}
          </button>
          <button onClick={fetchData} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid #334155',
            background: '#1e293b', color: '#38bdf8', fontWeight: 700, cursor: 'pointer', fontSize: 12,
          }}>🔄 Refresh</button>
          <button onClick={triggerCycle} disabled={cycleRunning} style={{
            padding: '8px 20px', borderRadius: 10, border: 'none',
            background: cycleRunning ? '#fbbf2444' : '#f59e0b',
            color: cycleRunning ? '#92400e' : '#fff',
            fontWeight: 900, cursor: cycleRunning ? 'wait' : 'pointer',
            fontSize: 13, boxShadow: '0 0 20px #f59e0b44',
          }}>
            {cycleRunning ? `⏳ Market Clearing... Step ${animationStep}` : '⚡ TRIGGER MARKET CYCLE'}
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)', background: '#1e293b', borderRadius: 16, overflow: 'hidden', border: '1px solid #334155' }}>
        {/* Grid background */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.3 }} />

        {/* Energy flows (animated lines) */}
        {flows.map((flow, idx) => {
          const from = positions[flow.from];
          const to = positions[flow.to];
          return (
            <svg key={`flow-${idx}-${tick % 3}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <defs>
                <marker id={`arrow-${idx}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" opacity="0.7" />
                </marker>
              </defs>
              <line
                x1={`calc(${from.x} + 60px)`} y1={`calc(${from.y} + 60px)`}
                x2={`calc(${to.x} + 60px)`} y2={`calc(${to.y} + 60px)`}
                stroke="#fbbf24" strokeWidth="2" strokeDasharray="8,4"
                opacity="0.5" markerEnd={`url(#arrow-${idx})`}
              >
                <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
              </line>
            </svg>
          );
        })}

        {/* Building Nodes */}
        {demoBuildings.map((b, i) => {
          const pos = positions[i];
          const hasBattery = i === 0 || i === 1;
          const batteryPct = Math.floor(Math.random() * 40 + 60);
          return (
            <div key={b.name} style={{
              position: 'absolute', left: pos.x, top: pos.y,
              width: 200, background: '#0f172a', borderRadius: 14,
              border: `2px solid ${COLORS[i]}`, padding: '14px 16px',
              boxShadow: `0 0 20px ${COLORS[i]}33`,
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[i], boxShadow: `0 0 8px ${COLORS[i]}` }} />
                <span style={{ fontWeight: 900, fontSize: 15, color: '#f1f5f9' }}>{b.name || `Building ${i + 1}`}</span>
              </div>

              {/* Energy meters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>☀️ Solar</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fbbf24' }}>{(Math.random() * 200 + 100).toFixed(0)}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>kWh</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>🏠 Load</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{(Math.random() * 150 + 50).toFixed(0)}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>kWh</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>🔋 Bat</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{batteryPct}%</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>{(1000 * batteryPct / 100).toFixed(0)} kWh</div>
                </div>
              </div>

              {/* Wallet */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#1e293b', borderRadius: 8, border: '1px solid #334155' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>💰 Wallet</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>{b.tokens || Math.floor(Math.random() * 10000 + 5000)} TK</span>
              </div>

              {/* Trade indicators */}
              <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
                {data.offers.filter(o => o.sellerWalletId && (i === 0 ? o.sellerWalletId === '1' : i === 1 ? o.sellerWalletId === '2' : false)).length > 0 && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>📤 Offer active</span>
                )}
                {data.bids.filter(bid => bid.buyerWalletId && (i === 2 ? bid.buyerWalletId === '3' : i === 3 ? bid.buyerWalletId === '4' : false)).length > 0 && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>📥 Bid active</span>
                )}
                {batteryPct > 80 && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>⚡ Surplus</span>
                )}
                {batteryPct < 50 && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>🔴 Low</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8' }}>
          <span>── ⚡ Energy flow</span>
          <span>── 💰 Token flow</span>
          <span>☀️ Solar | 🏠 Load | 🔋 Battery</span>
        </div>

        {/* Central Market Hub */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle, #fbbf2433, #fbbf2408)',
          border: '3px solid #fbbf24', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', zIndex: 5,
          boxShadow: '0 0 40px #fbbf2444',
        }}>
          <div style={{ fontSize: 22 }}>🏪</div>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#fbbf24' }}>MARKET</div>
          <div style={{ fontSize: 9, color: '#94a3b8' }}>{(data.offers.length || 3)} offers</div>
        </div>
      </div>

      {/* Bottom stats bar */}
      <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: '#64748b' }}>
        <span>🔄 Last refresh: {new Date().toLocaleTimeString()}</span>
        <span>📊 Active Offers: <b style={{ color: '#fbbf24' }}>{data.offers.length || 0}</b></span>
        <span>📥 Active Bids: <b style={{ color: '#38bdf8' }}>{data.bids.length || 0}</b></span>
        <span>🤝 Matches: <b style={{ color: '#10b981' }}>{data.matches.length || 0}</b></span>
        <span>📝 Transactions: <b style={{ color: '#8b5cf6' }}>{data.transactions.length || 0}</b></span>
      </div>

      {/* Cycle Result */}
      {cycleResult && (
        <div style={{ marginTop: 8, padding: '10px 16px', background: '#1e293b', borderRadius: 10, border: '1px solid #f59e0b44', display: 'flex', gap: 20, fontSize: 12, color: '#94a3b8' }}>
          <span style={{ color: '#fbbf24', fontWeight: 700 }}>✅ Cycle Complete</span>
          <span>Offers: <b style={{ color: '#fbbf24' }}>{cycleResult.summary.offersCreated}</b></span>
          <span>Bids: <b style={{ color: '#38bdf8' }}>{cycleResult.summary.bidsCreated}</b></span>
          <span>Matches: <b style={{ color: '#10b981' }}>{cycleResult.summary.matchesFound}</b></span>
          <span>Trades: <b style={{ color: '#8b5cf6' }}>{cycleResult.summary.trades}</b></span>
          {cycleResult.cycle?.map((s, i) => (
            <span key={i} style={{ color: animationStep > i ? '#10b981' : '#334155' }}>
              {animationStep > i ? '✅' : '⏳'} Step {s.step}: {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default DemoFlow;
