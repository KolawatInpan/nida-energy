import React from 'react';
import { MarketTimeline } from '../../../components/shared';

function buildInitials(name) {
  return String(name || 'SO')
    .split(' ')
    .map((part) => part?.[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function StatCard({ label, value, subtitle, accentColor = '#64748b' }) {
  return (
    <div style={{ background: 'transparent', borderRadius: '8px', padding: '6px 10px', textAlign: 'center', minWidth: '104px', flex: '1 1 0' }}>
      <div style={{ fontSize: '8px', color: '#334155', fontWeight: 700, letterSpacing: '0.45px', marginBottom: '3px', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', lineHeight: '1', textShadow: '0 1px 4px rgba(255,255,255,0.9)' }}>{value}</div>
      <div style={{ fontSize: '9px', color: accentColor, fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>{subtitle}</div>
    </div>
  );
}

export default function TradingOverlay({
  selectedBuilding,
  overviewStats,
  member,
  showPanel,
  availableBuildingNames,
  ownedBuildingNames = [],
  onSelectBuilding,
}) {
  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: showPanel ? 408 : 12,
          zIndex: 100,
        }}
      >
        <div
          style={{
            background: 'transparent',
            borderRadius: '10px',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'nowrap',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 2px 8px rgba(24,144,255,0.3)',
              flexShrink: 0,
            }}
          >
            {'\u26A1'}
          </div>

          <div style={{ minWidth: '140px', flex: '1 1 180px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px', lineHeight: '1.15', marginBottom: '2px', textShadow: '0 1px 4px rgba(255,255,255,0.9)' }}>
              NIDA SMART GRID
            </div>
            <div style={{ fontSize: '10px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>
              <span style={{ color: '#ff4d4f' }}>{'\u{1F4CD}'}</span>
              <span>Bang Kapi District</span>
              <span style={{ color: '#d9d9d9', margin: '0 2px' }}>{'>'}</span>
              <span>{selectedBuilding?.name || `${overviewStats.totalBuildings} active buildings`}</span>
            </div>
          </div>

          <StatCard
            label="NET GRID LOAD"
            value={<>{Math.round(overviewStats.netGridLoad).toLocaleString()} <span style={{ fontSize: '10px', fontWeight: 600, color: '#666' }}>kWh</span></>}
            subtitle=""
          />
          <StatCard
            label="SOLAR GEN"
            value={<>{Math.round(overviewStats.solarGeneration).toLocaleString()} <span style={{ fontSize: '10px', fontWeight: 600, color: '#666' }}>kWh</span></>}
            subtitle=""
            accentColor="#666"
          />
          <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px', flex: '0 0 auto', marginLeft: 'auto', flexWrap: 'nowrap' }}>
            <div style={{ minWidth: '112px', flex: '0 0 auto' }}>
              <StatCard
                label="TOKEN PRICE"
                value={`${'\u0E3F'}${overviewStats.marketPrice.toFixed(2)}`}
                subtitle={`${overviewStats.gridDelta >= 0 ? '+' : ''}${overviewStats.gridDelta.toFixed(2)} vs grid`}
                accentColor={overviewStats.gridDelta <= 0 ? '#16a34a' : '#dc2626'}
              />
            </div>

            <div style={{ background: 'transparent', borderRadius: '8px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', whiteSpace: 'nowrap' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', lineHeight: '1.1', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>{member?.role || 'ADMIN'}</div>
                <div style={{ fontSize: '9px', color: '#334155', marginTop: '1px', textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>{member?.name || 'System Operator'}</div>
              </div>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', flexShrink: 0 }}>
                {buildInitials(member?.name)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Timeline — compact */}
      <div style={{
        position: 'absolute', left: 16, top: 108, zIndex: 100,
        background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '4px 8px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)', maxWidth: 340, width: 'fit-content',
      }}>
        <MarketTimeline compact />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 20,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxWidth: showPanel ? 'calc(100% - 440px)' : '420px',
        }}
      >
        <div style={{ background: 'transparent', borderRadius: 10, padding: '6px 10px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 8, textShadow: '0 1px 3px rgba(255,255,255,0.8)' }}>AVAILABLE BUILDINGS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {availableBuildingNames.length ? availableBuildingNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => onSelectBuilding(name)}
                style={{
                  border: selectedBuilding?.name === name
                    ? '1px solid #2563eb'
                    : ownedBuildingNames.includes(name)
                      ? '1px solid #16a34a'
                      : '1px solid #cbd5e1',
                  background: selectedBuilding?.name === name
                    ? '#dbeafe'
                    : ownedBuildingNames.includes(name)
                      ? '#f0fdf4'
                      : '#f8fafc',
                  color: ownedBuildingNames.includes(name) ? '#166534' : '#0f172a',
                  borderRadius: 9999,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {name}{ownedBuildingNames.includes(name) ? ' ✓ My Building' : ''}
              </button>
            )) : (
              <span style={{ fontSize: 12, color: '#64748b' }}>No buildings available for trading</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
