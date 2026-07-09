import React, { useState, useEffect } from 'react';
import { Card, Space, Button, Input, message } from "antd";
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
  solarTradeMode,
  batteryTradeMode,
  batterySellThreshold,
  setBatterySellThreshold,
  onSaveTradePolicy,
  isSavingTradePolicy = false,
  onClose,
  onSell,
  onBuy,
  marketType,
  setMarketType,
  orderSide,
  setOrderSide,
  unsavedTradeMode
}) {
  const produceSource = sourceEnergyStatus?.produce || { current: 0, capacity: 0, percentage: '0.00', available: false };
  const batterySource = sourceEnergyStatus?.battery || { current: 0, capacity: 0, percentage: '0.00', available: false };
  // Use live meter value for Available Energy (reflects decrements from offers)
  const availableEnergyKwh = toNumber(produceSource?.current || 0);
  const availableBatteryKwh = toNumber(batterySource?.current || 0);
  const todayProductionKwh = Number(produceSource?.totalProduce || marketSnapshot?.producedKwh || 0);
  const todayConsumptionKwh = Number(produceSource?.totalConsume || marketSnapshot?.consumedKwh || 0);
  const netKwh = availableEnergyKwh - todayConsumptionKwh;
  const marketPrice = Number(marketSnapshot?.marketPrice || selectedBuilding?.price || 0);
  const gridPrice = Number(marketSnapshot?.gridPrice || 4);
  const priceDelta = Number(marketSnapshot?.priceDelta || 0);
  const spread = Number(marketSnapshot?.spread || 0);
  const demandLabel = String(marketSnapshot?.demandLabel || 'LIVE MARKET');
  const orderBookRows = Array.isArray(marketSnapshot?.orderBook) ? marketSnapshot.orderBook : [];
  const hasSolarMeter = produceSource.capacity > 0;
  const hasBatteryMeter = batterySource.capacity > 0;
  const activeSourceStatus = sellSource === 'battery' ? batterySource : produceSource;
  const normalizedTradeMode = String(tradeMode || 'AUTO_BATTERY_THRESHOLD').toUpperCase();
  // Pending mode states — MUST be declared before they're referenced below
  const [pendingSolarMode, setPendingSolarMode] = useState(() => normalizedTradeMode);
  const [pendingStorageMode, setPendingStorageMode] = useState(() => 'AUTO_BATTERY_THRESHOLD');
  const pendingSolarNormalized = String(pendingSolarMode || normalizedTradeMode).toUpperCase();
  const pendingStorageNormalized = String(pendingStorageMode || 'SELF_CONSUME').toUpperCase();
  const isSelfConsumeMode = pendingSolarNormalized === 'SELF_CONSUME';
  const isAutoTradeMode = pendingSolarNormalized === 'AUTO_BATTERY_THRESHOLD';
  const isManualMode = pendingSolarNormalized === 'MANUAL';
  const isStorageSelfConsumeMode = pendingStorageNormalized === 'SELF_CONSUME';
  const isStorageAutoTradeMode = pendingStorageNormalized === 'AUTO_BATTERY_THRESHOLD';
  const isStorageManualMode = pendingStorageNormalized === 'MANUAL';
  const producedRatio = Math.min(100, Math.max(0, produceSource?.capacity ? (availableEnergyKwh / Math.max(produceSource.capacity, availableEnergyKwh, 1)) * 100 : availableEnergyKwh > 0 ? 100 : 0));
  const consumedRatio = Math.min(100, Math.max(0, availableEnergyKwh > 0 ? (todayConsumptionKwh / availableEnergyKwh) * 100 : todayConsumptionKwh > 0 ? 100 : 0));
  const netLabel = netKwh >= 0 ? 'Net Surplus: Selling to Grid' : 'Net Deficit: Buying from Grid';
  const netColor = netKwh >= 0 ? '#52c41a' : '#ff4d4f';
  const netBg = netKwh >= 0 ? '#f6ffed' : '#fff1f0';
  const netBorder = netKwh >= 0 ? '#b7eb8f' : '#ffa39e';
  const deltaLabel = `${priceDelta >= 0 ? '+' : ''}${formatToken(priceDelta)} (Grid: THB ${formatToken(gridPrice)})`;
  const defaultTab = hasSolarMeter ? 'SOLAR_ARRAY' : 'STORAGE_SYSTEM';
  const [assetConfigTarget, setAssetConfigTarget] = useState(defaultTab);
  const [storageMode, setStorageMode] = useState('AUTO_BATTERY_THRESHOLD');
  const [storageBuyTrigger, setStorageBuyTrigger] = useState('3.00');
  const [storageSellTrigger, setStorageSellTrigger] = useState('4.50');
  const [storageTradeAmount, setStorageTradeAmount] = useState('');
  const [storageLimitPrice, setStorageLimitPrice] = useState('');
  const [chartRange, setChartRange] = useState('1H');
  const [solarSelfPercent, setSolarSelfPercent] = useState(80);
  const [offeredKwh, setOfferedKwh] = useState(0);

  // Sync storageMode from parent batteryTradeMode when building changes
  const normalizedBatteryMode = String(batteryTradeMode || normalizedTradeMode || 'AUTO_BATTERY_THRESHOLD').toUpperCase();
  useEffect(() => {
    setAssetConfigTarget(hasSolarMeter ? 'SOLAR_ARRAY' : 'STORAGE_SYSTEM');
    setPendingSolarMode(normalizedTradeMode);
    setStorageMode(normalizedBatteryMode);
    setPendingStorageMode(normalizedBatteryMode);
  }, [hasSolarMeter, hasBatteryMeter, normalizedTradeMode, normalizedBatteryMode]);
  // Also sync pending when committed mode changes (e.g. after save)
  useEffect(() => {
    setPendingSolarMode(normalizedTradeMode);
  }, [normalizedTradeMode]);
  useEffect(() => {
    setPendingStorageMode(storageMode);
  }, [storageMode]);

  // Fetch offered energy in marketplace for this battery
  useEffect(() => {
    if (!hasBatteryMeter || !selectedBuilding?.name) { setOfferedKwh(0); return; }
    const base = (window.__RUNTIME_CONFIG__?.BACKEND_URL || 'http://localhost:8000/api').replace(/\/$/, '');
    fetch(`${base}/market/orders?side=OFFER&status=OPEN`)
      .then(r => r.json())
      .then(data => {
        const orders = data?.orders || [];
        // Match this building's offers (active, not yet fully filled)
        const buildingOffers = orders.filter(o =>
          String(o.buildingName || '') === selectedBuilding.name
        );
        const total = buildingOffers.reduce((s, o) =>
          s + Math.max(0, Number(o.quantity || 0) - Number(o.filled || 0)), 0
        );
        setOfferedKwh(Math.round(total * 100) / 100);
      })
      .catch(() => setOfferedKwh(0));
  }, [hasBatteryMeter, selectedBuilding?.name]);

  const isSolarArrayTarget = assetConfigTarget === 'SOLAR_ARRAY';
  const showSolarManualControls = !showTradePolicyControls || (isSolarArrayTarget && isManualMode);
  const batteryCurrentKwh = toNumber(batterySource.current);
  const batteryCapacityKwh = Math.max(toNumber(batterySource.capacity), batteryCurrentKwh, 1);
  const storageSoc = Math.max(0, Math.min(100, (batteryCurrentKwh / batteryCapacityKwh) * 100));
  const reserveKwh = (batteryCapacityKwh * Number(batterySellThreshold || 80)) / 100;
  const availableDischargeKwh = Math.max(0, batteryCurrentKwh - reserveKwh);
  const availableChargeKwh = Math.max(0, batteryCapacityKwh - batteryCurrentKwh);
  const tradeModeOptions = [
    { value: 'SELF_CONSUME', label: 'Self-Consume' },
    { value: 'MANUAL', label: 'Manual' },
    { value: 'AUTO_BATTERY_THRESHOLD', label: 'Auto-Trade' }
  ];

  const handleStorageManualSell = () => {
    setSellSource('battery');
    setTradeMode('AUTO_BATTERY_THRESHOLD');
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
              {/* Current Mode Status Badges — only show for meter types that exist */}
              {showTradePolicyControls && (
                <>
                  {hasSolarMeter && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: tradeMode === 'AUTO_BATTERY_THRESHOLD' ? '#ecfdf5' : tradeMode === 'SELF_CONSUME' ? '#fff7ed' : '#f3f4f6',
                      color: tradeMode === 'AUTO_BATTERY_THRESHOLD' ? '#059669' : tradeMode === 'SELF_CONSUME' ? '#d97706' : '#6b7280',
                      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      marginRight: 6
                    }}>
                      ☀️ {tradeMode === 'AUTO_BATTERY_THRESHOLD' ? 'Auto' : tradeMode === 'SELF_CONSUME' ? 'Self' : 'Manual'}
                    </span>
                  )}
                  {hasBatteryMeter && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: batteryTradeMode === 'AUTO_BATTERY_THRESHOLD' ? '#ecfdf5' : batteryTradeMode === 'SELF_CONSUME' ? '#fff7ed' : '#f3f4f6',
                      color: batteryTradeMode === 'AUTO_BATTERY_THRESHOLD' ? '#059669' : batteryTradeMode === 'SELF_CONSUME' ? '#d97706' : '#6b7280',
                      padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      marginRight: 8
                    }}>
                      🔋 {batteryTradeMode === 'AUTO_BATTERY_THRESHOLD' ? 'Auto' : batteryTradeMode === 'SELF_CONSUME' ? 'Self' : 'Manual'}
                    </span>
                  )}
                </>
              )}
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

          <div style={{ display: "grid", gridTemplateColumns: `${hasSolarMeter ? '1fr 1fr' : '1fr'}`, gap: 12, marginBottom: 12 }}>
            {hasSolarMeter && (
              <div style={{ border: "2px solid #52c41a", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>TODAY'S PRODUCTION</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEnergy(Math.max(0, todayProductionKwh))} <span style={{ fontSize: 14 }}>kWH</span></div>
                <div style={{ width: "100%", height: 4, background: "#f0f0f0", borderRadius: 2, marginTop: 8 }}>
                  <div style={{ width: `${producedRatio}%`, height: "100%", background: "#52c41a", borderRadius: 2 }}></div>
                </div>
                <div style={{ marginTop: 10, padding: "6px 8px", background: "#f6ffed", borderRadius: 6, border: "1px solid #b7eb8f" }}>
                  <div style={{ fontSize: 10, color: "#389e0d", marginBottom: 2 }}>AVAILABLE TO SELL</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#135200" }}>{Math.max(0, availableEnergyKwh).toFixed(2)} <span style={{ fontSize: 11 }}>kWH</span></div>
                </div>
              </div>
            )}
            <div style={{ border: "2px solid #ff4d4f", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>TODAY'S CONSUMPTION</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{formatEnergy(Math.max(0, todayConsumptionKwh))} <span style={{ fontSize: 14 }}>kWH</span></div>
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
              {['15m','1H','4H'].map(range => (
                <button key={range}
                  onClick={() => setChartRange(range)}
                  style={{
                    padding: "4px 12px", fontSize: 11,
                    border: chartRange === range ? '1px solid #1890ff' : '1px solid #d9d9d9',
                    background: chartRange === range ? '#e6f7ff' : 'white',
                    color: chartRange === range ? '#1890ff' : '#666',
                    borderRadius: 4, cursor: 'pointer'
                  }}>{range}</button>
              ))}
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

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[hasSolarMeter, hasBatteryMeter].filter(Boolean).length || 1}, 1fr)`, gap: 8, marginBottom: 14 }}>
              {hasSolarMeter && (
                <button
                  type="button"
                  onClick={() => { setAssetConfigTarget('SOLAR_ARRAY'); setSellSource('produce'); }}
                  style={{
                    border: isSolarArrayTarget ? '2px solid #2563eb' : '2px solid #e5e7eb',
                    background: isSolarArrayTarget ? '#eff6ff' : '#fff',
                    color: isSolarArrayTarget ? '#1d4ed8' : '#4b5563',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{fontSize: 20}}>☀️</span> Solar Array
                </button>
              )}
              {hasBatteryMeter && (
                <button
                  type="button"
                  onClick={() => { setAssetConfigTarget('STORAGE_SYSTEM'); setSellSource('battery'); }}
                  style={{
                    border: !isSolarArrayTarget ? '2px solid #2563eb' : '2px solid #e5e7eb',
                    background: !isSolarArrayTarget ? '#eff6ff' : '#fff',
                    color: !isSolarArrayTarget ? '#1d4ed8' : '#4b5563',
                    borderRadius: 12,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{fontSize: 20}}>🔋</span> Storage System
                </button>
              )}
            </div>

            {isSolarArrayTarget ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {tradeModeOptions.map((option) => {
                    const isCommitted = normalizedTradeMode === option.value;
                    const isSelected = pendingSolarMode === option.value;
                    const icons = { SELF_CONSUME: '🏠', MANUAL: '✋', AUTO_BATTERY_THRESHOLD: '🤖' };
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPendingSolarMode(option.value)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                          background: isSelected ? '#eff6ff' : '#fff',
                          color: isSelected ? '#1d4ed8' : '#4b5563',
                          borderRadius: 10,
                          padding: '8px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
                          overflow: 'hidden',
                          lineHeight: 1.2,
                          position: 'relative',
                          opacity: isCommitted && !isSelected ? 0.6 : 1,
                        }}
                      >
                        {isCommitted && <span style={{fontSize: 7, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px'}}>● In use</span>}
                        <span style={{fontSize: 16}}>{icons[option.value]}</span>
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
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937' }}>🤖 Solar Arbitrage Bot</div>
                        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Set auto-sell price and surplus threshold.</div>
                      </div>
                      <div style={{ padding: '6px 10px', borderRadius: 999, background: '#ffedd5', color: '#c2410c', fontSize: 12, fontWeight: 700 }}>
                        Auto routing enabled
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>Sell Price (Token/kWh)</div>
                      <Input
                        type="number"
                        placeholder="e.g. 5.00"
                        value={energyRate}
                        onChange={(e) => setEnergyRate(e.target.value)}
                        min={0} step="0.01"
                        style={{ width: '100%' }}
                        suffix={<span style={{ fontSize: 10, color: '#999' }}>T/kWh</span>}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#4b5563' }}>
                        <span>☀️ Solar Self-Consume</span>
                        <span style={{ color: '#f59e0b' }}>{solarSelfPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={solarSelfPercent}
                        onChange={(e) => setSolarSelfPercent(Number(e.target.value || 0))}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        <span>Sell all solar</span>
                        <span>Keep all solar</span>
                      </div>
                    </div>
                  </div>
                )}

                {( <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', boxSizing: 'border-box' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                      {hasSolarMeter && (
                        <>
                          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, boxSizing: 'border-box' }}>
                            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2 }}>Today's Production</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', marginTop: 6 }}>{formatEnergy(Math.max(0, todayProductionKwh))} kWh</div>
                          </div>
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 10, boxSizing: 'border-box' }}>
                            <div style={{ fontSize: 10, color: '#166534', textTransform: 'uppercase', fontWeight: 700, lineHeight: 1.2 }}>Available to Sell</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#14532d', marginTop: 6 }}>{Math.max(0, availableEnergyKwh).toFixed(2)} kWh</div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>Use the panel below to place your order</div>
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <Button
                    type="primary"
                    onClick={() => {
                      setTradeMode(pendingSolarMode);
                      if (onSaveTradePolicy) onSaveTradePolicy({ tradeMode: pendingSolarMode, solarTradeMode: pendingSolarMode });
                    }}
                    loading={isSavingTradePolicy}
                    disabled={!onSaveTradePolicy || pendingSolarMode === normalizedTradeMode}
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
                  <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', marginBottom: 6, display: 'flex' }}>
                    <div style={{ width: `${Math.max(0, storageSoc - (batteryCapacityKwh > 0 ? (offeredKwh / batteryCapacityKwh) * 100 : 0))}%`, height: '100%', background: '#10b981' }}></div>
                    {offeredKwh > 0 && (
                      <div style={{ width: `${Math.min(storageSoc, (offeredKwh / Math.max(batteryCapacityKwh, 1)) * 100)}%`, height: '100%', background: '#3b82f6' }}></div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {offeredKwh > 0
                      ? `${formatEnergy(Math.max(0, batteryCurrentKwh - offeredKwh))} kWh available · ${offeredKwh.toFixed(1)} kWh on market`
                      : `${formatEnergy(batteryCurrentKwh)} kWh available`}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {tradeModeOptions.map((option) => {
                    const isCommitted = storageMode === option.value;
                    const isSelected = pendingStorageMode === option.value;
                    const icons = { SELF_CONSUME: '🏠', MANUAL: '✋', AUTO_BATTERY_THRESHOLD: '🤖' };
                    return (
                      <button
                        key={`storage-${option.value}`}
                        type="button"
                        onClick={() => setPendingStorageMode(option.value)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                          background: isSelected ? '#eff6ff' : '#fff',
                          color: isSelected ? '#1d4ed8' : '#4b5563',
                          borderRadius: 10,
                          padding: '8px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
                          overflow: 'hidden',
                          lineHeight: 1.2,
                          position: 'relative',
                          opacity: isCommitted && !isSelected ? 0.6 : 1,
                        }}
                      >
                        {isCommitted && <span style={{fontSize: 7, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px'}}>● In use</span>}
                        <span style={{fontSize: 16}}>{icons[option.value]}</span>
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
                    <div style={{ marginTop: 8, width: '100%' }}>
                      <Button
                        type="primary"
                        onClick={() => {
                          setStorageMode(pendingStorageMode);
                          if (onSaveTradePolicy) onSaveTradePolicy({ batteryTradeMode: pendingStorageMode });
                        }}
                        loading={isSavingTradePolicy}
                        disabled={!onSaveTradePolicy || pendingStorageMode === storageMode}
                        style={{ width: '100%', height: 42, fontWeight: 700, background: '#22c55e', borderColor: '#22c55e' }}
                      >
                        Save Battery Rules
                      </Button>
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
                        <span>🔋 Target SoC</span>
                        <span style={{ color: '#ef4444' }}>{Number(batterySellThreshold || 80)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Number(batterySellThreshold || 80)}
                        onChange={(e) => setBatterySellThreshold(Number(e.target.value || 0))}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        <span>0% — Sell all</span>
                        <span>100% — Keep all</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '6px 8px', borderRadius: 6 }}>
                        💡 SoC maintained at ~{Number(batterySellThreshold || 80)}% — charge below, auto-sell surplus above
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <Button
                        type="primary"
                        onClick={() => {
                          setStorageMode(pendingStorageMode);
                          if (onSaveTradePolicy) onSaveTradePolicy({ batteryTradeMode: pendingStorageMode });
                        }}
                        loading={isSavingTradePolicy}
                        disabled={!onSaveTradePolicy || pendingStorageMode === storageMode}
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
                    <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', marginTop: 8 }}>Use the panel below to place your order</div>
                    <div style={{ marginTop: 4, width: '100%' }}>
                      <Button
                        type="primary"
                        onClick={() => {
                          setStorageMode(pendingStorageMode);
                          if (onSaveTradePolicy) onSaveTradePolicy({ batteryTradeMode: pendingStorageMode });
                        }}
                        loading={isSavingTradePolicy}
                        disabled={!onSaveTradePolicy || pendingStorageMode === storageMode}
                        style={{ width: '100%', height: 42, fontWeight: 700, background: '#22c55e', borderColor: '#22c55e' }}
                      >
                        Save Battery Rules
                      </Button>
                    </div>
                  </div>
                )}
              {/* Trigger Battery Surplus — manual check & post */}
              {hasBatteryMeter && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    type="default"
                    onClick={async () => {
                      if (!selectedBuilding?.id) { message.warning('No building selected'); return; }
                      const apiBase = (window.__RUNTIME_CONFIG__?.BACKEND_URL || 'http://localhost:8000/api').replace(/\/$/, '');
                      try {
                        const resp = await fetch(`${apiBase}/buildings/${selectedBuilding.id}/trigger-battery`, { method: 'POST' });
                        const data = await resp.json();
                        if (data.created) {
                          message.success(`Battery surplus posted: ${Math.round(data.created.kWH)} kWh at ${data.created.ratePerkWH} THB/kWh`);
                        } else {
                          const dbg = data.debug;
                          let msg = data.reason
                            ? `[${data.reason}]`
                            : 'No surplus to sell';
                          if (data.debug && Object.keys(data.debug).length > 0) {
                            const d = data.debug;
                            msg += ` SoC: ${Math.round(d.batteryCurrent||0)}/${Math.round(d.batteryCapacity||0)} kWh, surplus: ${Math.round(d.sellableKwh||0)} kWh, mode: ${d.batteryMode || '?'}`;
                          }
                          message.info(msg);
                        }
                      } catch (e) {
                        message.error(`Trigger failed: ${e.message}`);
                      }
                    }}
                    style={{ width: '100%', height: 36, fontWeight: 600, fontSize: 12, borderColor: '#f97316', color: '#f97316' }}
                  >
                    ⚡ Trigger Battery Surplus Check
                  </Button>
                </div>
              )}
              </>
            )}
          </Card>
        )}

        {/* Market type + Buy/Sell toggle — always visible */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <select
            value={marketType || 'DAY_AHEAD'}
            onChange={(e) => setMarketType?.(e.target.value)}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 6,
              border: '1px solid #d9d9d9', fontSize: 12, fontWeight: 600,
              background: marketType === 'INTRADAY' ? '#fff7e6' : '#e6f7ff'
            }}
          >
            <option value="DAY_AHEAD">🌅 Day-Ahead (฿3.50/kWh)</option>
            <option value="INTRADAY">⚡ Intraday (฿3.50+/kWh)</option>
          </select>
          <select
            value={orderSide || 'OFFER'}
            onChange={(e) => setOrderSide?.(e.target.value)}
            style={{
              width: 100, padding: '6px 10px', borderRadius: 6,
              border: '1px solid #d9d9d9', fontSize: 12, fontWeight: 600,
              background: orderSide === 'BID' ? '#f6ffed' : '#fff1f0'
            }}
          >
            <option value="OFFER">📤 SELL</option>
            <option value="BID">📥 BUY</option>
          </select>
        </div>

        {/* Manual trade inputs — always visible */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>Amount (kWh)</div>
            <Input
              type="number"
              placeholder="0.00"
              value={energyAmount}
              onChange={(e) => setEnergyAmount(e.target.value)}
              min={0}
              style={{ width: '100%' }}
              suffix="kWh"
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>Price (THB/kWh)</div>
            <Input
              type="number"
              placeholder="0.00"
              value={energyRate}
              onChange={(e) => setEnergyRate(e.target.value)}
              min={0}
              step="0.01"
              style={{ width: '100%' }}
              suffix="THB"
            />
          </div>
        </div>

        {energyAmount && energyRate && (
          <div style={{ fontSize: 12, color: '#52c41a', marginBottom: 12, fontWeight: 600, textAlign: 'center' }}>
            💰 Total: {(Number(energyAmount) * Number(energyRate)).toFixed(2)} THB
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <Button
            type="primary"
            size="large"
            onClick={() => {
              const effectiveSource = (!isSolarArrayTarget && hasBatteryMeter) ? 'battery' : 'produce';
              setSellSource(effectiveSource);
              if (orderSide === 'BID') onBuy();
              else onSell(effectiveSource);
            }}
            disabled={!canSellFromSelectedBuilding}
            style={{
              height: 56, fontSize: 14, fontWeight: 700,
              background: orderSide === 'BID' ? '#52c41a' : '#ff4d4f',
              borderColor: orderSide === 'BID' ? '#52c41a' : '#ff4d4f',
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {orderSide === 'BID' ? '📥 PLACE BID (BUY)' : '📤 PLACE OFFER (SELL)'}
          </Button>
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

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
          Secured by Ethereum Blockchain
        </div>
      </Space>
    </div>
  );
}
