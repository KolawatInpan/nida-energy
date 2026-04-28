import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../../store/auth/auth.action";
import { getMember } from '../../store/member/member.action';
import { useTOR } from '../../global/TORContext';
import { getBuildings, getMetersByBuilding } from '../../core/data_connecter/register';
import { searchBuildingEnergy } from '../../core/data_connecter/dashboard';
import Key from '../../global/key';
import { buildThreeHourSeries, formatDateLocal, getLatestMeterDate, toNumeric } from '../../utils/energyAnalytics';

const buildEmptyChartData = (days) => Array.from({ length: days }, (_, index) => ({
    day: `Day ${index + 1}`,
    pvProduction: 0,
    consumption: 0,
    batterySoC: 0,
}));

const normalizeBackendBuildingName = (name) => {
    const bname = (name || '').toString().toLowerCase();
    if (bname === 'nidasumpan') return 'nidasumpun';
    if (bname === 'narathip') return 'naradhip';
    return bname;
};

const slugify = (name) => String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

const meterTypeOf = (m) => (m?.type || '').toString().toLowerCase();
const hasBatteryMeter = (m) => meterTypeOf(m).includes('battery');

const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
        x: cx + (radius * Math.cos(angleInRadians)),
        y: cy + (radius * Math.sin(angleInRadians)),
    };
};

const describeArc = (cx, cy, radius, startAngle, endAngle) => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
        'M', cx, cy,
        'L', start.x, start.y,
        'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        'Z',
    ].join(' ');
};

const downloadBlobFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const DEFAULT_MEMBER = {
    name: 'Admin User',
    role: 'ADMIN',
    email: '',
};

const normalizeRoleName = (member) => {
    const roleValue = member?.role ?? member?.userRole ?? member?.type ?? null;
    return String(roleValue || 'ADMIN').trim().toUpperCase();
};

const getMemberInitials = (member) => {
    const source = String(member?.name || member?.email || 'Admin User').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};

const getDaysForRange = (range) => (range === '7days' ? 7 : range === '30days' ? 30 : 90);

