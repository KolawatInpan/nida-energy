import React from 'react';
import { Collapse, Tag } from 'antd';
import {
    BugOutlined,
    ClockCircleOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;

const PATCH_NOTES = [
    {
        date: '2026-07-06',
        time: '00:30',
        timezone: 'GMT+7',
        title: 'Mock Energy Accuracy, Plotly Charts & Bug Fixes',
        changes: [
            { color: '#16a34a', label: 'New: Plotly Charts', detail: 'All SVG charts replaced with Plotly (react-plotly.js). meter.js, report.js, dashboardHome.js, UserInsightCards.js, invoice.js. Hover tooltips, responsive, professional look.' },
            { color: '#2563eb', label: 'Mock Energy Overhaul', detail: 'Type-aware profiles: Solar=daylight half-sine (6am-6pm), Battery=charge/discharge cycle, Consumer=sinusoidal 24h. Large buildings ~130-160 kWh/day, small ~55-70. Capacity values calibrated: Ratchaphruek 5kW/20kWh, Malai 30kW.' },
            { color: '#7c3aed', label: 'Quick Register Rework', detail: '3 tiers: Ratchaphruek (Produce+Battery+Consume 3 meters), Malai (Produce+Consume 2), Auditorium (demo=producer, real=consumer), others (Consume only). Initial tokens = avg monthly consumption (4700/2000).' },
            { color: '#dc2626', label: 'Fixed: Battery Energy Not Returning', detail: 'cancelOffer now restores energy to meter. Previously energy was deducted at offer creation but never returned on cancel.' },
            { color: '#dc2626', label: 'Fixed: Live Reading 5,020 kW', detail: 'syncMeterSnapshotAndBuildingEnergy now stores instantaneous kW in value (not accumulated kWh). Battery uses accumulated kWh for SoC display.' },
            { color: '#16a34a', label: 'Trading Engine: Battery Full → Auto-Sell', detail: 'When battery is full (SELF_CONSUME mode), excess solar is automatically posted as market offer instead of being lost.' },
            { color: '#2563eb', label: 'Market Rules Adjusted', detail: 'Day-Ahead bid min: 3.50 (was 3.85). Intraday: 3.85-4.00 (was >= 4.00). All prices capped at grid price THB 4.00.' },
            { color: '#7c3aed', label: 'Default Trade Mode', detail: 'Buildings now default to Auto-Trade (AUTO_BATTERY_THRESHOLD) instead of Manual. Applies to both solar and battery on Quick Register.' },
            { color: '#d97706', label: 'Market: Sell-to-Bid Modal', detail: 'Replaced browser prompt() with Ant Design Modal. Shows source building selector (solar/battery), available kWh, total cost. Filters to buildings with energy meters only.' },
            { color: '#16a34a', label: 'Battery Source Selector', detail: 'Meter detail page: Solar vs Central Battery toggle. Central shows all zeros with warning. Moved to summary card next to title.' },
            { color: '#2563eb', label: 'API Status Improvements', detail: 'Cached data shown when feed unreachable. Meters sorted by kWh (highest first). Hide/show toggle per meter (persisted in localStorage). Sync preview modal shows highest/lowest energy before committing.' },
            { color: '#dc2626', label: 'Battery Reserve Default', detail: 'storageReserveMin: 80% → 10%. Most battery energy now available to sell.' },
            { color: '#7c3aed', label: 'Invoice Page Cleanup', detail: 'Shortened invoice ID display (8 chars). Removed "Complete payment for" prefix. Timeframe-aware labels throughout.' },
            { color: '#16a34a', label: 'Graph Improvements', detail: 'Custom date format (28 Jun to 4 Jul). X-axis: max 7 ticks. Y-axis: labeled with units. Dynamic tooltips. Timeframe-aware summary labels. Hover snap on meter chart.' },
        ],
    },
    {
        date: '2026-07-03',
        time: '09:50',
        timezone: 'GMT+7',
        title: 'Energy Feed API Integration',
        changes: [
            { color: '#16a34a', label: 'New: Energy Feed Cron', detail: 'Real-time meter data ingestion from external energy feed API (10.10.161.239:8089). Syncs logs to RunningMeter on real DB every 60s. Smart building-to-meter mapping via ENERGY_FEED_BUILDING_MAP.' },
            { color: '#2563eb', label: 'New: API Status Page', detail: 'Sidebar → System → 🔌 API Status. Monitor energy feed connection health, view virtual meters, and browse recent logs from the external data source.' },
            { color: '#d97706', label: 'Changed: Mock Energy → Demo Only', detail: 'Auto-mock energy cron now runs exclusively on demo DB. Real DB is fed by the external energy feed API instead.' },
            { color: '#7c3aed', label: 'Architecture', detail: 'External API → (fetch /meterlog) → Device→snid mapping → insertRunningMetersBulk → Hourly/Daily/Weekly/Monthly aggregation. All automatic.' },
        ],
    },
    {
        date: '2026-07-01',
        time: '14:30',
        timezone: 'GMT+7',
        title: 'Market Rules & Trading System Overhaul',
        changes: [
            { color: '#2563eb', label: 'New Market Rules', detail: 'Day-Ahead: 06:00 open, 18:00 lock, 00:00 match. Bid >= 3.85, Offer < 4.0, Base 3.5. IntraDay: Always open, min 4.0 THB/kWh, manual only (no auto-clearing).' },
            { color: '#7c3aed', label: 'Matching Priority', detail: 'Same-building first, then highest bid price, then lowest battery kWh. Force distribution to top consumers by urgency score.' },
            { color: '#16a34a', label: 'Energy Tracking', detail: 'Available Energy uses live meter value. Meter decrements immediately on offer creation. 3D Smart Grid shows today production & consumption (not all-time).' },
            { color: '#dc2626', label: 'Token Negative Balance', detail: 'Added balance checks before wallet decrement in matching. Buyers without sufficient tokens are skipped.' },
            { color: '#7c3aed', label: 'Force Distribution Reasons', detail: 'Priority table shows why buildings were skipped: No Battery (red), Insufficient Tokens, Seller Building (self-charged).' },
            { color: '#2563eb', label: 'Toast Notifications', detail: 'All alert() and confirm() replaced with Ant Design message toast and Modal.confirm. No more "localhost:3000 says" popups.' },
            { color: '#16a34a', label: 'Sell Exact Amount', detail: 'Fixed floating-point precision issue. Rounded comparison ensures selling the exact available amount works correctly.' },
            { color: '#d97706', label: 'Producer Meter Not Decreasing', detail: 'Auto-offers now decrement the meter at creation (same as manual). Energy correctly reflects after Force Clear.' },
        ],
    },
];

export default function PatchNotes() {
    return (
        <div style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    📋 Patch Notes
                </h1>
                <p style={{ color: '#64748b', marginTop: 4, fontSize: 13 }}>
                    Release history & changelog for NIDA LEMS Dashboard
                </p>
            </div>

            {PATCH_NOTES.map((patch, pIdx) => (
                <Collapse
                    key={pIdx}
                    defaultActiveKey={pIdx === 0 ? ['changes'] : []}
                    expandIconPosition="end"
                    style={{
                        marginBottom: 16,
                        background: '#fff',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                    }}
                >
                    <Panel
                        key="changes"
                        header={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                                <div style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    background: '#f0f9ff', borderRadius: 10, padding: '8px 14px',
                                    border: '1px solid #bae6fd', minWidth: 90,
                                }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1' }}>{patch.date}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                        <ClockCircleOutlined style={{ fontSize: 10, color: '#0ea5e9' }} />
                                        <span style={{ fontSize: 11, color: '#0c4a6e', fontWeight: 600 }}>{patch.time}</span>
                                    </div>
                                    <Tag color="blue" style={{ margin: '4px 0 0 0', fontSize: 9, lineHeight: '14px', padding: '0 4px' }}>
                                        {patch.timezone}
                                    </Tag>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                                        Patch Note
                                    </div>
                                    <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                                        {patch.title}
                                    </div>
                                </div>
                                <Tag color="blue" style={{ fontSize: 11 }}>
                                    {patch.changes.length} changes
                                </Tag>
                            </div>
                        }
                    >
                        <div style={{ padding: '4px 0 4px 16px' }}>
                            {patch.changes.map((change, cIdx) => (
                                <div
                                    key={cIdx}
                                    style={{
                                        display: 'flex', gap: 12, padding: '10px 0',
                                        borderBottom: cIdx < patch.changes.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    }}
                                >
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%', background: change.color,
                                        flexShrink: 0, marginTop: 4,
                                    }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>
                                            {change.label}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.6 }}>
                                            {change.detail}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Panel>
                </Collapse>
            ))}

            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 16 }}>
                NIDA LEMS Dashboard · All times in GMT+7
            </div>
        </div>
    );
}
