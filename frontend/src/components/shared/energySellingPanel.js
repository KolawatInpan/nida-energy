import React from 'react';
import { Card, Space, Button, Input, Select } from "antd";
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
  onClose,
  onSell,
  onBuy
}) {
  const producedKwh = Number(marketSnapshot?.producedKwh || 0);
  const consumedKwh = Number(marketSnapshot?.consumedKwh || 0);
  const netKwh = Number(marketSnapshot?.netKwh || 0);
  const marketPrice = Number(marketSnapshot?.marketPrice || selectedBuilding?.price || 0);
  const gridPrice = Number(marketSnapshot?.gridPrice || 4);
  const priceDelta = Number(marketSnapshot?.priceDelta || 0);
  const spread = Number(marketSnapshot?.spread || 0);
  const orderBookRows = Array.isArray(marketSnapshot?.orderBook) ? marketSnapshot.orderBook : [];
  const produceSource = sourceEnergyStatus?.produce || { current: 0, capacity: 0, percentage: '0.00', available: false };
  const batterySource = sourceEnergyStatus?.battery || { current: 0, capacity: 0, percentage: '0.00', available: false };
  const activeSourceStatus = sellSource === 'battery' ? batterySource : produceSource;
  const producedRatio = Math.min(100, Math.max(0, produceSource?.capacity ? (producedKwh / Math.max(produceSource.capacity, producedKwh, 1)) * 100 : producedKwh > 0 ? 100 : 0));
  const consumedRatio = Math.min(100, Math.max(0, producedKwh > 0 ? (consumedKwh / producedKwh) * 100 : consumedKwh > 0 ? 100 : 0));
  const netLabel = netKwh >= 0 ? 'Net Surplus: Selling to Grid' : 'Net Deficit: Buying from Grid';
  const netColor = netKwh >= 0 ? '#52c41a' : '#ff4d4f';
  const netBg = netKwh >= 0 ? '#f6ffed' : '#fff1f0';
  const netBorder = netKwh >= 0 ? '#b7eb8f' : '#ffa39e';
  const deltaLabel = `${priceDelta >= 0 ? '+' : ''}${formatToken(priceDelta)} (Grid: THB ${formatToken(gridPrice)})`;

  return (
    <div style={{ padding: "20px", height: "100%" }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Card className="head-bar" style={{ marginBottom: 8 }}>
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
            }}>PEAK DEMAND</div>
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

        {sourceEnergyStatus && (
          <Card className="head-bar" style={{ marginBottom: 8, backgroundColor: activeSourceStatus.available ? '#f6ffed' : '#fff2e8', borderColor: activeSourceStatus.available ? '#b7eb8f' : '#ffbb96' }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12, color: '#333' }}>Sell Energy Source</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setSellSource('produce')}
                style={{
                  border: sellSource === 'produce' ? '2px solid #16a34a' : '1px solid #d9d9d9',
                  background: sellSource === 'produce' ? '#f0fdf4' : '#fff',
                  borderRadius: 10,
                  padding: '12px 10px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 12, color: '#666', fontWeight: 700, marginBottom: 4 }}>PRODUCE METER</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{formatEnergy(produceSource.current)} <span style={{ fontSize: 12 }}>kWh</span></div>
                <div style={{ fontSize: 11, color: produceSource.available ? '#16a34a' : '#dc2626', marginTop: 4 }}>
                  {produceSource.available ? `${produceSource.percentage}% available` : 'No energy available'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSellSource('battery')}
                style={{
                  border: sellSource === 'battery' ? '2px solid #2563eb' : '1px solid #d9d9d9',
                  background: sellSource === 'battery' ? '#eff6ff' : '#fff',
                  borderRadius: 10,
                  padding: '12px 10px',
                  textAlign: 'left',
                  cursor: 'pointer'
                }}
              >
                <div style={{ fontSize: 12, color: '#666', fontWeight: 700, marginBottom: 4 }}>BATTERY</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{formatEnergy(batterySource.current)} <span style={{ fontSize: 12 }}>kWh</span></div>
                <div style={{ fontSize: 11, color: batterySource.available ? '#2563eb' : '#dc2626', marginTop: 4 }}>
                  {batterySource.available ? `${batterySource.percentage}% available` : 'No energy available'}
                </div>
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Selected Source:</span>
                <span style={{ fontSize: 14, color: '#333', fontWeight: 700 }}>{sellSource === 'battery' ? 'Battery' : 'Produce meter'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Current Energy:</span>
                <span style={{ fontSize: 14, color: '#333', fontWeight: 700 }}>{Math.round(activeSourceStatus.current)} kWh</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Capacity:</span>
                <span style={{ fontSize: 14, color: '#333', fontWeight: 700 }}>{Math.round(activeSourceStatus.capacity)} kWh</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>Available Level:</span>
                  <span style={{ fontSize: 16, color: Number(activeSourceStatus.percentage) > 50 ? '#52c41a' : Number(activeSourceStatus.percentage) > 20 ? '#faad14' : '#ff4d4f', fontWeight: 700 }}>{activeSourceStatus.percentage}%</span>
              </div>

              <div style={{ width: '100%', height: 24, backgroundColor: '#f0f0f0', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${Math.min(100, toNumber(activeSourceStatus.percentage))}%`,
                  height: '100%',
                  backgroundColor: Number(activeSourceStatus.percentage) > 50 ? '#52c41a' : Number(activeSourceStatus.percentage) > 20 ? '#faad14' : '#ff4d4f',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: 11, color: 'white', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{activeSourceStatus.percentage}%</span>
                </div>
              </div>
            </div>

            {!activeSourceStatus.available && (
              <div style={{ padding: 10, backgroundColor: '#fff1f0', borderRadius: 6, borderLeft: '4px solid #ff4d4f' }}>
                <span style={{ fontSize: 12, color: '#cf1322', fontWeight: 600 }}>No energy available to sell from the {sellSource === 'battery' ? 'battery' : 'produce meter'}.</span>
              </div>
            )}
          </Card>
        )}

        <Card className="head-bar" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 12 }}>Configure Trade Amount</div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Energy Amount (kWh)</div>
            <Input
              type="number"
              placeholder="Enter amount (kWH)"
              value={energyAmount}
              onChange={(e) => setEnergyAmount(e.target.value)}
              style={{ width: "100%" }}
              size="large"
              min={0}
              max={activeSourceStatus ? activeSourceStatus.current : undefined}
              suffix="kWh"
            />
            {sourceEnergyStatus && energyAmount && Number(energyAmount) > activeSourceStatus.current && (
              <div style={{
                color: '#ff4d4f',
                fontSize: 11,
                marginTop: 6,
                padding: 8,
                backgroundColor: '#fff2f0',
                borderRadius: 4,
                borderLeft: '3px solid #ff4d4f'
              }}>
                  Cannot sell more than available from {sellSource === 'battery' ? 'battery' : 'produce meter'}: {Math.round(activeSourceStatus.current)} kWh
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 600 }}>Price Per Unit</div>
            <Input
              type="number"
              placeholder="Enter rate (Token/kWh)"
              value={energyRate}
              onChange={(e) => setEnergyRate(e.target.value)}
              style={{ width: "100%" }}
              size="large"
              min={0}
              step="0.01"
              suffix="Token/kWh"
            />
            {amountNum > 0 && rateNum > 0 && (
              <div style={{ fontSize: 11, color: '#52c41a', marginTop: 6, fontWeight: 600 }}>
                Total: {formatToken(totalToken)} Tokens
              </div>
            )}
          </div>
        </Card>

        {bid > 0 && (
          <Card className="head-bar" style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>To Building (Purchase Destination)</div>
            <Select
              placeholder="Select destination building"
              value={targetBuildingForPurchase}
              onChange={(value) => setTargetBuildingForPurchase(value)}
              style={{ width: "100%" }}
              size="large"
              optionLabelProp="label"
            >
              {destinationBuildings
                .filter((building) => Number(building.id) !== Number(selectedBuilding?.id))
                .map((building) => (
                <Select.Option key={building.id} value={building.id}>
                  <span>{building.name}</span>
                  <span style={{ color: '#999', marginLeft: 8 }}>({building.meterName || building.snid || 'Battery-enabled'})</span>
                </Select.Option>
              ))}
            </Select>
          </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Button
            type="primary"
            size="large"
            disabled={!canSellFromSelectedBuilding}
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

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: "#999" }}>
          Secured by Ethereum Blockchain
        </div>
      </Space>
    </div>
  );
}