// Export functions
const exportToExcel = () => {
    // Generate CSV data
    const csvData = [
        ['Total Energy Analytics Report', '', '', ''],
        ['Generated:', new Date().toLocaleDateString(), '', ''],
        ['', '', '', ''],
        ['Energy Summary', '', '', ''],
        ['Source', 'Value', 'Percentage', ''],
        ['Solar PV', '420 kWH', '24%', ''],
        ['Battery Storage', '280 kWH', '16%', ''],
        ['Grid Power', '1050 kWH', '60%', ''],
        ['', '', '', ''],
        ['Top Consumers', '', '', ''],
        ['Building', 'Consumption', 'Percentage', 'Status'],
        ['Ratchaphruk Building', '1,050 kWH', '20%', 'Near Limit'],
        ['Malai Building', '700 kWH', '28%', 'Optimal'],
        ['Admin Center', '525 kWH', '15%', 'Optimal'],
        ['Engineering Building', '420 kWH', '12%', 'Optimal'],
        ['', '', '', ''],
        ['Battery Assets', '', '', ''],
        ['Building', 'Battery SoC', 'Health Status', 'Status'],
        ['Ratchaphruk Building', '78%', 'Optimal', 'Active'],
        ['Admin Center', '45%', 'Good', 'Charging'],
        ['Engineering Building', '22%', 'Degraded', 'Low'],
        ['Malai Building', 'N/A', 'N/A', 'No Battery'],
    ];

    // Convert to CSV string
    const csvContent = csvData.map(row => row.join(',')).join('\\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const exportToPDF = () => {
    // Create a simple HTML content for PDF
    const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Total Energy Analytics Report</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; }
                h1 { color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
                h2 { color: #374151; margin-top: 30px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
                th { background-color: #f3f4f6; font-weight: bold; }
                .summary { background-color: #eff6ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .alert { background-color: #fff7ed; padding: 15px; border-left: 4px solid #f97316; margin: 20px 0; }
            </style>
        </head>
        <body>
            <h1>Total Energy Analytics Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Blockchain Verified:</strong> ✓</p>
            
            <div class="summary">
                <h2>Energy Source Breakdown</h2>
                <table>
                    <tr><th>Source</th><th>Value</th><th>Percentage</th></tr>
                    <tr><td>Solar PV</td><td>420 kWH</td><td>24%</td></tr>
                    <tr><td>Battery Storage</td><td>280 kWH</td><td>16%</td></tr>
                    <tr><td>Grid Power</td><td>1,050 kWH</td><td>60%</td></tr>
                </table>
            </div>
            
            <h2>Top Consumers</h2>
            <table>
                <tr><th>Building</th><th>Consumption</th><th>Percentage</th><th>Status</th></tr>
                <tr><td>Ratchaphruk Building</td><td>1,050 kWH</td><td>20%</td><td>Near Limit</td></tr>
                <tr><td>Malai Building</td><td>700 kWH</td><td>28%</td><td>Optimal</td></tr>
                <tr><td>Admin Center</td><td>525 kWH</td><td>15%</td><td>Optimal</td></tr>
                <tr><td>Engineering Building</td><td>420 kWH</td><td>12%</td><td>Optimal</td></tr>
            </table>
            
            <h2>Battery Assets Status</h2>
            <table>
                <tr><th>Building</th><th>Battery SoC</th><th>Health Status</th><th>Status</th></tr>
                <tr><td>Ratchaphruk Building</td><td>78%</td><td>Optimal</td><td>Active</td></tr>
                <tr><td>Admin Center</td><td>45%</td><td>Good</td><td>Charging</td></tr>
                <tr><td>Engineering Building</td><td>22%</td><td>Degraded</td><td>Low</td></tr>
                <tr><td>Malai Building</td><td>N/A</td><td>N/A</td><td>No Battery</td></tr>
            </table>
            
            <div class="alert">
                <h3>⚠️ Preventive Maintenance Alert</h3>
                <p>Engineering Building battery shows degraded SoH. Recommend inspection within 30 days to prevent performance impact.</p>
            </div>
        </body>
        </html>
    `;
    
    // Create blob and download as HTML (can be printed to PDF)
    const blob = new Blob([reportContent], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `energy_report_${new Date().toISOString().split('T')[0]}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Open in new window for printing to PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(reportContent);
    printWindow.document.close();
};

export default function Report() {
    const history = useHistory();
    const dispatch = useDispatch();
    const memberStore = useSelector((store) => store.member.all);
    const { showTOR } = useTOR();
    const [timeRange, setTimeRange] = useState('7days');
    const [chartData, setChartData] = useState(buildEmptyChartData(7));
    const [buildingOptions, setBuildingOptions] = useState([]);
    const [buildingStats, setBuildingStats] = useState({});
    const [topConsumers, setTopConsumers] = useState([]);
    const [compareWithBattery, setCompareWithBattery] = useState('');
    const [compareWithoutBattery, setCompareWithoutBattery] = useState('');
    const [comparisonCharts, setComparisonCharts] = useState({});
    const [member, setMember] = useState(DEFAULT_MEMBER);

    useEffect(() => {
        dispatch(validateAuth());
        const storedUserId = localStorage.getItem(Key.UserId);
        if (storedUserId) {
            dispatch(getMember(storedUserId));
        }
    }, [dispatch]);

    useEffect(() => {
        if (Array.isArray(memberStore) && memberStore.length > 0) {
            setMember(memberStore[0]);
            return;
        }

        if (memberStore && typeof memberStore === 'object' && Object.keys(memberStore).length > 0) {
            setMember(memberStore);
        }
    }, [memberStore]);

    useEffect(() => {
        const fetchReportMetrics = async () => {
            try {
                const days = getDaysForRange(timeRange);
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - (days - 1));
                const start = formatDateLocal(startDate);
                const end = formatDateLocal(endDate);

                const bres = await getBuildings();
                const buildings = Array.isArray(bres) ? bres : (bres?.data || bres?.buildings || []);

                const statsEntries = await Promise.all((buildings || []).map(async (b) => {
                    const displayName = (b?.name || '').toString();
                    const backendName = normalizeBackendBuildingName(displayName);

                    let meters = [];
                    try {
                        const mres = await getMetersByBuilding(b.id);
                        meters = Array.isArray(mres) ? mres : (mres?.data || []);
                    } catch (e) {
                        meters = [];
                    }

                    const batteryMeter = (meters || []).find(hasBatteryMeter);
                    const hasBattery = Boolean(batteryMeter);
                    const batteryValue = toNumeric(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
                    const batteryCap = toNumeric(batteryMeter?.capacity ?? 0);
                    const batteryPct = batteryCap > 0 ? Math.max(0, Math.min(100, Math.round((batteryValue / batteryCap) * 100))) : 0;

                    let productionTotal = 0;
                    let consumptionTotal = 0;
                    let batteryTotal = 0;
                    try {
                        const eres = await searchBuildingEnergy({
                            building: backendName,
                            start,
                            end,
                            timeunit: 'day'
                        });
                        const payload = eres?.data || {};
                        if (payload.result === 'success') {
                            productionTotal = (payload.production?.value || []).reduce((s, v) => s + Number(v || 0), 0);
                            consumptionTotal = (payload.consumption?.value || []).reduce((s, v) => s + Number(v || 0), 0);
                            batteryTotal = (payload.battery?.value || []).reduce((s, v) => s + Number(v || 0), 0);
                        }
                    } catch (e) {
                        productionTotal = 0;
                        consumptionTotal = 0;
                        batteryTotal = 0;
                    }

                    return [displayName, {
                        id: b.id,
                        name: displayName,
                        production: Math.round(productionTotal),
                        consumption: Math.round(consumptionTotal),
                        batteryFlow: Math.round(batteryTotal),
                        hasBattery,
                        batteryValue: Math.round(batteryValue),
                        batteryCap: Math.round(batteryCap),
                        batteryPct
                    }];
                }));

                const statsMap = Object.fromEntries(statsEntries);
                setBuildingStats(statsMap);
                setBuildingOptions(Object.values(statsMap).map((v) => v.name));

                const ranked = Object.values(statsMap)
                    .sort((a, b) => b.consumption - a.consumption)
                    .slice(0, 4);
                setTopConsumers(ranked);

                const withBattery = Object.values(statsMap).find((x) => x.hasBattery);
                const withoutBattery = Object.values(statsMap).find((x) => !x.hasBattery);

                if (!compareWithBattery || !statsMap[compareWithBattery]) {
                    setCompareWithBattery(withBattery?.name || ranked[0]?.name || '');
                }
                if (!compareWithoutBattery || !statsMap[compareWithoutBattery]) {
                    const fallback = withoutBattery?.name || ranked[1]?.name || ranked[0]?.name || '';
                    setCompareWithoutBattery(fallback);
                }
            } catch (err) {
                console.error('fetchReportMetrics error', err);
            }
        };

        fetchReportMetrics();
    }, [timeRange, compareWithBattery, compareWithoutBattery]);

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const days = getDaysForRange(timeRange);
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - (days - 1));
                const start = formatDateLocal(startDate);
                const end = formatDateLocal(endDate);

                const bres = await getBuildings();
                const buildings = Array.isArray(bres) ? bres : (bres?.data || bres?.buildings || []);

                if (!buildings.length) {
                    setChartData(buildEmptyChartData(days));
                    return;
                }

                const energyResponses = await Promise.all(
                    buildings.map((building) =>
                        searchBuildingEnergy({
                            building: normalizeBackendBuildingName(building?.name),
                            start,
                            end,
                            timeunit: 'day',
                        }).catch(() => null)
                    )
                );

                const batteryRows = await Promise.all(
                    buildings.map(async (building) => {
                        try {
                            const metersRes = await getMetersByBuilding(building.id);
                            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
                            const batteryMeter = (meters || []).find(hasBatteryMeter);
                            const batteryValue = toNumeric(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
                            const batteryCap = toNumeric(batteryMeter?.capacity ?? 0);
                            return batteryCap > 0 ? Math.max(0, Math.min(100, Math.round((batteryValue / batteryCap) * 100))) : null;
                        } catch (error) {
                            return null;
                        }
                    })
                );

                const batteryValues = batteryRows.filter((value) => value !== null);
                const averageBatteryPct = batteryValues.length
                    ? batteryValues.reduce((sum, value) => sum + toNumeric(value), 0) / batteryValues.length
                    : 0;

                const labels = Array.from({ length: days }, (_, index) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + index);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });

                const productionMap = new Map(labels.map((label) => [label, 0]));
                const consumptionMap = new Map(labels.map((label) => [label, 0]));

                energyResponses.forEach((response) => {
                    const payload = response?.data || {};
                    const productionValues = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                    const consumptionValues = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];

                    labels.forEach((label, index) => {
                        productionMap.set(label, toNumeric(productionMap.get(label)) + toNumeric(productionValues[index]));
                        consumptionMap.set(label, toNumeric(consumptionMap.get(label)) + toNumeric(consumptionValues[index]));
                    });
                });

                setChartData(labels.map((label) => ({
                    day: label,
                    pvProduction: toNumeric(productionMap.get(label)),
                    consumption: toNumeric(consumptionMap.get(label)),
                    batterySoC: averageBatteryPct,
                })));
            } catch (error) {
                console.error('Failed to load report chart data:', error);
                setChartData(buildEmptyChartData(getDaysForRange(timeRange)));
            }
        };

        fetchChartData();
    }, [timeRange]);

    useEffect(() => {
        const fetchComparisonCharts = async () => {
            const selectedNames = [compareWithBattery, compareWithoutBattery].filter(Boolean);
            if (!selectedNames.length) {
                setComparisonCharts({});
                return;
            }

            try {
                const buildingsRes = await getBuildings();
                const buildings = Array.isArray(buildingsRes) ? buildingsRes : (buildingsRes?.data || buildingsRes?.buildings || []);

                const entries = await Promise.all(selectedNames.map(async (name) => {
                    const building = buildings.find((item) => item?.name === name);
                    let anchorDate = formatDateLocal(new Date());

                    if (building?.id) {
                        try {
                            const metersRes = await getMetersByBuilding(building.id);
                            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
                            anchorDate = getLatestMeterDate(meters);
                        } catch (error) {
                            anchorDate = formatDateLocal(new Date());
                        }
                    }

                    const response = await searchBuildingEnergy({
                        building: normalizeBackendBuildingName(name),
                        start: anchorDate,
                        end: anchorDate,
                        timeunit: 'hour',
                    });

                    const payload = response?.data?.result === 'success' ? response.data : {};
                    return [name, buildThreeHourSeries(payload)];
                }));

                setComparisonCharts(Object.fromEntries(entries));
            } catch (error) {
                console.error('Failed to load comparison charts:', error);
                setComparisonCharts({});
            }
        };

        fetchComparisonCharts();
    }, [compareWithBattery, compareWithoutBattery]);

    const totalTopConsumption = topConsumers.reduce((sum, row) => sum + Number(row.consumption || 0), 0);
    const topConsumptionMax = Math.max(1, ...topConsumers.map((r) => Number(r.consumption || 0)));
    const compareLeft = buildingStats[compareWithBattery] || null;
    const compareRight = buildingStats[compareWithoutBattery] || null;
    const compareLeftSeries = comparisonCharts[compareWithBattery] || buildThreeHourSeries({});
    const compareRightSeries = comparisonCharts[compareWithoutBattery] || buildThreeHourSeries({});
    const memberRoleLabel = useMemo(() => normalizeRoleName(member), [member]);
    const memberInitials = useMemo(() => getMemberInitials(member), [member]);
    const batteryAssets = useMemo(() => (
        Object.values(buildingStats)
            .filter((entry) => entry.hasBattery)
            .sort((a, b) => toNumeric(b.batteryPct) - toNumeric(a.batteryPct))
    ), [buildingStats]);
    const sourceBreakdown = useMemo(() => {
        const solar = Object.values(buildingStats).reduce((sum, entry) => sum + toNumeric(entry.production), 0);
        const battery = Object.values(buildingStats).reduce((sum, entry) => sum + toNumeric(entry.batteryFlow), 0);
        const consumption = Object.values(buildingStats).reduce((sum, entry) => sum + toNumeric(entry.consumption), 0);
        const grid = consumption;
        const total = Math.max(1, solar + battery + grid);

        const items = [
            { key: 'solar', label: 'Solar PV', value: Math.round(solar), color: '#22c55e', bg: 'bg-green-50', text: 'text-green-600' },
            { key: 'battery', label: 'Battery Storage', value: Math.round(battery), color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-600' },
            { key: 'grid', label: 'Grid Power', value: Math.round(grid), color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-600' },
        ].map((item) => ({
            ...item,
            pct: Math.round((item.value / total) * 100),
        }));

        let startAngle = 0;
        const arcs = items.map((item, index) => {
            const rawSweep = (item.value / total) * 360;
            const sweep = index === items.length - 1 ? Math.max(0, 360 - startAngle) : rawSweep;
            const arc = {
                ...item,
                path: describeArc(140, 140, 120, startAngle, startAngle + sweep),
            };
            startAngle += sweep;
            return arc;
        });

        return { items: arcs, total };
    }, [buildingStats]);
    const maintenanceAlert = useMemo(() => (
        batteryAssets
            .filter((entry) => toNumeric(entry.batteryPct) > 0)
            .sort((a, b) => toNumeric(a.batteryPct) - toNumeric(b.batteryPct))[0] || null
    ), [batteryAssets]);

    const exportCurrentReport = () => {
        const generatedAt = new Date();
        const chartRows = chartData.map((entry) => ([
            entry.day,
            toNumeric(entry.pvProduction).toFixed(2),
            toNumeric(entry.consumption).toFixed(2),
            toNumeric(entry.batterySoC).toFixed(2),
        ]));

        const buildingRows = Object.values(buildingStats).map((entry) => ([
            entry.name || '-',
            toNumeric(entry.production).toFixed(2),
            toNumeric(entry.consumption).toFixed(2),
            entry.hasBattery ? 'Yes' : 'No',
            `${toNumeric(entry.batteryPct).toFixed(0)}%`,
            `${toNumeric(entry.batteryValue).toFixed(2)} / ${toNumeric(entry.batteryCap).toFixed(2)}`,
        ]));

        const consumerRows = topConsumers.map((entry, index) => ([
            index + 1,
            entry.name || '-',
            toNumeric(entry.consumption).toFixed(2),
            totalTopConsumption > 0 ? `${((toNumeric(entry.consumption) / totalTopConsumption) * 100).toFixed(2)}%` : '0.00%',
        ]));

        const compareRows = [
            ['With Battery', compareLeft?.name || '-'],
            ['With Battery Production (kWh)', toNumeric(compareLeft?.production).toFixed(2)],
            ['With Battery Consumption (kWh)', toNumeric(compareLeft?.consumption).toFixed(2)],
            ['With Battery SoC (%)', toNumeric(compareLeft?.batteryPct).toFixed(0)],
            ['Without Battery', compareRight?.name || '-'],
            ['Without Battery Production (kWh)', toNumeric(compareRight?.production).toFixed(2)],
            ['Without Battery Consumption (kWh)', toNumeric(compareRight?.consumption).toFixed(2)],
        ];

        const csvRows = [
            ['Total Energy Analytics Report'],
            ['Generated At', generatedAt.toLocaleString()],
            ['Time Range', timeRange],
            [],
            ['System Energy Production vs Consumption'],
            ['Period', 'PV Production (kWh)', 'Consumption (kWh)', 'Battery SoC (%)'],
            ...chartRows,
            [],
            ['Top Consumers'],
            ['Rank', 'Building', 'Consumption (kWh)', 'Share'],
            ...consumerRows,
            [],
            ['Building Energy Summary'],
            ['Building', 'Production (kWh)', 'Consumption (kWh)', 'Battery Installed', 'Battery SoC', 'Battery Level / Capacity'],
            ...buildingRows,
            [],
            ['Battery vs Non-Battery Comparison'],
            ['Metric', 'Value'],
            ...compareRows,
        ];

        const csvContent = csvRows
            .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
            .join('\n');

        downloadBlobFile(
            csvContent,
            `energy_analytics_report_${generatedAt.toISOString().split('T')[0]}.csv`,
            'text/csv;charset=utf-8;'
        );
    };

    const exportCurrentPdf = () => {
        const generatedAt = new Date();
        const batteryRowsHtml = batteryAssets.length
            ? batteryAssets.map((entry) => `
                <tr>
                    <td>${entry.name || '-'}</td>
                    <td>${toNumeric(entry.batteryPct).toFixed(0)}%</td>
                    <td>${toNumeric(entry.batteryValue).toFixed(2)} / ${toNumeric(entry.batteryCap).toFixed(2)} kWh</td>
                </tr>
            `).join('')
            : `<tr><td colspan="3">No battery assets found</td></tr>`;

        const topConsumerRowsHtml = topConsumers.length
            ? topConsumers.map((entry) => `
                <tr>
                    <td>${entry.name || '-'}</td>
                    <td>${toNumeric(entry.consumption).toFixed(2)} kWh</td>
                    <td>${totalTopConsumption > 0 ? ((toNumeric(entry.consumption) / totalTopConsumption) * 100).toFixed(2) : '0.00'}%</td>
                </tr>
            `).join('')
            : `<tr><td colspan="3">No consumer ranking available</td></tr>`;

        const reportContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Total Energy Analytics Report</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
                    h1 { border-bottom: 3px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
                    h2 { margin-top: 28px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
                    th { background: #f8fafc; }
                    .summary { background: #eff6ff; border-radius: 10px; padding: 16px; margin-top: 20px; }
                    .alert { background: #fff7ed; border-left: 4px solid #f97316; padding: 16px; margin-top: 24px; }
                </style>
            </head>
            <body>
                <h1>Total Energy Analytics Report</h1>
                <p><strong>Generated At:</strong> ${generatedAt.toLocaleString()}</p>
                <p><strong>Time Range:</strong> ${timeRange}</p>

                <div class="summary">
                    <p><strong>Total PV Production:</strong> ${chartData.reduce((sum, row) => sum + toNumeric(row.pvProduction), 0).toFixed(2)} kWh</p>
                    <p><strong>Total Consumption:</strong> ${chartData.reduce((sum, row) => sum + toNumeric(row.consumption), 0).toFixed(2)} kWh</p>
                    <p><strong>Average Battery SoC:</strong> ${batteryAssets.length ? (batteryAssets.reduce((sum, row) => sum + toNumeric(row.batteryPct), 0) / batteryAssets.length).toFixed(0) : '0'}%</p>
                </div>

                <h2>Top Consumers</h2>
                <table>
                    <tr><th>Building</th><th>Consumption</th><th>Share</th></tr>
                    ${topConsumerRowsHtml}
                </table>

                <h2>Battery Assets Status</h2>
                <table>
                    <tr><th>Building</th><th>Battery SoC</th><th>Stored / Capacity</th></tr>
                    ${batteryRowsHtml}
                </table>

                ${maintenanceAlert ? `
                    <div class="alert">
                        <h3>Preventive Maintenance Alert</h3>
                        <p>${maintenanceAlert.name} has the lowest battery SoC at ${toNumeric(maintenanceAlert.batteryPct).toFixed(0)}%. Recommend inspection if this persists.</p>
                    </div>
                ` : ''}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(reportContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const ComparisonBarChart = ({ series = [], showBattery = false }) => {
        const width = 500;
        const height = 300;
        const padding = { top: 24, right: 20, bottom: 48, left: 50 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const maxValue = Math.max(
            1,
            ...series.flatMap((entry) => showBattery
                ? [toNumeric(entry.pvProduction), toNumeric(entry.consumption), toNumeric(entry.batteryDischarge)]
                : [toNumeric(entry.pvProduction), toNumeric(entry.consumption)])
        );
        const ticks = 5;
        const roundedMax = Math.ceil(maxValue / 10) * 10;
        const groupWidth = chartWidth / Math.max(series.length, 1);
        const barsPerGroup = showBattery ? 3 : 2;
        const barWidth = Math.min(18, Math.max(10, (groupWidth - 16) / barsPerGroup));
        const groupInnerWidth = barWidth * barsPerGroup + 8 * (barsPerGroup - 1);
        const yScale = (value) => padding.top + chartHeight - (toNumeric(value) / roundedMax) * chartHeight;

        return (
            <svg width="100%" height="300" viewBox={`0 0 ${width} ${height}`} className="bg-white rounded-lg">
                {Array.from({ length: ticks + 1 }, (_, index) => {
                    const y = padding.top + (index * chartHeight / ticks);
                    const value = Math.round(roundedMax - (index * roundedMax / ticks));
                    return (
                        <g key={`cmp-grid-${index}`}>
                            <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                            <text x={padding.left - 10} y={y} textAnchor="end" fontSize="11" fill="#6b7280" dominantBaseline="middle">
                                {value}
                            </text>
                        </g>
                    );
                })}

                {series.map((entry, index) => {
                    const groupX = padding.left + index * groupWidth + (groupWidth - groupInnerWidth) / 2;
                    const pvHeight = chartHeight - (yScale(entry.pvProduction) - padding.top);
                    const consumptionHeight = chartHeight - (yScale(entry.consumption) - padding.top);
                    const batteryHeight = chartHeight - (yScale(entry.batteryDischarge) - padding.top);
                    return (
                        <g key={`cmp-group-${entry.label}`}>
                            <rect x={groupX} y={yScale(entry.pvProduction)} width={barWidth} height={pvHeight} fill="#22c55e" rx="3" />
                            <rect x={groupX + barWidth + 8} y={yScale(entry.consumption)} width={barWidth} height={consumptionHeight} fill="#ef4444" rx="3" />
                            {showBattery && (
                                <rect x={groupX + (barWidth + 8) * 2} y={yScale(entry.batteryDischarge)} width={barWidth} height={batteryHeight} fill="#f97316" rx="3" />
                            )}
                            <text x={padding.left + index * groupWidth + groupWidth / 2} y={height - 18} textAnchor="middle" fontSize="11" fill="#6b7280">
                                {entry.label}
                            </text>
                        </g>
                    );
                })}

                <text x="22" y="18" fontSize="11" fill="#6b7280" fontWeight="500">kWH</text>
            </svg>
        );
    };

    // SVG Chart Component
    const EnergyChart = ({ data }) => {
        const width = 800;
        const height = 400;
        const padding = { top: 20, right: 60, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate scales
        const maxEnergy = 450;
        const minEnergy = 0;
        const maxSoC = 70;
        const minSoC = 45;

        const xScale = (index) => padding.left + (index / (data.length - 1)) * chartWidth;
        const yScaleEnergy = (value) => padding.top + chartHeight - ((value - minEnergy) / (maxEnergy - minEnergy)) * chartHeight;
        const yScaleSoC = (value) => padding.top + chartHeight - ((value - minSoC) / (maxSoC - minSoC)) * chartHeight;

        // Create path strings
        const createPath = (dataKey, scale) => {
            return data.map((d, i) => {
                const x = xScale(i);
                const y = scale(d[dataKey]);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
        };

        const pvPath = createPath('pvProduction', yScaleEnergy);
        const consumptionPath = createPath('consumption', yScaleEnergy);
        const batteryPath = createPath('batterySoC', yScaleSoC);

        // Create fill area for PV Production
        const pvFillPath = pvPath + ` L ${xScale(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

        return (
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
                {/* Grid lines */}
                {[0, 1, 2, 3, 4].map((i) => {
                    const y = padding.top + (i * chartHeight / 4);
                    return (
                        <line
                            key={`grid-${i}`}
                            x1={padding.left}
                            y1={y}
                            x2={padding.left + chartWidth}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                        />
                    );
                })}

                {/* Fill area for PV Production */}
                <path
                    d={pvFillPath}
                    fill="rgba(34, 197, 94, 0.1)"
                    stroke="none"
                />

                {/* PV Production line (green) */}
                <path
                    d={pvPath}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Consumption line (red) */}
                <path
                    d={consumptionPath}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Battery SoC line (orange dotted) */}
                <path
                    d={batteryPath}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2.5"
                    strokeDasharray="8,4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points for PV Production */}
                {data.map((d, i) => (
                    <circle
                        key={`pv-${i}`}
                        cx={xScale(i)}
                        cy={yScaleEnergy(d.pvProduction)}
                        r="4"
                        fill="#22c55e"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Data points for Consumption */}
                {data.map((d, i) => (
                    <circle
                        key={`con-${i}`}
                        cx={xScale(i)}
                        cy={yScaleEnergy(d.consumption)}
                        r="4"
                        fill="#ef4444"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Data points for Battery SoC */}
                {data.map((d, i) => (
                    <circle
                        key={`bat-${i}`}
                        cx={xScale(i)}
                        cy={yScaleSoC(d.batterySoC)}
                        r="4"
                        fill="#f97316"
                        stroke="white"
                        strokeWidth="2"
                    />
                ))}

                {/* Y-axis labels (left - Energy) */}
                {[0, 100, 200, 300, 400].map((value, i) => (
                    <text
                        key={`y-energy-${i}`}
                        x={padding.left - 10}
                        y={yScaleEnergy(value)}
                        textAnchor="end"
                        fontSize="12"
                        fill="#6b7280"
                        dominantBaseline="middle"
                    >
                        {value}
                    </text>
                ))}

                {/* Y-axis labels (right - Battery SoC) */}
                {[46, 50, 55, 60, 65].map((value, i) => (
                    <text
                        key={`y-soc-${i}`}
                        x={padding.left + chartWidth + 10}
                        y={yScaleSoC(value)}
                        textAnchor="start"
                        fontSize="12"
                        fill="#6b7280"
                        dominantBaseline="middle"
                    >
                        {value}
                    </text>
                ))}

                {/* X-axis labels */}
                {data.map((d, i) => {
                    // Show fewer labels for longer time ranges
                    const showLabel = data.length <= 7 ? true : i % Math.ceil(data.length / 7) === 0;
                    if (!showLabel) return null;
                    return (
                        <text
                            key={`x-${i}`}
                            x={xScale(i)}
                            y={padding.top + chartHeight + 25}
                            textAnchor="middle"
                            fontSize="12"
                            fill="#6b7280"
                        >
                            {d.day}
                        </text>
                    );
                })}

                {/* Y-axis label (left) */}
                <text
                    x={padding.left - 45}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                    transform={`rotate(-90 ${padding.left - 45} ${padding.top + chartHeight / 2})`}
                >
                    Energy (kWH)
                </text>

                {/* Y-axis label (right) */}
                <text
                    x={padding.left + chartWidth + 45}
                    y={padding.top + chartHeight / 2}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                    transform={`rotate(90 ${padding.left + chartWidth + 45} ${padding.top + chartHeight / 2})`}
                >
                    Battery SoC (%)
                </text>

                {/* X-axis label */}
                <text
                    x={padding.left + chartWidth / 2}
                    y={height - 5}
                    textAnchor="middle"
                    fontSize="13"
                    fill="#6b7280"
                    fontWeight="500"
                >
                    Timeline
                </text>
            </svg>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">

                {/* TOR Requirements Panel */}
                {showTOR && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                        <h2 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                            <span>📋</span> TOR Requirements — Report
                        </h2>
                        <div className="space-y-4 text-sm text-blue-900">
                            <div>
                                <span className="font-bold text-blue-700">7.2.1</span>
                                <p className="mt-1 leading-relaxed">ติดตั้งระบบเทคโนโลยี Blockchain ใช้งานกับระบบผลิตพลังงานไฟฟ้า</p>
                                <ul className="mt-2 ml-4 list-disc space-y-1 text-blue-800">
                                    <li>สามารถดูรายงานสรุปข้อมูลการผลิตไฟฟ้าแยกตาม วัน เดือน ปี ที่กำหนดได้</li>
                                </ul>
                            </div>
                            <div>
                                <span className="font-bold text-blue-700">7.3.8</span>
                                <p className="mt-1 leading-relaxed">สามารถแสดงผลการวิเคราะห์ข้อมูล (Energy Data Visualization) บนส่วนแสดงผลข้อมูล (Dashboard) การวิเคราะห์ข้อมูลการผลิตพลังงานไฟฟ้าจากแสงอาทิตย์</p>
                            </div>
                            <div>
                                <span className="font-bold text-blue-700">7.3.9</span>
                                <p className="mt-1 leading-relaxed">สามารถนำผลการวิเคราะห์ข้อมูลในรูปแบบของรายงานได้ (Summary Report)</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-1">Total Energy Analytics</h1>
                        <p className="text-sm text-gray-600">Comprehensive energy production, consumption & battery insights</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-lg">
                            <span className="text-purple-600 text-xl">💰</span>
                            <div>
                                <p className="text-xs text-purple-700 font-medium">Admin Wallet</p>
                                <p className="text-sm font-bold text-purple-900">12,450 <span className="text-xs font-normal">Tokens</span></p>
                            </div>
                        </div>
                        <button
                            onClick={exportCurrentReport}
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg"
                        >
                            <span>⬇️</span>
                            <span>Export Report</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900">{member?.name || 'Admin User'}</p>
                                <p className="text-xs text-gray-600">{memberRoleLabel}</p>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                {memberInitials}
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Energy Production vs. Consumption */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">System Energy Production vs. Consumption</h2>
                            <p className="text-sm text-gray-600">Comparative trend analysis with Battery State of Charge (SoC)</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setTimeRange('7days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '7days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('30days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '30days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setTimeRange('90days')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '90days'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                90 Days
                            </button>
                            <button className="px-4 py-2 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2">
                                <span>📅</span>
                                <span>Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mb-4 justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-green-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">PV Production (kWH)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-red-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">Consumption (kWH)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 border-2 border-dashed border-orange-500 rounded"></div>
                            <span className="text-sm text-gray-700 font-medium">Battery SoC (%)</span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="w-full overflow-x-auto">
                        <EnergyChart data={chartData} />
                    </div>
                </div>

                {/* Energy Source Breakdown & Top Consumers */}
                <div className="flex gap-6 mb-6">
                    {/* Energy Source Breakdown - Left (narrower) */}
                    <div className="w-[42%] bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Energy Source Breakdown</h2>
                                <p className="text-sm text-gray-600">Current period distribution</p>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <span className="text-gray-400">⋮</span>
                            </button>
                        </div>

                        {/* Donut Chart */}
                        <div className="flex items-center justify-center mb-6">
                            <svg width="280" height="280" viewBox="0 0 280 280">
                                <defs>
                                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1"/>
                                    </filter>
                                </defs>
                                {sourceBreakdown.items.map((item) => (
                                    <path
                                        key={item.key}
                                        d={item.path}
                                        fill={item.color}
                                        filter="url(#shadow)"
                                    />
                                ))}
                                
                                {/* Center white circle for donut effect */}
                                <circle cx="140" cy="140" r="85" fill="white"/>
                            </svg>
                        </div>

                        {/* Breakdown List */}
                        <div className="space-y-3">
                            {sourceBreakdown.items.map((item) => (
                                <div key={item.key} className={`${item.bg} rounded-xl p-4 flex items-center justify-between`}>
                                    <span className="text-gray-900 font-semibold">{item.label}</span>
                                    <div className="text-right">
                                        <p className="text-gray-900 font-bold text-lg">{item.value.toLocaleString()} kWH</p>
                                        <p className={`${item.text} text-sm font-semibold`}>{item.pct} %</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Consumers - Right (wider) */}
                    <div className="w-[58%] bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-1">Top Consumers</h2>
                                <p className="text-sm text-gray-600">Building consumption ranking</p>
                            </div>
                            <button className="text-blue-600 font-semibold text-sm hover:text-blue-700 flex items-center gap-1">
                                View All Buildings →
                            </button>
                        </div>

                        {/* Consumer List */}
                        <div className="space-y-4">
                            {(topConsumers.length ? topConsumers : []).map((consumer, idx) => {
                                const sharePct = totalTopConsumption > 0
                                    ? Math.round((Number(consumer.consumption || 0) / totalTopConsumption) * 100)
                                    : 0;
                                const barPct = Math.round((Number(consumer.consumption || 0) / topConsumptionMax) * 100);
                                const status = barPct >= 85 ? 'Near Limit' : 'Optimal';
                                const bg = idx === 0 ? 'bg-red-50' : idx === 1 ? 'bg-orange-50' : idx === 2 ? 'bg-blue-50' : 'bg-green-50';
                                const rail = idx === 0 ? 'bg-red-200' : idx === 1 ? 'bg-orange-200' : idx === 2 ? 'bg-blue-200' : 'bg-green-200';
                                const fill = idx === 0 ? 'bg-red-600' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-blue-500' : 'bg-green-500';

                                return (
                                    <div key={consumer.name} className={`${bg} rounded-xl p-4`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-700 font-bold shadow-sm">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <h3 className="text-gray-900 font-bold">{consumer.name}</h3>
                                                    <p className="text-gray-600 text-sm">{sharePct}% of top-group consumption</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-900 font-bold text-xl">{Number(consumer.consumption || 0).toLocaleString()} kWH</p>
                                                <p className={`text-sm font-semibold ${status === 'Near Limit' ? 'text-red-600' : 'text-green-600'}`}>{status}</p>
                                            </div>
                                        </div>
                                        <div className={`w-full ${rail} rounded-full h-2.5`}>
                                            <div className={`${fill} h-2.5 rounded-full`} style={{ width: `${barPct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {!topConsumers.length && (
                                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">No consumption data available.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Building Comparison Report */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Building Comparison Report</h2>
                        <p className="text-sm text-gray-600">Side-by-side energy flow analysis</p>
                    </div>

                    <div className="flex gap-6">
                        {/* Left: Ratchaphruk Building (With Battery) */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Production vs Consumption vs Battery</h3>
                                    <p className="text-sm text-gray-600">
                                        {compareLeft?.name || 'Select building'} ({compareLeft?.hasBattery ? 'With Battery' : 'Without Battery'})
                                    </p>
                                </div>
                                <select
                                    value={compareWithBattery}
                                    onChange={(e) => setCompareWithBattery(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
                                >
                                    {buildingOptions.map((name) => (
                                        <option key={`left-${name}`} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mb-4 justify-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-green-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">PV Production</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-red-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Consumption</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Battery Discharge</span>
                                </div>
                            </div>

                            <ComparisonBarChart
                                series={compareLeftSeries}
                                showBattery={Boolean(compareLeft?.hasBattery)}
                            />

                            {/* Insight */}
                            <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                    <span className="text-blue-600 text-lg">ℹ️</span>
                                    <p className="text-sm text-gray-800">
                                        {compareLeft?.hasBattery
                                            ? <>Battery available: <span className="font-bold text-blue-700">{compareLeft?.batteryPct || 0}%</span> SoC ({compareLeft?.batteryValue || 0} / {compareLeft?.batteryCap || 0} kWh)</>
                                            : <>No battery meter found for this building.</>}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Malai Building (Without Battery) */}
                        <div className="flex-1 bg-gray-50 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Production vs Consumption</h3>
                                    <p className="text-sm text-gray-600">
                                        {compareRight?.name || 'Select building'} ({compareRight?.hasBattery ? 'With Battery' : 'Without Battery'})
                                    </p>
                                </div>
                                <select
                                    value={compareWithoutBattery}
                                    onChange={(e) => setCompareWithoutBattery(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white"
                                >
                                    {buildingOptions.map((name) => (
                                        <option key={`right-${name}`} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Legend */}
                            <div className="flex items-center gap-4 mb-4 justify-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-green-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">PV Production</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-1 bg-red-500 rounded"></div>
                                    <span className="text-xs text-gray-700 font-medium">Consumption</span>
                                </div>
                            </div>

                            <ComparisonBarChart
                                series={compareRightSeries}
                                showBattery={Boolean(compareRight?.hasBattery)}
                            />

                            {/* Warning */}
                            <div className="mt-4 bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                                <div className="flex items-start gap-2">
                                    <span className="text-orange-600 text-lg">🔥</span>
                                    <p className="text-sm text-gray-800">
                                        <span className="font-bold text-orange-700">Production {Number(compareRight?.production || 0).toLocaleString()} kWh</span>
                                        {' '}vs consumption {Number(compareRight?.consumption || 0).toLocaleString()} kWh.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid & Battery Flow and Net Grid Flow */}
                <div className="flex gap-6 mb-6">
                    {/* Left: Grid & Battery Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-bold text-gray-900">Grid & Battery Flow</h2>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold">
                                        Optimized
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">Energy Arbitrage Analysis - Ratchaphruk</p>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4 justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Grid Import</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Battery Discharge</span>
                            </div>
                        </div>

                        {/* Bar Chart */}
                        <svg width="100%" height="350" viewBox="0 0 600 350">
                            {/* Grid lines */}
                            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                <line
                                    key={`grid-line-${i}`}
                                    x1="60"
                                    y1={40 + i * 40}
                                    x2="580"
                                    y2={40 + i * 40}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Bar data points */}
                            {/* 00:00 - Grid Import 120 kWH */}
                            <rect x="65" y="80" width="50" height="200" fill="#3b82f6" rx="4"/>
                            
                            {/* 03:00 - Grid Import 100 kWH */}
                            <rect x="135" y="113" width="50" height="167" fill="#3b82f6" rx="4"/>
                            
                            {/* 06:00 - Grid Import 50 kWH */}
                            <rect x="205" y="197" width="50" height="83" fill="#3b82f6" rx="4"/>
                            
                            {/* 09:00-15:00 - No bars (solar covers consumption) */}
                            
                            {/* 18:00 - Battery Discharge 80 kWH */}
                            <rect x="415" y="147" width="50" height="133" fill="#f97316" rx="4"/>
                            
                            {/* 21:00 - Grid Import 80 kWH + Battery Discharge 60 kWH */}
                            <rect x="485" y="147" width="50" height="133" fill="#3b82f6" rx="4"/>
                            <rect x="485" y="47" width="50" height="100" fill="#f97316" rx="4"/>

                            {/* Y-axis labels */}
                            {[0, 20, 40, 60, 80, 100, 120, 140].map((value, i) => (
                                <text
                                    key={`y-label-${i}`}
                                    x="50"
                                    y={280 - i * 33.33}
                                    textAnchor="end"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {value}
                                </text>
                            ))}

                            {/* X-axis labels */}
                            {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                <text
                                    key={`x-label-${i}`}
                                    x={90 + i * 70}
                                    y="300"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {time}
                                </text>
                            ))}

                            {/* Y-axis label */}
                            <text
                                x="20"
                                y="160"
                                textAnchor="middle"
                                fontSize="13"
                                fill="#6b7280"
                                fontWeight="500"
                                transform="rotate(-90 20 160)"
                            >
                                kWH
                            </text>
                        </svg>
                    </div>

                    {/* Right: Net Grid Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-bold text-gray-900">Net Grid Flow</h2>
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">
                                        High Import
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">Grid Import Analysis - Malai Building</p>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 mb-4 justify-center">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-1 bg-blue-600 rounded"></div>
                                <span className="text-sm text-gray-700 font-medium">Net Grid Import</span>
                            </div>
                        </div>

                        {/* Line Chart */}
                        <svg width="100%" height="350" viewBox="0 0 600 350">
                            {/* Grid lines */}
                            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                                <line
                                    key={`net-grid-line-${i}`}
                                    x1="60"
                                    y1={40 + i * 40}
                                    x2="580"
                                    y2={40 + i * 40}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Data path - Net Grid Import line */}
                            <path
                                d="M 90,47 L 160,67 L 230,127 L 300,207 L 370,267 L 440,240 L 510,87 L 580,47"
                                fill="none"
                                stroke="#2563eb"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />

                            {/* Fill area under the line */}
                            <path
                                d="M 90,47 L 160,67 L 230,127 L 300,207 L 370,267 L 440,240 L 510,87 L 580,47 L 580,280 L 90,280 Z"
                                fill="rgba(37, 99, 235, 0.1)"
                            />

                            {/* Data points */}
                            {[
                                {x: 90, y: 47},
                                {x: 160, y: 67},
                                {x: 230, y: 127},
                                {x: 300, y: 207},
                                {x: 370, y: 267},
                                {x: 440, y: 240},
                                {x: 510, y: 87},
                                {x: 580, y: 47}
                            ].map((point, i) => (
                                <circle
                                    key={`point-${i}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="4"
                                    fill="#2563eb"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            ))}

                            {/* Y-axis labels */}
                            {[0, 20, 40, 60, 80, 100, 120].map((value, i) => (
                                <text
                                    key={`net-y-label-${i}`}
                                    x="50"
                                    y={280 - i * 40}
                                    textAnchor="end"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {value}
                                </text>
                            ))}

                            {/* X-axis labels */}
                            {['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => (
                                <text
                                    key={`net-x-label-${i}`}
                                    x={90 + i * 70}
                                    y="300"
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="#6b7280"
                                >
                                    {time}
                                </text>
                            ))}

                            {/* Y-axis label */}
                            <text
                                x="20"
                                y="160"
                                textAnchor="middle"
                                fontSize="13"
                                fill="#6b7280"
                                fontWeight="500"
                                transform="rotate(-90 20 160)"
                            >
                                kWH
                            </text>
                        </svg>
                    </div>
                </div>

                {/* Battery Assets Report */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">Battery Assets Report</h2>
                        <p className="text-sm text-gray-600">Current status & health monitoring</p>
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {batteryAssets.length === 0 && (
                            <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                                No battery assets found in the live building dataset.
                            </div>
                        )}
                        {batteryAssets.map((entry) => {
                            const pct = toNumeric(entry.batteryPct);
                            const tone = pct >= 60 ? 'green' : pct >= 30 ? 'orange' : 'red';
                            const toneClasses = tone === 'green'
                                ? {
                                    icon: 'from-green-400 to-green-600',
                                    badge: 'bg-green-100 text-green-700',
                                    fill: 'bg-green-500',
                                    status: 'text-green-600',
                                    label: 'Optimal',
                                  }
                                : tone === 'orange'
                                    ? {
                                        icon: 'from-orange-400 to-orange-600',
                                        badge: 'bg-orange-100 text-orange-700',
                                        fill: 'bg-orange-500',
                                        status: 'text-orange-600',
                                        label: 'Monitor',
                                      }
                                    : {
                                        icon: 'from-red-400 to-red-600',
                                        badge: 'bg-red-100 text-red-700',
                                        fill: 'bg-red-500',
                                        status: 'text-red-600',
                                        label: 'Low',
                                      };

                            return (
                                <div key={entry.name} className="w-[280px] shrink-0 bg-gray-50 rounded-xl p-4 shadow-sm border border-gray-100">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-12 h-12 bg-gradient-to-br ${toneClasses.icon} rounded-xl flex items-center justify-center mb-3 shadow-md`}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                <rect x="2" y="7" width="18" height="11" rx="2" ry="2"/>
                                                <line x1="22" y1="11" x2="22" y2="14"/>
                                                <rect x="5" y="10" width="4" height="5" fill="white"/>
                                                <rect x="10" y="10" width="4" height="5" fill="white"/>
                                            </svg>
                                        </div>

                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold mb-3 ${toneClasses.badge}`}>
                                            {toneClasses.label}
                                        </span>

                                        <h3 className="text-gray-600 font-medium text-sm mb-1 text-center">{entry.name}</h3>
                                        <p className="text-3xl font-bold text-gray-900 mb-1">{pct}%</p>
                                        <p className="text-gray-600 text-xs mb-3 text-center">Current Battery SoC</p>

                                        <div className="w-full bg-gray-300 rounded-full h-2 mb-4">
                                            <div className={`h-2 rounded-full ${toneClasses.fill}`} style={{ width: `${pct}%` }}></div>
                                        </div>

                                        <div className="w-full border-t border-gray-200 pt-3">
                                            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1 text-center">Stored / Capacity</div>
                                            <div className={`font-bold text-sm ${toneClasses.status} text-center`}>
                                                {toNumeric(entry.batteryValue).toLocaleString()} / {toNumeric(entry.batteryCap).toLocaleString()} kWh
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Preventive Maintenance Alert */}
                {maintenanceAlert && (
                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-orange-200 to-orange-300 rounded-2xl flex items-center justify-center flex-shrink-0">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                                    </svg>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Preventive Maintenance Alert</h3>
                                    <p className="text-gray-700 text-base">
                                        {maintenanceAlert.name} currently has the lowest battery SoC at {toNumeric(maintenanceAlert.batteryPct).toFixed(0)}%. Recommend inspection if this low level persists.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => history.push(`/building/${slugify(maintenanceAlert.name)}`)}
                                className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl flex-shrink-0"
                            >
                                Review Asset
                            </button>
                        </div>
                    </div>
                )}

                {/* Data Export & Verification */}
                <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 rounded-2xl shadow-2xl p-8 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-white mb-3">Data Export & Verification</h2>
                            <p className="text-blue-100 text-base mb-6">
                                Export comprehensive energy reports with blockchain verification for official audits and budget documentation
                            </p>

                            {/* Feature Badges */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Weekly Summary */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Weekly Summary</span>
                                </div>

                                {/* Building-Specific Data */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Building-Specific Data</span>
                                </div>

                                {/* Battery SoC/SoH History */}
                                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="text-white font-medium">Battery SoC/SoH History</span>
                                </div>

                                {/* Blockchain Hash Included */}
                                <div className="bg-purple-500/30 backdrop-blur-sm border border-purple-300/50 rounded-xl px-4 py-2 flex items-center gap-2">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                        <path d="M2 17l10 5 10-5"/>
                                        <path d="M2 12l10 5 10-5"/>
                                    </svg>
                                    <span className="text-white font-medium">Blockchain Hash Included</span>
                                </div>
                            </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex flex-col gap-4 ml-8">
                            {/* Export to Excel */}
                            <button 
                                onClick={exportCurrentReport}
                                className="px-8 py-4 bg-white rounded-2xl font-bold text-blue-700 hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 min-w-[220px]"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="#2563eb" strokeWidth="2"/>
                                    <path d="M3 9h18M9 3v18" stroke="#2563eb" strokeWidth="2"/>
                                    <rect x="10" y="10" width="4" height="4" fill="#2563eb"/>
                                </svg>
                                <span>Export to Excel</span>
                            </button>

                            {/* Export to PDF */}
                            <button 
                                onClick={exportCurrentPdf}
                                className="px-8 py-4 bg-white rounded-2xl font-bold text-purple-700 hover:bg-purple-50 transition-all shadow-lg hover:shadow-xl flex items-center gap-3 min-w-[220px]"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <span>Export to PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

