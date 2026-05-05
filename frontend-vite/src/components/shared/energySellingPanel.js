import React, { useState } from 'react';
import { Card, Space, Button, Input } from "antd";
import { formatEnergy, formatToken } from '../../utils/formatters';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function EnergySellingPanel({
  bid,
  selectedBuilding,
  destinationBuildings,
  energyAmount,
  setEnergyAmount,
  energyRate,
  setEnergyRate,
  targetBuildingForPurchase,
  setTargetBuildingForPurchase,
  sourceEnergyStatus,
  sellSource,
  setSellSource,
  marketSnapshot,
  amountNum,
  rateNum,
  totalToken,
  canSellFromSelectedBuilding = true,
  canManualSell = true,
  showTradePolicyControls = false,
  tradeMode,
  setTradeMode,
  batterySellThreshold,
  setBatterySellThreshold,
  onSaveTradePolicy,
  isSavingTradePolicy = false,
  onClose,
  onSell,
  onBuy,
  unsavedTradeMode
}) {
  const producedKwh = Number(marketSnapshot?.producedKwh || 0);
  const consumedKwh = Number(marketSnapshot?.consumedKwh || 0);
  const netKwh = Number(marketSnapshot?.netKwh || 0);
  const marketPrice = Number(marketSnapshot?.marketPrice || selectedBuilding?.price || 0);
  const gridPrice = Number(marketSnapshot?.gridPrice || 4);
  const priceDelta = Number(marketSnapshot?.priceDelta || 0);
  const spread = Number(marketSnapshot?.spread || 0);
  const demandLabel = String(marketSnapshot?.demandLabel || 'LIVE MARKET');
  const orderBookRows = Array.isArray(marketSnapshot?.orderBook) ? marketSnapshot.orderBook : [];
  const produceSource = sourceEnergyStatus?.produce || { current: 0, capacity: 0, percentage: '0.00', available: false };
  const batterySource = sourceEnergyStatus?.battery || { current: 0, capacity: 0, percentage: '0.00', available: false };
  const activeSourceStatus = sellSource === 'battery' ? batterySource : produceSource;
  const normalizedTradeMode = String(tradeMode || 'MANUAL').toUpperCase();
  const isSelfConsumeMode = normalizedTradeMode === 'SELF_CONSUME';
  const isAutoTradeMode = normalizedTradeMode === 'AUTO_BATTERY_THRESHOLD';
  const isManualMode = normalizedTradeMode === 'MANUAL';
  const producedRatio = Math.min(100, Math.max(0, produceSource?.capacity ? (producedKwh / Math.max(produceSource.capacity, producedKwh, 1)) * 100 : producedKwh > 0 ? 100 : 0));
  const consumedRatio = Math.min(100, Math.max(0, producedKwh > 0 ? (consumedKwh / producedKwh) * 100 : consumedKwh > 0 ? 100 : 0));
  const netLabel = netKwh >= 0 ? 'Net Surplus: Selling to Grid' : 'Net Deficit: Buying from Grid';
  const netColor = netKwh >= 0 ? '#52c41a' : '#ff4d4f';
  const netBg = netKwh >= 0 ? '#f6ffed' : '#fff1f0';
  const netBorder = netKwh >= 0 ? '#b7eb8f' : '#ffa39e';
  const deltaLabel = `${priceDelta >= 0 ? '+' : ''}${formatToken(priceDelta)} (Grid: THB ${formatToken(gridPrice)})`;
  const [assetConfigTarget, setAssetConfigTarget] = useState('SOLAR_ARRAY');
  const [storageMode, setStorageMode] = useState('SELF_CONSUME');
  const [storageBuyTrigger, setStorageBuyTrigger] = useState('3.00');
  const [storageSellTrigger, setStorageSellTrigger] = useState('4.50');
  const [storageReserveMin, setStorageReserveMin] = useState(20);
  const [storageTradeAmount, setStorageTradeAmount] = useState('');
  const [storageLimitPrice, setStorageLimitPrice] = useState('');
  const isSolarArrayTarget = assetConfigTarget === 'SOLAR_ARRAY';
  const showSolarManualControls = !showTradePolicyControls || (isSolarArrayTarget && isManualMode);
  const isStorageSelfConsumeMode = storageMode === 'SELF_CONSUME';
  const isStorageAutoTradeMode = storageMode === 'AUTO_BATTERY_THRESHOLD';
  const isStorageManualMode = storageMode === 'MANUAL';
  const batteryCurrentKwh = toNumber(batterySource.current);
  const batteryCapacityKwh = Math.max(toNumber(batterySource.capacity), batteryCurrentKwh, 1);
  const storageSoc = Math.max(0, Math.min(100, (batteryCurrentKwh / batteryCapacityKwh) * 100));
  const reserveKwh = (batteryCapacityKwh * Number(storageReserveMin || 0)) / 100;
  const availableDischargeKwh = Math.max(0, batteryCurrentKwh - reserveKwh);
  const availableChargeKwh = Math.max(0, batteryCapacityKwh - batteryCurrentKwh);
  const tradeModeOptions = [
    { value: 'SELF_CONSUME', label: 'Self-Consume' },
    { value: 'AUTO_BATTERY_THRESHOLD', label: 'Auto-Trade' },
    { value: 'MANUAL', label: 'Manual' },
  ];

  const handleStorageManualSell = () => {
    setSellSource('battery');
    setTradeMode('MANUAL');
    setEnergyAmount(storageTradeAmount);
    setEnergyRate(storageLimitPrice);
    onSell();
  };

  const handleStorageManualBuy = () => {
    setEnergyAmount(storageTradeAmount);
    setEnergyRate(storageLimitPrice);
    onBuy();
  };

  return (
    <div style={{ padding: "20px", height: "100%" }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Card className="head-bar" style={{ marginBottom: 8, position: 'relative' }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                {selectedBuilding?.name || ''}
              </div>
              <div style={{
                display: "inline-block",
                background: "#52c41a",
                color: "white",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                marginRight: 8
              }}>
                CONNECTED
              </div>
              <span style={{ fontSize: 13, color: "#666" }}>
                {selectedBuilding?.location}
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 28,
                cursor: "pointer",
                color: "#999",
                padding: 0,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </div>
        </Card>

        <Card className="head-bar" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>Real-Time Energy Flow</span>
            <span style={{ fontSize: 11, color: "#1890ff" }}>Live API</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div style={{ border: "2px solid #52c41a", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>PRODUCED (Solar Meter)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEnergy(producedKwh)} <span style={{ fontSize: 14 }}>kWH</span></div>
              <div style={{ width: "100%", height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 8 }}>
                <div style={{ width: `${producedRatio}%`, height: "100%", background: "#52c41a", borderRadius: 2 }}></div>
              </div>
            </div>

            <div style={{ border: "2px solid #ff4d4f", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>CONSUMED (Smart Meter)</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEnergy(consumedKwh)} <span style={{ fontSize: 14 }}>kWH</span></div>
              <div style={{ width: "100%", height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 8 }}>
                <div style={{ width: `${consumedRatio}%`, height: "100%", background: "#ff4d4f", borderRadius: 2 }}></div>
              </div>
            </div>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: netBg,
            padding: "8px 12px",
            borderRadius: 6,
            border: `1px solid ${netBorder}`
          }}>
            <span style={{ fontSize: 13, color: netColor, fontWeight: 600 }}>{netLabel}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: netColor }}>{netKwh >= 0 ? '+' : ''}{formatEnergy(netKwh)} kWH</span>
          </div>
        </Card>

        <Card className="head-bar" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>Market Intelligence</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #d9d9d9", background: "white", borderRadius: 4, cursor: "pointer" }}>15m</button>
              <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #1890ff", background: "#e6f7ff", color: "#1890ff", borderRadius: 4, cursor: "pointer" }}>1H</button>
              <button style={{ padding: "4px 12px", fontSize: 11, border: "1px solid #d9d9d9", background: "white", borderRadius: 4, cursor: "pointer" }}>4H</button>
            </div>
          </div>

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "#666" }}>Market Clearing Price (MCP)</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 32, fontWeight: 700 }}>THB {formatToken(marketPrice)}</span>
              <span style={{ fontSize: 14, color: "#666" }}>/unit</span>
              <span style={{
                fontSize: 11,
                color: priceDelta <= 0 ? "#52c41a" : "#ff4d4f",
                background: priceDelta <= 0 ? "#f6ffed" : "#fff1f0",
                padding: "2px 6px",
                borderRadius: 3
              }}>{deltaLabel}</span>
            </div>
          </div>

          <div style={{ position: "relative", height: 120, background: "#f5f7fa", borderRadius: 6, marginTop: 12 }}>
            <div style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "#fff2e8",
              color: "#ff4d4f",
              padding: "2px 8px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 600
            }}>{demandLabel}</div>
            <svg width="100%" height="120" style={{ padding: "20px 10px" }}>
              <defs>
                <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#1890ff", stopOpacity: 0.3 }} />
                  <stop offset="100%" style={{ stopColor: "#1890ff", stopOpacity: 0.05 }} />
                </linearGradient>
              </defs>
              <path d="M 10,60 Q 40,55 60,50 T 100,45 T 140,48 T 180,42 T 220,38 T 260,45 T 300,35" fill="url(#priceGradient)" stroke="none"/>
              <path d="M 10,60 Q 40,55 60,50 T 100,45 T 140,48 T 180,42 T 220,38 T 260,45 T 300,35" fill="none" stroke="#1890ff" strokeWidth="2"/>
            </svg>
          </div>
        </Card>

        <Card className="head-bar" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Order Book</div>

          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f0f0", backgroundColor: "#fafafa" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>PRICE (THB)</th>
                <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>VOL (kWH)</th>
                <th style={{ textAlign: "right", padding: "10px 8px", fontSize: 11, color: "#333", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {orderBookRows.length ? orderBookRows.map((row, index) => (
                <tr
                  key={`${row.side}-${row.id || index}`}
                  style={{
                    backgroundColor: row.side === 'buy' ? (index === 0 ? "#ffe7e7" : "#ffd6d6") : (index % 2 === 0 ? "#d6f5d6" : "#e6f7e6"),
                    borderBottom: row.side === 'buy' ? "1px solid #ffccc7" : "1px solid #b3e5fc",
                    borderLeft: row.side === 'buy' ? "4px solid #ff4d4f" : "4px solid #52c41a"
                  }}
                >
                  <td style={{ padding: "12px 8px", color: row.side === 'buy' ? "#ff4d4f" : "#52c41a", fontWeight: 700, fontSize: 14 }}>
                    {formatToken(toNumber(row.ratePerKwh))}
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#333", fontWeight: 600 }}>
                    {formatEnergy(toNumber(row.remainingKwh))}
                  </td>
                  <td style={{ textAlign: "right", padding: "12px 8px", color: "#666", fontWeight: 600 }}>
                    {formatToken(toNumber(row.totalPrice))}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: "center", padding: "14px 8px", color: "#666", backgroundColor: "#fafafa" }}>
                    No live market offers available for this building yet.
                  </td>
                </tr>
              )}
              <tr>
                <td colSpan="3" style={{ textAlign: "center", padding: "14px 8px", fontSize: 12, color: "#666", fontWeight: 700, backgroundColor: "#f5f5f5", borderTop: "2px solid #e0e0e0", borderBottom: "2px solid #e0e0e0" }}>
                  Spread: {formatToken(spread)} THB
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        {showTradePolicyControls && (
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Asset Configuration</div>
                <div style={{ fontSize: 12, color: '#666' }}>Choose how this asset should behave before posting or routing energy.</div>
              </div>
              <div style={{ fontSize: 11, color: '#1890ff', fontWeight: 700 }}>Policy Settings</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setAssetConfigTarget('SOLAR_ARRAY')}
                style={{
                  border: isSolarArrayTarget ? '1px solid #2563eb' : '1px solid #e5e7eb',
                  background: isSolarArrayTarget ? '#eff6ff' : '#fff',
                  color: isSolarArrayTarget ? '#1d4ed8' : '#4b5563',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Solar Array
              </button>
              <button
                type="button"
                onClick={() => setAssetConfigTarget('STORAGE_SYSTEM')}
                style={{
                  border: !isSolarArrayTarget ? '1px solid #2563eb' : '1px solid #e5e7eb',
                  background: !isSolarArrayTarget ? '#eff6ff' : '#fff',
                  color: !isSolarArrayTarget ? '#1d4ed8' : '#4b5563',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Storage System
              </button>
            </div>

            {isSolarArrayTarget ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                  {tradeModeOptions.map((option) => {
                    const active = normalizedTradeMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTradeMode(option.value)}
                        style={{
                          border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
                          background: active ? '#eff6ff' : '#fff',
                          color: active ? '#1d4ed8' : '#4b5563',
                          borderRadius: 12,
                          padding: '12px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: active ? '0 10px 24px rgba(37, 99, 235, 0.12)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                {isSelfConsumeMode && (
                  <div style={{ padding: 18, borderRadius: 16, border: '1px solid #f3e8c5', background: 'linear-gradient(135deg, #fffdf5 0%, #fff8e8 100%)', display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 26, background: '#fff', border: '1px solid #f1e2b0', display: 'grid', placeItems: 'center', fontSize: 24 }}>🏠</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>100% Internal Routing Active</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6b7280', maxWidth: 420 }}>
                      All solar yield is prioritized for building load first. Excess can charge storage or be curtailed, with no P2P market exposure.
                    </div>
                  </div>
                )}

                {isAutoTradeMode && (
                  <div style={{ display: 'grid', gap: 12, padding: 18, borderRadius: 16, border: '1px solid #dbeafe', background: 'linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>Solar Arbitrage Bot</div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Tune the auto-sell policy before saving it to the asset.</div>
                      </div>
                      <div style={{ padding: '6px 10px', borderRadius: 999, background: '#ffedd5', color: '#c2410c', fontSize: 12, fontWeight: 700 }}>
                        Auto routing enabled
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#4b5563' }}>
                        <span>Battery Sell Threshold</span>
                        <span>{Number(batterySellThreshold || 0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Number(batterySellThreshold || 0)}
                        onChange={(e) => setBatterySellThreshold(Number(e.target.value || 0))}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        <span>0% - Hold Everything</span>
                        <span>100% - Sell Early</span>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                      Excess energy above the selected threshold will be routed for trading automatically.
                    </div>
                  </div>
                )}

                {isManualMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2 }}>Solar Energy</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 6 }}>{formatEnergy(produceSource.current)} kWh</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Trade Amount</div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={energyAmount}
                        onChange={(e) => setEnergyAmount(e.target.value)}
                        min={0}
                        style={{ width: '100%' }}
                        suffix={<span style={{ fontSize: 10, color: '#999' }}>kWh</span>}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Limit Price</div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={energyRate}
                        onChange={(e) => setEnergyRate(e.target.value)}
                        min={0}
                        step="0.01"
                        style={{ width: '100%' }}
                        suffix={<span style={{ fontSize: 10, color: '#999' }}>THB/u</span>}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      <Button
                        type="primary"
                        style={{ height: 'auto', minHeight: 44, fontWeight: 700, background: '#ef4444', borderColor: '#ef4444', whiteSpace: 'normal', padding: '6px 8px', fontSize: 12 }}
                        onClick={() => {
                          setSellSource('produce');
                          setTradeMode('MANUAL');
                          setTimeout(onSell, 0); // เพื่อให้ React อัปเดต state เสร็จก่อนเรียกใช้งาน onSell
                        }}
                      >
                        SELL (Solar)
                      </Button>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <Button
                    type="primary"
                    onClick={onSaveTradePolicy}
                    loading={isSavingTradePolicy}
                    disabled={!onSaveTradePolicy}
                    style={{ width: '100%', height: 42, fontWeight: 700, background: '#3b82f6', borderColor: '#3b82f6' }}
                  >
                    Save Solar Rules
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fbfffd', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>State of Charge (SoC)</span>
                    <span style={{ fontSize: 12, color: '#059669', fontWeight: 800 }}>{Math.round(storageSoc)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${storageSoc}%`, height: '100%', background: '#10b981' }}></div>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{formatEnergy(batteryCurrentKwh)} kWh available</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
                  {tradeModeOptions.map((option) => {
                    const active = storageMode === option.value;
                    return (
                      <button
                        key={`storage-${option.value}`}
                        type="button"
                        onClick={() => setStorageMode(option.value)}
                        style={{
                          border: active ? '1px solid #2563eb' : '1px solid #e5e7eb',
                          background: active ? '#eff6ff' : '#fff',
                          color: active ? '#1d4ed8' : '#4b5563',
                          borderRadius: 12,
                          padding: '12px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: active ? '0 10px 24px rgba(37, 99, 235, 0.12)' : 'none',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>

                {isStorageSelfConsumeMode && (
                  <div style={{ padding: 18, borderRadius: 16, border: '1px solid #e5e7eb', background: '#fff', display: 'grid', gap: 10, justifyItems: 'center', textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 26, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'grid', placeItems: 'center', fontSize: 24 }}>🛡️</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>Peak Shaving Mode Active</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: '#6b7280', maxWidth: 420 }}>
                      Battery is reserved for local demand support first and only discharges when grid import spikes.
                    </div>
                  </div>
                )}

                {isStorageAutoTradeMode && (
                  <div style={{ display: 'grid', gap: 12, padding: 18, borderRadius: 16, border: '1px solid #dcfce7', background: 'linear-gradient(135deg, #f6fff9 0%, #ecfdf5 100%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>Battery VPP Bot</div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Set buy/sell triggers for automated battery trading.</div>
                      </div>
                      <div style={{ padding: '6px 10px', borderRadius: 999, background: '#d1fae5', color: '#047857', fontSize: 12, fontWeight: 700 }}>
                        Auto dispatch enabled
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Buy From Market Trigger</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 8px' }}>Buy when market price below this value</div>
                        <Input
                          type="number"
                          value={storageBuyTrigger}
                          onChange={(e) => setStorageBuyTrigger(e.target.value)}
                          min={0}
                          step="0.01"
                          suffix="THB"
                        />
                      </div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Auto Discharge Trigger</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 8px' }}>Sell when market price is above this value</div>
                        <Input
                          type="number"
                          value={storageSellTrigger}
                          onChange={(e) => setStorageSellTrigger(e.target.value)}
                          min={0}
                          step="0.01"
                          suffix="THB"
                        />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#4b5563' }}>
                        <span>Emergency Reserve (Min SoC)</span>
                        <span style={{ color: '#ef4444' }}>{Number(storageReserveMin || 0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Number(storageReserveMin || 0)}
                        onChange={(e) => setStorageReserveMin(Number(e.target.value || 0))}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        <span>Discharge to 0%</span>
                        <span>Keep reserve 100%</span>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Button
                        type="primary"
                        onClick={onSaveTradePolicy}
                        loading={isSavingTradePolicy}
                        disabled={!onSaveTradePolicy}
                        style={{ width: '100%', height: 42, fontWeight: 700, background: '#22c55e', borderColor: '#22c55e' }}
                      >
                        Save Battery Rules
                      </Button>
                    </div>
                  </div>
                )}

                {isStorageManualMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2 }}>Available to Discharge</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 6 }}>{formatEnergy(availableDischargeKwh)} kWh</div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, boxSizing: 'border-box' }}>
                        <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2 }}>Available to Charge</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 6 }}>{formatEnergy(availableChargeKwh)} kWh</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Trade Amount</div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={storageTradeAmount}
                        onChange={(e) => setStorageTradeAmount(e.target.value)}
                        min={0}
                        style={{ width: '100%' }}
                        suffix={<span style={{ fontSize: 10, color: '#999' }}>kWh</span>}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Limit Price</div>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={storageLimitPrice}
                        onChange={(e) => setStorageLimitPrice(e.target.value)}
                        min={0}
                        step="0.01"
                        style={{ width: '100%' }}
                        suffix={<span style={{ fontSize: 10, color: '#999' }}>THB/u</span>}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Button
                        type="primary"
                        style={{ height: 'auto', minHeight: 44, fontWeight: 700, background: '#22c55e', borderColor: '#22c55e', whiteSpace: 'normal', padding: '6px 8px', fontSize: 12 }}
                        onClick={handleStorageManualBuy}
                      >
                        BUY (Charge)
                      </Button>
                      <Button
                        type="primary"
                        style={{ height: 'auto', minHeight: 44, fontWeight: 700, background: '#ef4444', borderColor: '#ef4444', whiteSpace: 'normal', padding: '6px 8px', fontSize: 12 }}
                        onClick={handleStorageManualSell}
                      >
                        SELL (Discharge)
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Button
            type="primary"
            size="large"
            disabled={!canManualSell}
            style={{
              height: 56,
              fontSize: 14,
              fontWeight: 700,
              background: "#ff4d4f",
              borderColor: "#ff4d4f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onClick={onSell}
          >
            SELL ENERGY
          </Button>

          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute",
              top: -8,
              right: -8,
              background: "#fadb14",
              color: "#000",
              padding: "3px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              zIndex: 1
            }}>Best Price</div>
            <Button
              type="primary"
              size="large"
              style={{
                width: "100%",
                height: 56,
                fontSize: 14,
                fontWeight: 700,
                background: "#52c41a",
                borderColor: "#52c41a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onClick={onBuy}
            >
              BUY ENERGY
            </Button>
          </div>
        </div>

        {!canSellFromSelectedBuilding && (
          <div style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7e6",
            border: "1px solid #ffd591",
            color: "#ad6800",
            fontSize: 12,
            fontWeight: 600
          }}>
            Selling is only available for the building linked to your contact email.
          </div>
        )}

        {canSellFromSelectedBuilding && !canManualSell && (
          <div style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff7e6",
            border: "1px solid #ffd591",
            color: "#ad6800",
            fontSize: 12,
            fontWeight: 600
          }}>
            Manual sell is disabled for current mode. Switch to MANUAL mode to post offers by user action.
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
          Secured by Ethereum Blockchain
        </div>
      </Space>
    </div>
  );
}
