import React, { useState, useEffect } from 'react';

/**
 * 24-hour Day-Ahead Market Timeline with NOW indicator.
 * Shows Closed (00-05) → Open (06-18) → Locked (18-00) phases.
 */
export default function MarketTimeline({ compact = false }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const now = new Date();
  const pct = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100;
  const phase = now.getHours() >= 6 && now.getHours() < 18
    ? '🟢 OPEN'
    : now.getHours() >= 18 || now.getHours() < 5
      ? (now.getHours() >= 18 ? '🔴 LOCKED' : '🔒 CLOSED')
      : '✅ CLEARING';
  const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const barH = compact ? 18 : 32;

  return (
    <div style={{ position: 'relative', marginBottom: compact ? 0 : 16 }}>
      {/* Time labels — hide in compact mode */}
      {!compact && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#94a3b8', marginBottom: 3, padding: '0 2px' }}>
          {['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00','24:00'].map(t => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: barH, background: '#f1f5f9', borderRadius: compact ? 4 : 8, overflow: 'visible', display: 'flex' }}>
        {/* Closed 00-05 (25%) */}
        <div style={{
          width: '25%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 7 : 10, fontWeight: 700, color: '#64748b', borderRight: '1px dashed #cbd5e1',
          borderRadius: compact ? '4px 0 0 4px' : 0,
        }}>
          {compact ? '🔒' : 'Closed'}
        </div>
        {/* Open 06-18 (50%) */}
        <div style={{
          width: '50%', background: 'linear-gradient(90deg, #dbeafe, #bbf7d0)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: compact ? 7 : 10, fontWeight: 700, color: '#1e40af',
          borderRight: '2px solid #ef4444',
        }}>
          {compact ? '🟢 Open' : '🟢 Open (Submit Bid/Offer)'}
        </div>
        {/* Locked 18-00 (25%) */}
        <div style={{
          width: '25%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 7 : 10, fontWeight: 700, color: '#991b1b',
          borderRadius: compact ? '0 4px 4px 0' : 0,
        }}>
          {compact ? '🔴' : '🔴 Locked'}
        </div>

        {/* NOW indicator */}
        <div style={{
          position: 'absolute', left: `${pct}%`, top: compact ? -4 : -6, bottom: compact ? -4 : -6,
          width: 2, background: '#ef4444', zIndex: 10,
          boxShadow: '0 0 4px #ef4444',
          transition: 'left 60s linear',
        }}>
          <div style={{
            position: 'absolute', top: compact ? -13 : -16, left: '50%', transform: 'translateX(-50%)',
            background: '#ef4444', color: '#fff', fontSize: compact ? 6 : 9, fontWeight: 900,
            padding: compact ? '0px 3px' : '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
          }}>
            ⬇ {timeLabel} {phase}
          </div>
        </div>
      </div>

      {/* Legend — hide in compact mode */}
      {!compact && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 10, color: '#475569', flexWrap: 'wrap' }}>
          <span style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 3 }}>🔒 00-05 Closed</span>
          <span style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 3 }}>✅ 05:00 Clear</span>
          <span style={{ background: '#bbf7d0', padding: '1px 6px', borderRadius: 3 }}>🟢 06-18 Open</span>
          <span style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 3 }}>🔴 18-00 Locked</span>
          <span style={{ background: '#fef3c7', padding: '1px 6px', borderRadius: 3 }}>⚡ 00:00 Match</span>
        </div>
      )}
    </div>
  );
}
