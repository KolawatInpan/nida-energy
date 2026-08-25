import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import Plot from 'react-plotly.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { getApiBase } from '../../core/data_connecter/apiBase';
import { validateAuth } from "../../store/auth/auth.action";
import { getMember } from '../../store/member/member.action';
import { getBuildings, getGaps, getMetersByBuilding } from '../../core/data_connecter/register';
import { searchBuildingEnergy } from '../../core/data_connecter/dashboard';
import { getWalletByEmail } from '../../core/data_connecter/wallet';
import Key from '../../global/key';
import { formatDateLocal, toNumeric } from '../../utils/energyAnalytics';
import { buildComparisonXAxisLabels, buildNiceScale, swapComparisonSelection } from '../../utils/dashboardCharts';
import { formatEnergy } from '../../utils/formatters';
import TORReport from '../../components/TOR/TORReport';
import GapBar from '../../components/charts/GapBar';
import { fmtDate, fmtDateTime } from '../../utils/dateFormat';

const buildEmptyChartData = (days) => Array.from({ length: days }, (_, index) => ({
    day: `Day ${index + 1}`,
    pvProduction: 0,
    consumption: 0,
    batterySoC: 0,
}));

// Backend uses LOWER() for comparison — case is irrelevant
// Send the exact name from getBuildings() (which is the Building.name, same as MeterInfo.buildingName via FK)
const normalizeBackendBuildingName = (name) => {
    return (name || '').toString().trim();
};

const slugify = (name) => String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

const meterTypeOf = (m) => (m?.type || '').toString().toLowerCase();
const hasBatteryMeter = (m) => meterTypeOf(m).includes('battery');
const hasProducerMeter = (m) => meterTypeOf(m).includes('produce');

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

const getDaysForRange = (range, customStart, customEnd) => {
  if (range === 'custom' && customStart && customEnd) {
    return Math.max(1, Math.ceil((customEnd - customStart) / (1000 * 60 * 60 * 24)) + 1);
  }
  return range === '1week' ? 7 : range === '1month' ? 30 : 365;
};

// Export functions
const exportToExcel = () => {
    // Generate CSV data
    const csvData = [
        ['Total Energy Analytics Report', '', '', ''],
        ['Generated:', fmtDate(new Date()), '', ''],
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
            <p><strong>Generated:</strong> ${fmtDateTime(new Date())}</p>
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

// Color palette for per-building chart lines
const PRODUCE_COLORS = ['#22c55e','#16a34a','#15803d','#4ade80','#86efac','#65a30d','#166534','#a3e635','#047857','#059669'];
const CONSUME_COLORS = ['#ef4444','#dc2626','#b91c1c','#f87171','#ea580c','#c2410c','#991b1b','#7f1d1d','#e11d48','#be123c'];
const SOC_COLORS     = ['#3b82f6','#2563eb','#1d4ed8','#60a5fa','#6366f1','#4f46e5','#1e40af','#3730a3','#8b5cf6','#7c3aed'];
// Different dash styles so each building is visually distinct
const DASH_STYLES   = ['solid','dash','dot','dashdot','longdash','longdashdot','solid','dash','dot','dashdot'];
const MARKER_SYMBOLS = ['circle','square','diamond','triangle-up','star','cross','x','hexagon','star-diamond','bowtie'];

export default function Report() {
    const history = useHistory();
    const dispatch = useDispatch();
    const memberStore = useSelector((store) => store.member.all);
    const [timeRange, setTimeRange] = useState('1week');
    const [customDateRange, setCustomDateRange] = useState([null, null]);
    const [customStart, customEnd] = customDateRange;
    const [chartData, setChartData] = useState(buildEmptyChartData(7));
    const [buildingOptions, setBuildingOptions] = useState([]);
    const [buildingStats, setBuildingStats] = useState({});
    const [topConsumers, setTopConsumers] = useState([]);
    const [comparisonRange, setComparisonRange] = useState('7d');
    const [selectedComparisonA, setSelectedComparisonA] = useState('');
    const [selectedComparisonB, setSelectedComparisonB] = useState('');
    const [selectedGridBuilding, setSelectedGridBuilding] = useState('');
    const [comparisonSeriesByBuilding, setComparisonSeriesByBuilding] = useState({});
    const [member, setMember] = useState(DEFAULT_MEMBER);
    const [selectedBuildings, setSelectedBuildings] = useState([]); // empty = all
    const [perBuildingChart, setPerBuildingChart] = useState({}); // { buildingName: [{day,pvProduction,consumption}] }
    const [chartRev, setChartRev] = useState(0);
    const [chartToggle, setChartToggle] = useState({ showProduce: true, showConsume: true, showSoC: true });
    const [reportGaps, setReportGaps] = useState([]);
    const [reportGapRange, setReportGapRange] = useState({ start: null, end: null });

    // Increment chart revision when data changes
    useEffect(() => { setChartRev(r => r + 1); }, [chartData, perBuildingChart]);

    // Fetch admin wallet balance
    useEffect(() => {
        getWalletByEmail('admin@nida.ac.th')
            .then(res => {
                const bal = res?.data?.tokenBalance ?? res?.tokenBalance ?? res?.balance;
                if (bal != null) setAdminBalance(Number(bal));
            })
            .catch(() => setAdminBalance(null));
    }, []);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportBuildings, setExportBuildings] = useState([]); // empty = all
    const [exportTypes, setExportTypes] = useState({ consume: true, produce: true, battery: false });
    const [adminBalance, setAdminBalance] = useState(null);
    const [exportStartDate, setExportStartDate] = useState(new Date());
    const [exportEndDate, setExportEndDate] = useState(new Date());
    const [exportFormat, setExportFormat] = useState('excel');
    const [exporting, setExporting] = useState(false);

    const handleSelectComparisonA = (nextValue) => {
        const next = swapComparisonSelection(selectedComparisonA, selectedComparisonB, nextValue, 'A');
        setSelectedComparisonA(next.a);
        setSelectedComparisonB(next.b);
    };

    const handleSelectComparisonB = (nextValue) => {
        const next = swapComparisonSelection(selectedComparisonA, selectedComparisonB, nextValue, 'B');
        setSelectedComparisonA(next.a);
        setSelectedComparisonB(next.b);
    };

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
                const isCustom = timeRange === 'custom' && customStart && customEnd;
                const days = getDaysForRange(timeRange, customStart, customEnd);
                const endDate = isCustom ? new Date(customEnd) : new Date();
                const startDate = isCustom ? new Date(customStart) : new Date(endDate);
                if (!isCustom) startDate.setDate(startDate.getDate() - (days - 1));
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
                    const producerMeter = (meters || []).find(hasProducerMeter);
                    const hasProducer = Boolean(producerMeter);
                    const batteryValue = toNumeric(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
                    const batteryCap = toNumeric(batteryMeter?.capacity ?? 0);
                    const batteryPct = batteryCap > 0 ? Math.max(0, Math.min(100, Math.round((batteryValue / batteryCap) * 100))) : 0;

                    let productionTotal = 0;
                    let consumptionTotal = 0;
                    let batteryTotal = 0;
                    try {
                        const eres = await searchBuildingEnergy({
                            building: backendName,
                            buildingId: b.id,
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
                        batteryPct,
                        hasProducer
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

                if (!selectedComparisonA || !statsMap[selectedComparisonA]) {
                    setSelectedComparisonA(withBattery?.name || ranked[0]?.name || '');
                }
                if (!selectedComparisonB || !statsMap[selectedComparisonB]) {
                    const fallback = withoutBattery?.name || ranked[1]?.name || ranked[0]?.name || '';
                    setSelectedComparisonB(fallback);
                }
            } catch (err) {
                console.error('fetchReportMetrics error', err);
            }
        };

        fetchReportMetrics();
    }, [timeRange, customStart, customEnd]);

    useEffect(() => {
        const fetchChartData = async () => {
            try {
                const isCustom = timeRange === 'custom' && customStart && customEnd;
                const days = getDaysForRange(timeRange, customStart, customEnd);
                const endDate = isCustom ? new Date(customEnd) : new Date();
                const startDate = isCustom ? new Date(customStart) : new Date(endDate);
                if (!isCustom) startDate.setDate(startDate.getDate() - (days - 1));
                const start = formatDateLocal(startDate);
                const end = formatDateLocal(endDate);

                const bres = await getBuildings();
                const buildings = Array.isArray(bres) ? bres : (bres?.data || bres?.buildings || []);

                if (!buildings.length) {
                    setChartData(buildEmptyChartData(days));
                    return;
                }

                const labels = Array.from({ length: days }, (_, index) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + index);
                    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                });

                console.log('[report] Buildings from API:', buildings.map(b => b?.name));
                const energyResponses = await Promise.all(
                    buildings.map(async (building) => {
                        const backendName = normalizeBackendBuildingName(building?.name);
                        const buildingId = building?.id || null;
                        console.log(`[report:agg] Fetching "${building?.name}" → backend "${backendName}" id=${buildingId}`);
                        try {
                            let res = await searchBuildingEnergy({
                                building: backendName,
                                buildingId,
                                start,
                                end,
                                timeunit: 'day',
                            });
                            let payload = res?.data || {};
                            console.log(`[report:agg] "${building?.name}" daily response keys:`, Object.keys(payload), 'result:', payload?.result);
                            let pv = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                            let con = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];

                            // Fallback: aggregate from hourly if daily is empty
                            if (pv.length === 0 && con.length === 0) {
                                console.log(`[report:agg] "${building?.name}" daily empty → trying hourly`);
                                res = await searchBuildingEnergy({
                                    building: backendName,
                                    buildingId,
                                    start,
                                    end,
                                    timeunit: 'hour',
                                }).catch(() => null);
                                payload = res?.data || {};
                                const hpv = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                                const hcon = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];
                                const hdates = Array.isArray(payload?.production?.datetime) ? payload.production.datetime : [];

                                // Aggregate hourly → daily
                                const dailyMap = {};
                                labels.forEach((l) => { dailyMap[l] = { pv: 0, con: 0 }; });
                                hdates.forEach((dt, i) => {
                                    const d = new Date(dt);
                                    const dayLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                                    if (dailyMap[dayLabel] !== undefined) {
                                        dailyMap[dayLabel].pv += toNumeric(hpv[i]);
                                        dailyMap[dayLabel].con += toNumeric(hcon[i]);
                                    }
                                });
                                pv = labels.map((l) => dailyMap[l].pv);
                                con = labels.map((l) => dailyMap[l].con);
                                // Wrap in expected format
                                payload = { ...payload, production: { value: pv }, consumption: { value: con } };
                            }
                            return { data: payload };
                        } catch (e) {
                            console.error(`[report:agg] "${building?.name}" fetch error:`, e.message);
                            return null;
                        }
                    })
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

                const productionMap = new Map(labels.map((label) => [label, 0]));
                const consumptionMap = new Map(labels.map((label) => [label, 0]));

                energyResponses.forEach((response, idx) => {
                    const payload = response?.data || {};
                    const buildingName = payload?.building || buildings[idx]?.name || `unknown-${idx}`;
                    const productionDatetimes = Array.isArray(payload?.production?.datetime) ? payload.production.datetime : [];
                    const productionValues = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                    const consumptionDatetimes = Array.isArray(payload?.consumption?.datetime) ? payload.consumption.datetime : [];
                    const consumptionValues = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];
                    const pvSum = productionValues.reduce((s, v) => s + toNumeric(v), 0);
                    const conSum = consumptionValues.reduce((s, v) => s + toNumeric(v), 0);
                    console.log(`[report:agg] "${buildingName}" → prod=${pvSum} kWh, cons=${conSum} kWh, pvLen=${productionValues.length}`);

                    // Build date→value maps from API response (datetime and value are parallel arrays)
                    const prodByDate = new Map();
                    productionDatetimes.forEach((dt, i) => {
                        if (dt) prodByDate.set(String(dt).slice(0, 10), toNumeric(productionValues[i]));
                    });
                    const consByDate = new Map();
                    consumptionDatetimes.forEach((dt, i) => {
                        if (dt) consByDate.set(String(dt).slice(0, 10), toNumeric(consumptionValues[i]));
                    });

                    // Map each label to the correct date-based value
                    const dayCursor = new Date(startDate);
                    labels.forEach((label) => {
                        const dateKey = formatDateLocal(dayCursor); // YYYY-MM-DD
                        productionMap.set(label, toNumeric(productionMap.get(label)) + (prodByDate.get(dateKey) || 0));
                        consumptionMap.set(label, toNumeric(consumptionMap.get(label)) + (consByDate.get(dateKey) || 0));
                        dayCursor.setDate(dayCursor.getDate() + 1);
                    });
                });

                setChartData(labels.map((label) => ({
                    day: label,
                    pvProduction: toNumeric(productionMap.get(label)),
                    consumption: toNumeric(consumptionMap.get(label)),
                    batterySoC: averageBatteryPct,
                })));

                // Detect data gaps for the report range
                const firstBuilding = buildings[0];
                if (firstBuilding) {
                    try {
                        const metersRes = await getMetersByBuilding(firstBuilding.id);
                        const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
                        const gapMeterId = meters[0]?.snid;
                        if (gapMeterId) {
                            getGaps({ meterId: gapMeterId, from: startDate.toISOString(), to: endDate.toISOString() }).then((g) => {
                                setReportGaps(Array.isArray(g) ? g : []);
                                setReportGapRange({ start: startDate.toISOString(), end: endDate.toISOString() });
                            }).catch(() => {});
                        }
                    } catch (_) {}
                }
            } catch (error) {
                console.error('Failed to load report chart data:', error);
                setChartData(buildEmptyChartData(getDaysForRange(timeRange, customStart, customEnd)));
            }
        };

        fetchChartData();
    }, [timeRange, customStart, customEnd]);

    // Fetch per-building chart data when buildings are selected
    useEffect(() => {
        if (!selectedBuildings.length) {
            setPerBuildingChart({});
            return;
        }

        const fetchPerBuilding = async () => {
            const isCustom = timeRange === 'custom' && customStart && customEnd;
            const days = getDaysForRange(timeRange, customStart, customEnd);
            const endDate = isCustom ? new Date(customEnd) : new Date();
            const startDate = isCustom ? new Date(customStart) : new Date(endDate);
            if (!isCustom) startDate.setDate(startDate.getDate() - (days - 1));
            const start = formatDateLocal(startDate);
            const end = formatDateLocal(endDate);

            // Get buildings to resolve IDs from names
            const bres = await getBuildings();
            const buildings = Array.isArray(bres) ? bres : (bres?.data || bres?.buildings || []);
            const nameToId = {};
            buildings.forEach((b) => { if (b?.name && b?.id) nameToId[b.name] = b.id; });
            console.log('[report] nameToId map:', nameToId);
            console.log('[report] selectedBuildings:', selectedBuildings);

            const labels = Array.from({ length: days }, (_, index) => {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + index);
                return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            });

            const result = {};

            const entries = await Promise.all(
                selectedBuildings.map(async (buildingName) => {
                    const backendName = normalizeBackendBuildingName(buildingName);
                    const buildingId = nameToId[buildingName] || null;
                    console.log(`[report] Fetching building "${buildingName}" → backend "${backendName}" id=${buildingId}`);
                    try {
                        // Try daily data first
                        let res = await searchBuildingEnergy({
                            building: backendName,
                            buildingId,
                            start,
                            end,
                            timeunit: 'day',
                        });
                        let payload = res?.data || {};
                        console.log(`[report] "${buildingName}" daily response keys:`, Object.keys(payload));
                        let pv = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                        let con = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];

                        // Fallback: if daily data is empty, aggregate from hourly
                        if (pv.length === 0 && con.length === 0) {
                            console.log(`[report] "${buildingName}" daily empty → trying hourly fallback`);
                            res = await searchBuildingEnergy({
                                building: backendName,
                                buildingId,
                                start,
                                end,
                                timeunit: 'hour',
                            }).catch(() => null);
                            payload = res?.data || {};
                            const hpv = Array.isArray(payload?.production?.value) ? payload.production.value : [];
                            const hcon = Array.isArray(payload?.consumption?.value) ? payload.consumption.value : [];
                            const hdates = Array.isArray(payload?.production?.datetime) ? payload.production.datetime : [];

                            // Aggregate hourly into daily buckets
                            const dailyMap = {};
                            labels.forEach((l) => { dailyMap[l] = { pv: 0, con: 0 }; });
                            hdates.forEach((dt, i) => {
                                const d = new Date(dt);
                                const dayLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                                if (dailyMap[dayLabel] !== undefined) {
                                    dailyMap[dayLabel].pv += toNumeric(hpv[i]);
                                    dailyMap[dayLabel].con += toNumeric(hcon[i]);
                                }
                            });
                            pv = labels.map((l) => dailyMap[l].pv);
                            con = labels.map((l) => dailyMap[l].con);
                        }

                        const pvSum = pv.reduce((s, v) => s + toNumeric(v), 0);
                        const conSum = con.reduce((s, v) => s + toNumeric(v), 0);

                        // === Battery SoC: use the REAL SoC series from RunningMeter.kWH ===
                        // The backend stores the integrated SoC (clamped to capacity) on each
                        // battery RunningMeter row, so we query it directly per day instead of
                        // forward-accumulating flow (which used to pile up to 100 and stick).
                        let batteryPct = null;
                        let batterySoCSeries = null;
                        let hasBattery = false;
                        let bCap = 0;
                        if (buildingId) {
                            try {
                                const metersRes = await getMetersByBuilding(buildingId);
                                const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
                                const batteryMeter = meters.find(hasBatteryMeter);
                                if (batteryMeter) {
                                    hasBattery = true;
                                    const bVal = toNumeric(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
                                    bCap = toNumeric(batteryMeter?.capacity ?? 0);
                                    batteryPct = bCap > 0 ? Math.max(0, Math.min(100, Math.round((bVal / bCap) * 100))) : null;

                                    // Query the REAL SoC series (daily) from RunningMeter.kWH
                                    const socRes = await axios.get(`${getApiBase()}/runningMeters/soc-series/${batteryMeter.snid}`, {
                                        params: { start: '2024-01-01', end },
                                    }).catch(() => null);
                                    const socPayload = socRes?.data || {};
                                    const socDates = Array.isArray(socPayload?.datetime) ? socPayload.datetime : [];
                                    const socVals = Array.isArray(socPayload?.value) ? socPayload.value : [];

                                    // Map date string -> SoC%
                                    const fullMap = {}; // YYYY-MM-DD -> SoC%
                                    socDates.forEach((dt, i) => {
                                        if (socVals[i] != null) fullMap[String(dt).substring(0, 10)] = Number(socVals[i]);
                                    });

                                    // Map accumulated SoC to chart labels
                                    batterySoCSeries = labels.map((label) => {
                                        // labels are "DD Mmm YYYY" format (e.g. "10 Jul 2026")
                                        const monthNames = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
                                        const parts = label.split(' ');
                                        // parts: ["DD", "Mmm", "YYYY"]
                                        const d = parseInt(parts[0]);
                                        const m = monthNames[parts[1]];
                                        const yr = parseInt(parts[2]);
                                        if (!m || !d || !yr) return null;
                                        const key = `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                        if (fullMap[key] !== undefined) return fullMap[key];
                                        return null;
                                    });
                                }
                            } catch (e) {
                                console.warn(`[report] "${buildingName}" battery fetch failed:`, e.message);
                            }
                        }
                        console.log(`[report] "${buildingName}" result: pv=${pvSum} con=${conSum} batterySoC=${batteryPct}%${hasBattery ? ` accumulated=${batterySoCSeries?.[0]}→${batterySoCSeries?.[labels.length-1]}%` : ''}`);

                        return [buildingName, {
                            data: labels.map((label, i) => ({
                                day: label,
                                pvProduction: toNumeric(pv[i]),
                                consumption: toNumeric(con[i]),
                                batterySoC: hasBattery && batterySoCSeries ? batterySoCSeries[i] : null, // real SoC %
                            })),
                            hasBattery,
                            batterySoC: batteryPct,
                        }];
                    } catch (e) {
                        console.error(`[report] "${buildingName}" fetch error:`, e.message || e);
                        return [buildingName, buildEmptyChartData(days)];
                    }
                })
            );

            entries.forEach(([name, data]) => { result[name] = data; });
            setPerBuildingChart(result);
        };

        fetchPerBuilding();
    }, [selectedBuildings, timeRange, customStart, customEnd]);

    useEffect(() => {
        let mounted = true;
        const fetchComparisonData = async () => {
            try {
                const buildingsRes = await getBuildings();
                if (!mounted) return;
                const buildings = Array.isArray(buildingsRes) ? buildingsRes : (buildingsRes?.data || buildingsRes?.buildings || []);
                if (!buildings.length) {
                    setComparisonSeriesByBuilding({});
                    return;
                }

                const endDate = new Date();
                const start1d = new Date(endDate);
                start1d.setDate(start1d.getDate() - 1);
                const start7d = new Date(endDate);
                start7d.setDate(start7d.getDate() - 7);

                const allNames = buildings.map(b => b?.name || '').filter(Boolean);
                const seriesMap = {};

                await Promise.all(allNames.map(async (name) => {
                    if (!mounted) return;
                    try {
                        const building = buildings.find(b => b?.name === name);
                        const [res1d, res7d] = await Promise.all([
                            searchBuildingEnergy({
                                building: normalizeBackendBuildingName(name),
                                buildingId: building?.id || null,
                                start: formatDateLocal(start1d),
                                end: formatDateLocal(endDate),
                                timeunit: 'hour',
                            }),
                            searchBuildingEnergy({
                                building: normalizeBackendBuildingName(name),
                                buildingId: building?.id || null,
                                start: formatDateLocal(start7d),
                                end: formatDateLocal(endDate),
                                timeunit: 'day',
                            }),
                        ]);

                        const p1d = res1d?.data?.result === 'success' ? res1d.data : {};
                        const p7d = res7d?.data?.result === 'success' ? res7d.data : {};

                        const stats = buildingStats[name] || {};
                        const hasBattery = !!stats.hasBattery;

                        seriesMap[name] = {
                            buildingName: name,
                            hasBattery,
                            batteryValue: toNumeric(stats.batteryValue),
                            batteryCap: toNumeric(stats.batteryCap),
                            batteryPct: toNumeric(stats.batteryPct),
                            ranges: {
                                '1d': buildRangeSeries(p1d),
                                '7d': buildRangeSeries(p7d),
                            },
                        };
                    } catch (e) {
                        // skip failed buildings
                    }
                }));

                if (mounted) setComparisonSeriesByBuilding(seriesMap);
            } catch (error) {
                console.error('Failed to load comparison data:', error);
                if (mounted) setComparisonSeriesByBuilding({});
            }
        };

        fetchComparisonData();
        return () => { mounted = false; };
    }, [buildingStats, timeRange, customStart, customEnd]);

    // Build { labels, solar, consumption, battery } from searchBuildingEnergy response
    // Aligns all arrays by timestamp (not by index) to handle mismatched lengths,
    // e.g. production has 13 hours (06:00-18:00) but consumption has 24 hours.
    const buildRangeSeries = (payload) => {
        const productionVals = payload?.production?.value || [];
        const consumptionVals = payload?.consumption?.value || [];
        const batteryVals = payload?.battery?.value || [];
        const productionLabels = payload?.production?.datetime || [];
        const consumptionLabels = payload?.consumption?.datetime || [];
        const batteryLabels = payload?.battery?.datetime || [];

        // Build maps: raw timestamp → value for each type
        const prodMap = new Map(productionLabels.map((l, i) => [String(l), toNumeric(productionVals[i])]));
        const conMap = new Map(consumptionLabels.map((l, i) => [String(l), toNumeric(consumptionVals[i])]));
        const batMap = new Map(batteryLabels.map((l, i) => [String(l), toNumeric(batteryVals[i])]));

        // Union all labels, sorted
        const allLabels = Array.from(new Set([...productionLabels.map(String), ...consumptionLabels.map(String), ...batteryLabels.map(String)])).sort();

        if (!allLabels.length) return { labels: [], solar: [], consumption: [], battery: [] };

        // Fill gaps for daily data: ensure all dates between min and max exist
        const sortedLabels = allLabels.sort();
        const firstLabel = String(sortedLabels[0] || '');
        const lastLabel = String(sortedLabels[sortedLabels.length - 1] || '');
        const isDaily = !firstLabel.includes(' ') && !firstLabel.includes('T');
        
        if (isDaily) {
            const startD = new Date(firstLabel);
            const endD = new Date(lastLabel);
            if (!isNaN(startD.getTime()) && !isNaN(endD.getTime())) {
                const filled = [];
                const current = new Date(startD);
                while (current <= endD) {
                    const key = current.toISOString().split('T')[0];
                    filled.push(key);
                    current.setDate(current.getDate() + 1);
                }
                allLabels.splice(0, allLabels.length, ...filled);
            }
        }

        // Format labels: "2026-05-23" → "May 23", "2026-05-23 14:00" → "14:00"
        const labels = allLabels.map((label) => {
            const str = String(label || '');
            const spaceIdx = str.indexOf(' ');
            if (spaceIdx > 0) {
                const timePart = str.includes('T') ? str.split('T')[1] : str.slice(spaceIdx + 1);
                return timePart.slice(0, 5);
            }
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return str;
        });

        const solar = allLabels.map((l) => prodMap.get(String(l)) || 0);
        const consumption = allLabels.map((l) => conMap.get(String(l)) || 0);
        const battery = allLabels.map((l) => batMap.get(String(l)) || 0);
        return { labels, solar, consumption, battery };
    };

    const comparisonOptions = useMemo(() => {
        const options = [];
        const names = buildingOptions.length ? buildingOptions : Object.keys(buildingStats);
        names.forEach(name => {
            const stats = buildingStats[name] || {};
            options.push({
                name,
                hasBattery: !!stats.hasBattery,
            });
        });
        return options.sort((a, b) => a.name.localeCompare(b.name));
    }, [buildingOptions, buildingStats]);

    useEffect(() => {
        if (!comparisonOptions.length) {
            setSelectedComparisonA('');
            setSelectedComparisonB('');
            return;
        }
        setSelectedComparisonA((prev) => prev || comparisonOptions[0]?.name || '');
        setSelectedComparisonB((prev) => {
            if (prev) return prev;
            const fallback = comparisonOptions.find((item) => item.name !== (comparisonOptions[0]?.name || ''));
            return fallback?.name || comparisonOptions[0]?.name || '';
        });
    }, [comparisonOptions]);

    const selectedComparisonCharts = useMemo(() => {
        const seriesByBuilding = comparisonSeriesByBuilding || {};
        const buildChart = (buildingName) => {
            const item = seriesByBuilding[buildingName];
            const rangeData = item?.ranges?.[comparisonRange] || { labels: [], solar: [], consumption: [], battery: [] };
            const maxValue = Math.max(1, ...rangeData.solar, ...rangeData.consumption, ...rangeData.battery);
            const visibleLabels = buildComparisonXAxisLabels(rangeData.labels, comparisonRange);
            const points = rangeData.labels.map((label, index) => ({
                label,
                displayLabel: visibleLabels.has(label) ? label : '',
                solar: toNumeric(rangeData.solar[index]),
                consumption: toNumeric(rangeData.consumption[index]),
                battery: toNumeric(rangeData.battery[index]),
            })).map((point) => ({
                ...point,
                solarPct: point.solar > 0 ? Math.max(4, Math.round((point.solar / maxValue) * 100)) : 0,
                consumptionPct: point.consumption > 0 ? Math.max(4, Math.round((point.consumption / maxValue) * 100)) : 0,
                batteryPct: point.battery > 0 ? Math.max(4, Math.round((point.battery / maxValue) * 100)) : 0,
            }));

            return {
                buildingName,
                hasBattery: !!item?.hasBattery,
                batteryValue: toNumeric(item?.batteryValue),
                batteryCap: toNumeric(item?.batteryCap),
                batteryPct: toNumeric(item?.batteryPct),
                labels: rangeData.labels,
                points,
                maxValue,
                netSeries: points.map((point) => point.solar + point.battery - point.consumption),
            };
        };

        return {
            left: selectedComparisonA ? buildChart(selectedComparisonA) : null,
            right: selectedComparisonB ? buildChart(selectedComparisonB) : null,
        };
    }, [comparisonSeriesByBuilding, comparisonRange, selectedComparisonA, selectedComparisonB]);

    const totalTopConsumption = topConsumers.reduce((sum, row) => sum + Number(row.consumption || 0), 0);
    const topConsumptionMax = Math.max(1, ...topConsumers.map((r) => Number(r.consumption || 0)));
    const memberRoleLabel = useMemo(() => normalizeRoleName(member), [member]);
    const memberInitials = useMemo(() => getMemberInitials(member), [member]);
    
    // Check if Only Produce / Only Battery filters are active
    const producerBuildings = useMemo(() => buildingOptions.filter(n => buildingStats[n]?.hasProducer), [buildingOptions, buildingStats]);
    const consumerBuildings = useMemo(() => buildingOptions.filter(n => buildingStats[n]?.hasConsumer), [buildingOptions, buildingStats]);
    const batteryBuildings = useMemo(() => buildingOptions.filter(n => buildingStats[n]?.hasBattery), [buildingOptions, buildingStats]);
    const isProducerActive = producerBuildings.length > 0 && selectedBuildings.length === producerBuildings.length && producerBuildings.every(n => selectedBuildings.includes(n));
    const isConsumerActive = consumerBuildings.length > 0 && selectedBuildings.length === consumerBuildings.length && consumerBuildings.every(n => selectedBuildings.includes(n));
    const isBatteryActive = batteryBuildings.length > 0 && selectedBuildings.length === batteryBuildings.length && batteryBuildings.every(n => selectedBuildings.includes(n));

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

        return { items, total };
    }, [buildingStats]);
    const maintenanceAlert = useMemo(() => (
        batteryAssets
            .filter((entry) => toNumeric(entry.batteryPct) > 0)
            .sort((a, b) => toNumeric(a.batteryPct) - toNumeric(b.batteryPct))[0] || null
    ), [batteryAssets]);

    // Export modal handler
    const handleModalExport = async () => {
        setExporting(true);
        try {
            const startStr = formatDateLocal(exportStartDate);
            const endStr = formatDateLocal(exportEndDate);
            const allBuildings = Object.values(buildingStats);
            const buildings = exportBuildings.length > 0
                ? allBuildings.filter(b => exportBuildings.includes(b.name))
                : allBuildings;

            if (buildings.length === 0) {
                alert('No buildings selected.');
                setExporting(false);
                return;
            }

            // Fetch data for each building
            const allRows = [];
            for (const b of buildings) {
                const res = await searchBuildingEnergy({
                    building: normalizeBackendBuildingName(b.name),
                    buildingId: b.id,
                    start: startStr,
                    end: endStr,
                    timeunit: 'hour',
                });
                const payload = res?.data || {};
                const pVals = payload?.production?.value || [];
                const cVals = payload?.consumption?.value || [];
                const bVals = payload?.battery?.value || [];
                // Use longest label array from any type (not just production)
                const pLabels = payload?.production?.datetime || [];
                const cLabels = payload?.consumption?.datetime || [];
                const bLabels = payload?.battery?.datetime || [];
                const labels = [pLabels, cLabels, bLabels].reduce((a, b) => a.length >= b.length ? a : b, []);

                // Group by day for all 3 types
                const daily = {};
                for (let i = 0; i < labels.length; i++) {
                    const day = (labels[i] || '').substring(0, 10);
                    if (!daily[day]) daily[day] = { p: 0, c: 0, b: 0 };
                    daily[day].p += Number(pVals[i] || 0);
                    daily[day].c += Number(cVals[i] || 0);
                    daily[day].b += Number(bVals[i] || 0);
                }
                Object.entries(daily).sort().forEach(([day, vals]) => {
                    allRows.push({
                        building: b.name,
                        date: day,
                        production: vals.p.toFixed(2),
                        consumption: vals.c.toFixed(2),
                        battery: vals.b.toFixed(2),
                    });
                });
            }

            if (allRows.length === 0) {
                alert('No data found.');
                setExporting(false);
                return;
            }

            // Filter columns by selected export types
            const cols = [];
            if (exportTypes.produce) cols.push('production');
            if (exportTypes.consume) cols.push('consumption');
            if (exportTypes.battery) cols.push('battery');
            if (cols.length === 0) cols.push('consumption'); // default

            if (exportFormat === 'excel') {
                const header = ['Building', 'Date', ...cols.map(c => `${c.charAt(0).toUpperCase() + c.slice(1)} (kWh)`)].join(',');
                const csv = [header, ...allRows.map(r => [r.building, r.date, ...cols.map(c => r[c])].join(','))].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics_report_${startStr}_to_${endStr}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const thHtml = ['<th>Building</th>', '<th>Date</th>', ...cols.map(c => `<th>${c.charAt(0).toUpperCase() + c.slice(1)} (kWh)</th>`)].join('');
                const rowsHtml = allRows.map(r => `<tr><td>${r.building}</td><td>${r.date}</td>${cols.map(c => `<td>${r[c]}</td>`).join('')}</tr>`).join('');
                const html = `<html><head><title>Energy Report</title>
                    <style>body{font-family:Arial;padding:20px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px} th{background:#f5f5f5}</style>
                    </head><body><h1>Energy Analytics Report</h1><p>${startStr} to ${endStr}</p>
                    <table><tr>${thHtml}</tr>${rowsHtml}</table></body></html>`;
                const w = window.open('', '_blank');
                w.document.write(html);
                w.document.close();
                setTimeout(() => w.print(), 500);
            }

            setShowExportModal(false);
        } catch (err) {
            console.error('Export error:', err);
            alert('Export failed: ' + (err?.message || 'Unknown error'));
        } finally {
            setExporting(false);
        }
    };

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

        const compareLeft = selectedComparisonCharts.left;
        const compareRight = selectedComparisonCharts.right;
        const compareRows = [
            ['With Battery', compareLeft?.buildingName || '-'],
            ['With Battery Production (kWh)', '-'],
            ['With Battery Consumption (kWh)', '-'],
            ['With Battery SoC (%)', compareLeft?.hasBattery && compareLeft?.batteryPct != null ? `${compareLeft.batteryPct}%` : '-'],
            ['Without Battery', compareRight?.buildingName || '-'],
            ['Without Battery Production (kWh)', '-'],
            ['Without Battery Consumption (kWh)', '-'],
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

    // SVG Chart Component — supports multi-building series
    // Plotly Chart Component — supports multi-building series
    const EnergyChart = ({ data, series = [], showBattery = true, showProduce = true, showConsume = true, showSoC = true }) => {
        const hasSeries = series.length > 0;
        const sampleData = hasSeries ? series[0].data : data;
        const dataLen = Math.max(sampleData.length, 1);
        const labels = sampleData.map((d) => d.day);

        const traces = [];
        const yAxis2Traces = [];

        if (!hasSeries) {
            // AGGREGATED VIEW
            if (showProduce) {
                traces.push({
                    x: labels, y: data.map((d) => toNumeric(d.pvProduction)),
                    type: 'scatter', mode: 'lines+markers', name: 'Production',
                    line: { color: '#22c55e', width: 3 }, marker: { color: '#22c55e', size: 5 },
                    fill: 'tozeroy', fillcolor: 'rgba(34,197,94,0.1)',
                    hovertemplate: '%{x}<br>Production: %{y:,.0f} kWh<extra></extra>',
                });
            }
            if (showConsume) {
                traces.push({
                    x: labels, y: data.map((d) => toNumeric(d.consumption)),
                    type: 'scatter', mode: 'lines+markers', name: 'Consumption',
                    line: { color: '#ef4444', width: 3 }, marker: { color: '#ef4444', size: 5 },
                    hovertemplate: '%{x}<br>Consumption: %{y:,.0f} kWh<extra></extra>',
                });
            }
        } else {
            // PER-BUILDING VIEW
            series.forEach((s, si) => {
                const pCol = PRODUCE_COLORS[si % PRODUCE_COLORS.length];
                const cCol = CONSUME_COLORS[si % CONSUME_COLORS.length];
                const sCol = SOC_COLORS[si % SOC_COLORS.length];
                const dash = DASH_STYLES[si % DASH_STYLES.length];
                const mkr = MARKER_SYMBOLS[si % MARKER_SYMBOLS.length];
                const bName = s.buildingName || `Building ${si + 1}`;
                if (showProduce) {
                    traces.push({
                        x: labels, y: s.data.map((d) => toNumeric(d.pvProduction)),
                        type: 'scatter', mode: 'lines+markers', name: `${bName} Produce`,
                        line: { color: pCol, width: 2.5, dash }, marker: { color: pCol, size: 4, symbol: mkr },
                    });
                }
                if (showConsume) {
                    traces.push({
                        x: labels, y: s.data.map((d) => toNumeric(d.consumption)),
                        type: 'scatter', mode: 'lines+markers', name: `${bName} Consume`,
                        line: { color: cCol, width: 2, dash }, marker: { color: 'white', size: 4, line: { color: cCol, width: 1.5 }, symbol: `${mkr}-open` },
                    });
                }
                if (showSoC && s.hasBattery && s.data.some((d) => d.batterySoC != null)) {
                    yAxis2Traces.push(si);
                    traces.push({
                        x: labels, y: s.data.map((d) => toNumeric(d.batterySoC)),
                        type: 'scatter', mode: 'lines+markers', name: `${bName} SoC`,
                        yaxis: 'y2',
                        line: { color: sCol, width: 2, dash }, marker: { color: sCol, size: 5, symbol: mkr },
                    });
                }
            });
        }

        const layout = {
            autosize: true, height: hasSeries ? 500 : 400,
            margin: { l: 60, r: 20, t: 10, b: 50 },
            xaxis: { tickfont: { size: 11, color: '#6b7280' }, gridcolor: '#e5e7eb', automargin: true, nticks: 7 },
            yaxis: {
                title: { text: 'Energy (kWh)', font: { size: 12, color: '#6b7280' } },
                tickfont: { size: 11, color: '#6b7280' }, gridcolor: '#e5e7eb',
                rangemode: 'nonnegative',
            },
            paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
            showlegend: hasSeries,
            legend: { orientation: 'v', x: 1.02, y: 1, font: { size: 9 }, bgcolor: 'rgba(255,255,255,0.8)', bordercolor: '#e5e7eb', borderwidth: 1 },
            hovermode: 'x unified',
            hoverlabel: { font: { size: 11 } },
        };
        if (yAxis2Traces.length > 0) {
            layout.yaxis2 = { title: { text: 'SoC (%)', font: { size: 12, color: '#f97316' } }, tickfont: { size: 11, color: '#f97316' }, overlaying: 'y', side: 'right', range: [0, 100] };
            layout.margin.r = 70;
        }

        // Ensure at least one trace so Plotly renders the chart area
        if (traces.length === 0) {
            const safeLabels = labels.length > 0 ? labels : ['No data'];
            traces.push({ x: safeLabels, y: safeLabels.map(() => 0), type: 'scatter', mode: 'lines', line: { color: 'transparent' }, showlegend: false });
        }

        return <Plot data={traces} layout={layout} config={{ displayModeBar: false }} useResizeHandler style={{ width: '100%', height: 400 }} revision={chartRev} />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">

                {/* TOR Requirements Panel */}
                <TORReport />

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
                                <p className="text-sm font-bold text-purple-900">
                                    {adminBalance != null ? adminBalance.toLocaleString() : '—'} <span className="text-xs font-normal">Tokens</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setExportBuildings([...selectedBuildings]);
                                setShowExportModal(true);
                            }}
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
                                onClick={() => setTimeRange('1week')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '1week'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                1 Week
                            </button>
                            <button
                                onClick={() => setTimeRange('1month')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '1month'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                1 Month
                            </button>
                            <button
                                onClick={() => setTimeRange('1year')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                                    timeRange === '1year'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                1 Year
                            </button>
                            <button
                                onClick={() => setTimeRange('custom')}
                                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 ${
                                    timeRange === 'custom'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <span>📅</span>
                                <span>Custom</span>
                            </button>
                            {timeRange === 'custom' && (
                                <DatePicker
                                    selectsRange={true}
                                    startDate={customStart}
                                    endDate={customEnd}
                                    maxDate={new Date()}
                                    onChange={(update) => { setCustomDateRange(update); }}
                                    isClearable={true}
                                    dateFormat="dd MMM yyyy"
                                    placeholderText="Select date range"
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg w-56"
                                />
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-6 mb-4 justify-center flex-wrap">
                        {selectedBuildings.length === 0 ? (
                            <>
                                <div className={`flex items-center gap-2 transition-opacity ${chartToggle.showProduce ? 'opacity-100' : 'opacity-30'}`}>
                                    <div className="w-4 h-1 bg-green-500 rounded"></div>
                                    <span className="text-sm text-gray-700 font-medium">PV Production (kWH)</span>
                                </div>
                                <div className={`flex items-center gap-2 transition-opacity ${chartToggle.showConsume ? 'opacity-100' : 'opacity-30'}`}>
                                    <div className="w-4 h-1 bg-red-500 rounded"></div>
                                    <span className="text-sm text-gray-700 font-medium">Consumption (kWH)</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {selectedBuildings.map((name, idx) => {
                                    const pCol = PRODUCE_COLORS[idx % PRODUCE_COLORS.length];
                                    const cCol = CONSUME_COLORS[idx % CONSUME_COLORS.length];
                                    const sCol = SOC_COLORS[idx % SOC_COLORS.length];
                                    const entry = perBuildingChart[name] || {};
                                    const hasBat = entry.hasBattery === true;
                                    return (
                                        <div key={`leg-${name}`} className="flex items-center gap-2">
                                            <div className={`w-4 h-1 rounded transition-opacity ${chartToggle.showProduce ? 'opacity-100' : 'opacity-30'}`} style={{ backgroundColor: pCol }}></div>
                                            <span className={`text-xs font-medium transition-opacity ${chartToggle.showProduce ? 'text-gray-700 opacity-100' : 'text-gray-400 opacity-30'}`}>{name} (Produce)</span>
                                            <div className={`w-4 h-1 rounded border-2 border-dashed transition-opacity ${chartToggle.showConsume ? 'opacity-100' : 'opacity-30'}`} style={{ borderColor: cCol, backgroundColor: 'transparent' }}></div>
                                            <span className={`text-xs font-medium transition-opacity ${chartToggle.showConsume ? 'text-gray-700 opacity-100' : 'text-gray-400 opacity-30'}`}>(Consume)</span>
                                            {hasBat && (
                                                <span className={`text-xs ml-1 flex items-center gap-1 transition-opacity ${chartToggle.showSoC ? 'text-gray-500 opacity-100' : 'text-gray-300 opacity-30'}`}>
                                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[6px] font-bold border" style={{ borderColor: sCol, color: sCol, backgroundColor: `${sCol}15` }}>SoC</span>
                                                    <span>State of Charge (SoC) <span style={{ color: sCol }}>{entry.batterySoC ?? '?'}%</span></span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* Building filter — polished card */}
                    <div className="flex items-center gap-3 mb-4 justify-center">
                        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                            <button
                                onClick={() => {
                                    setSelectedBuildings([]);
                                    setChartToggle({ showProduce: true, showConsume: true, showSoC: true });
                                }}
                                className={`px-4 py-2 text-xs font-semibold transition-colors border-r border-gray-200 ${selectedBuildings.length === 0 ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                            >
                                🌐 All
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedBuildings(producerBuildings);
                                    setChartToggle({ showProduce: true, showConsume: false, showSoC: false });
                                }}
                                className={`px-4 py-2 text-xs font-semibold transition-colors border-r border-gray-200 ${isProducerActive ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-green-50'}`}
                            >
                                ☀️ Produce
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedBuildings(consumerBuildings);
                                    setChartToggle({ showProduce: false, showConsume: true, showSoC: false });
                                }}
                                className={`px-4 py-2 text-xs font-semibold transition-colors border-r border-gray-200 ${isConsumerActive ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-red-50'}`}
                            >
                                🏠 Consume
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedBuildings(batteryBuildings);
                                    setChartToggle({ showProduce: false, showConsume: false, showSoC: true });
                                }}
                                className={`px-4 py-2 text-xs font-semibold transition-colors ${isBatteryActive ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
                            >
                                🔋 Battery
                            </button>
                        </div>
                        <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                            <select
                                value=""
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (!v) return;
                                    if (v === '__produce__') {
                                        setSelectedBuildings(producerBuildings);
                                        setChartToggle({ showProduce: true, showConsume: false, showSoC: false });
                                    } else if (v === '__battery__') {
                                        setSelectedBuildings(batteryBuildings);
                                        setChartToggle({ showProduce: false, showConsume: false, showSoC: true });
                                    } else if (v === '__consume__') {
                                        setSelectedBuildings(consumerBuildings);
                                        setChartToggle({ showProduce: false, showConsume: true, showSoC: false });
                                    } else if (!selectedBuildings.includes(v)) {
                                        setSelectedBuildings([...selectedBuildings, v]);
                                    }
                                    e.target.value = '';
                                }}
                                className="px-3 py-2 bg-white text-xs font-medium text-gray-600 cursor-pointer focus:outline-none"
                            >
                                <option value="">+ Add Building</option>
                                <option value="__produce__">☀️ All Produce</option>
                                <option value="__consume__">🏠 All Consume</option>
                                <option value="__battery__">🔋 All Battery</option>
                                <option disabled>──────────</option>
                                {buildingOptions.filter(n => !selectedBuildings.includes(n)).map(name => (
                                    <option key={name} value={name}>🏢 {name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {selectedBuildings.length > 0 && (
                        <div className="flex items-center gap-2 mb-4 justify-center flex-wrap">
                            {selectedBuildings.map(name => (
                                <span
                                    key={`chip-${name}`}
                                    className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-xs font-semibold text-blue-700 shadow-sm"
                                >
                                    🏢 {name}
                                    <button
                                        onClick={() => setSelectedBuildings(selectedBuildings.filter(n => n !== name))}
                                        className="w-5 h-5 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-500 hover:bg-blue-200 hover:text-blue-700 text-xs leading-none transition-colors"
                                    >×</button>
                                </span>
                            ))}
                            <button
                                onClick={() => setSelectedBuildings([])}
                                className="text-[11px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                            >clear all</button>
                        </div>
                    )}

                    {/* Data Toggle Filters */}
                    <div className="flex items-center gap-3 mb-4 justify-center flex-wrap">
                        <span className="text-xs text-gray-500 font-medium mr-1">Show:</span>
                        <button
                            onClick={() => setChartToggle(prev => ({ ...prev, showProduce: !prev.showProduce }))}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                                chartToggle.showProduce
                                    ? 'bg-green-50 border-green-400 text-green-700 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${chartToggle.showProduce ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                            Produce
                        </button>
                        <button
                            onClick={() => setChartToggle(prev => ({ ...prev, showConsume: !prev.showConsume }))}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                                chartToggle.showConsume
                                    ? 'bg-red-50 border-red-400 text-red-700 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${chartToggle.showConsume ? 'bg-red-500' : 'bg-gray-300'}`}></span>
                            Consume
                        </button>
                        <button
                            onClick={() => setChartToggle(prev => ({ ...prev, showSoC: !prev.showSoC }))}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                                chartToggle.showSoC
                                    ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm'
                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                            }`}
                        >
                            <span className={`w-2 h-2 rounded-full ${chartToggle.showSoC ? 'bg-orange-500' : 'bg-gray-300'}`}></span>
                            State of Charge (SoC)
                        </button>
                    </div>

                    {/* Chart */}
                    <div className="w-full overflow-x-auto">
                        <EnergyChart
                            data={chartData}
                            series={selectedBuildings.length > 0
                                ? selectedBuildings.map((name) => {
                                    const entry = perBuildingChart[name] || { data: buildEmptyChartData(getDaysForRange(timeRange, customStart, customEnd)), hasBattery: false, batterySoC: null };
                                    return {
                                        name,
                                        buildingName: name,
                                        data: entry.data || entry,
                                        hasBattery: entry.hasBattery === true,
                                        batterySoC: entry.batterySoC != null ? entry.batterySoC : null,
                                    };
                                })
                                : []
                            }
                            showBattery={selectedBuildings.length === 0}
                            showProduce={chartToggle.showProduce}
                            showConsume={chartToggle.showConsume}
                            showSoC={chartToggle.showSoC}
                        />
                    </div>
                    <GapBar gaps={reportGaps} rangeStart={reportGapRange.start} rangeEnd={reportGapRange.end} />
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

                        {/* Donut Chart — Plotly */}
                        <div className="flex items-center justify-center mb-6">
                            <Plot
                                data={[{
                                    values: sourceBreakdown.items.map(i => i.value),
                                    labels: sourceBreakdown.items.map(i => i.label),
                                    marker: { colors: sourceBreakdown.items.map(i => i.color) },
                                    type: 'pie', hole: 0.6,
                                    textinfo: 'none',
                                    hovertemplate: '%{label}<br>%{value:,.0f} kWh (%{percent})<extra></extra>',
                                }]}
                                layout={{
                                    autosize: true, height: 280, width: 280,
                                    margin: { l: 0, r: 0, t: 0, b: 0 },
                                    paper_bgcolor: 'transparent',
                                    showlegend: false,
                                }}
                                config={{ displayModeBar: false }}
                            />
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

                {/* Building Energy Comparison */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Building Energy Comparison</h2>
                            <p className="text-sm text-gray-600">Compare energy flow between two buildings</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Time Range:</span>
                            {[
                                { key: '1d', label: '1 Day' },
                                { key: '7d', label: '7 Days' },
                            ].map((option) => (
                                <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setComparisonRange(option.key)}
                                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                                        comparisonRange === option.key
                                            ? 'bg-blue-600 text-white'
                                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {comparisonOptions.length === 0 ? (
                        <div className="w-full h-36 rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-500">
                            No per-building energy comparison available yet
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 flex flex-col gap-4 lg:flex-row">
                                <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1">
                                    <div className="mb-2 text-xs text-gray-500">Select first building</div>
                                    <select
                                        value={selectedComparisonA}
                                        onChange={(e) => handleSelectComparisonA(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                                    >
                                        {comparisonOptions.map((option) => (
                                            <option key={`a-${option.name}`} value={option.name}>
                                                {option.name} {option.hasBattery ? '(with Battery)' : '(without Battery)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1">
                                    <div className="mb-2 text-xs text-gray-500">Select second building</div>
                                    <select
                                        value={selectedComparisonB}
                                        onChange={(e) => handleSelectComparisonB(e.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                                    >
                                        {comparisonOptions.map((option) => (
                                            <option key={`b-${option.name}`} value={option.name}>
                                                {option.name} {option.hasBattery ? '(with Battery)' : '(without Battery)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 lg:flex-row">
                                {[selectedComparisonCharts.left, selectedComparisonCharts.right].filter(Boolean).map((chart, index) => {
                                    const yTicks = [chart?.maxValue || 0, (chart?.maxValue || 0) * 0.75, (chart?.maxValue || 0) * 0.5, (chart?.maxValue || 0) * 0.25, 0];
                                    const lineValues = (chart?.points || []).flatMap((point) => (
                                        chart?.hasBattery
                                            ? [point.solar, point.consumption, point.battery]
                                            : [point.solar, point.consumption]
                                    )).map(toNumeric);
                                    const lineScale = buildNiceScale(lineValues);
                                    const lineChartMin = lineScale.min;
                                    const lineChartMax = lineScale.max;
                                    const lineChartRange = Math.max(1, lineChartMax - lineChartMin);
                                    const lineYTicks = lineScale.ticks;
                                    const width = Math.max(240, (chart?.points?.length || 1) - 1) * 24;
                                    const totalNet = (chart?.netSeries || []).reduce((sum, value) => sum + value, 0);
                                    const currentBatteryPct = chart?.hasBattery ? toNumeric(chart?.batteryPct) : null;
                                    const polyline = (values) => values.map((value, valueIndex) => {
                                        const x = (valueIndex / Math.max(1, values.length - 1)) * width;
                                        const y = 160 - (((toNumeric(value) - lineChartMin) / lineChartRange) * 140);
                                        return `${x},${y}`;
                                    }).join(' ');

                                    return (
                                        <div key={`chart-${chart?.buildingName || '?'}-${comparisonRange}-${index}`} className="w-full min-w-0 space-y-4 lg:basis-1/2 lg:flex-1">
                                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                <div className="mb-3 text-sm font-semibold text-gray-800">
                                                    {chart?.buildingName || 'Building'}: {chart?.hasBattery ? 'Produce vs Consume vs Battery' : 'Produce vs Consume'}
                                                </div>
                                                <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
                                                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />PV Production</span>
                                                    <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rose-300" />Total Consumption</span>
                                                    {chart?.hasBattery && <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Battery</span>}
                                                </div>
                                                <div className="rounded-lg border border-gray-100 bg-white p-3">
                                                    <div className="flex gap-3">
                                                        <div className="w-10">
                                                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">kWh</div>
                                                            <div className="flex h-40 flex-col justify-between text-[10px] text-gray-500">
                                                                {yTicks.map((tick, tickIndex) => (
                                                                    <span key={`${chart?.buildingName || index}-bar-y-${comparisonRange}-${tickIndex}`} className="text-right">
                                                                        {Math.round(tick)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex h-40 items-end gap-1">
                                                                {chart?.points?.map((point) => (
                                                                    <div
                                                                        key={`${chart.buildingName}-${point.label}-${comparisonRange}`}
                                                                        className="flex min-w-0 flex-1 flex-col items-center gap-2"
                                                                    >
                                                                        <div className="flex h-32 w-full items-end gap-1">
                                                                            <div className="w-1/3 rounded-t bg-amber-400" style={{ height: `${point.solarPct}%` }} />
                                                                            <div className={`rounded-t bg-rose-300 ${chart.hasBattery ? 'w-1/3' : 'w-2/3'}`} style={{ height: `${point.consumptionPct}%` }} />
                                                                            {chart?.hasBattery && <div className="w-1/3 rounded-t bg-emerald-500" style={{ height: `${point.batteryPct}%` }} />}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500">
                                                                {chart?.points?.filter(p => p.displayLabel).map((point) => (
                                                                    <span key={`${chart.buildingName}-${point.label}-bar-x-${comparisonRange}`} className="text-center">{point.displayLabel}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                                <div className="mb-3 text-sm font-semibold text-gray-800">
                                                    {chart?.buildingName || 'Building'}: {chart?.hasBattery ? 'Grid & Battery Flow' : 'Net Grid Flow'}
                                                </div>
                                                <div className="mb-3 flex items-center gap-4 text-[11px] text-gray-500">
                                                    <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-amber-400" />PV Produce</span>
                                                    <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-rose-400" />Grid Import</span>
                                                    {chart?.hasBattery && <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-emerald-500" />Battery</span>}
                                                </div>
                                                <div className="rounded-lg border border-gray-100 bg-white p-3">
                                                    <div className="flex gap-3">
                                                        <div className="w-10">
                                                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">kWh</div>
                                                            <div className="flex h-44 flex-col justify-between text-[10px] text-gray-500">
                                                                {lineYTicks.map((tick, tickIndex) => (
                                                                    <span key={`${chart?.buildingName || index}-line-y-${comparisonRange}-${tickIndex}`} className="text-right">
                                                                        {Math.round(tick)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <svg viewBox={`0 0 ${width} 180`} className="h-44 w-full">
                                                                <polyline fill="none" stroke="#fbbf24" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.solar))} />
                                                                <polyline fill="none" stroke="#fb7185" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.consumption))} />
                                                                {chart?.hasBattery && (
                                                                    <polyline fill="none" stroke="#22c55e" strokeWidth="20" points={polyline((chart?.points || []).map((point) => point.battery))} />
                                                                )}
                                                            </svg>
                                                            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                                                                {chart?.points?.filter(p => p.displayLabel).map((point) => (
                                                                    <span key={`${chart.buildingName}-${point.label}-line-x-${comparisonRange}`} className="text-center">{point.displayLabel}</span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-2 gap-3">
                                                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                                                        <span className="text-xs text-gray-500">Current Battery SoC</span>
                                                        <div className="mt-1 font-semibold text-gray-900">
                                                            {chart?.hasBattery && currentBatteryPct != null ? `${currentBatteryPct}%` : 'N/A'}
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-lg border px-3 py-2 text-sm ${totalNet >= 0 ? 'border-blue-100 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                                                        <span className="text-xs text-gray-500">Battery Status</span>
                                                        <div className={`mt-1 font-semibold ${chart?.hasBattery ? 'text-blue-600' : 'text-gray-900'}`}>
                                                            {chart?.hasBattery ? 'State of Health (SoH)' : 'No Battery'}
                                                        </div>
                                                        {!chart?.hasBattery && (
                                                            <div className="mt-1 text-xs text-gray-500">
                                                                {`${totalNet >= 0 ? '+' : ''}${formatEnergy(totalNet)} kWh`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Grid & Battery Flow and Net Grid Flow */}
                {(() => {
                    // Use selected building or fallback to first battery-equipped
                    const gridOpts = comparisonOptions.filter(o => comparisonSeriesByBuilding[o.name]?.ranges?.['1d']);
                    const gridBuildingName = selectedGridBuilding && comparisonSeriesByBuilding[selectedGridBuilding]
                        ? selectedGridBuilding
                        : gridOpts[0]?.name || comparisonOptions[0]?.name;
                    const gridData = comparisonSeriesByBuilding[gridBuildingName]?.ranges?.['1d'];
                    if (!gridData) return null;
                    const { labels: gLabels, solar: gSolar, consumption: gConsumption, battery: gBattery } = gridData;
                    const hourlyLen = gLabels.length || 24;
                    const gridPoints = Array.from({ length: hourlyLen }, (_, i) => ({
                        label: gLabels[i] || '',
                        solar: toNumeric(gSolar[i]),
                        consumption: toNumeric(gConsumption[i]),
                        battery: toNumeric(gBattery[i]),
                    }));
                    // Grid import = max(0, consumption - solar - battery)
                    const gridImport = gridPoints.map(p => Math.max(0, p.consumption - p.solar - p.battery));
                    // Net grid flow: net = consumption - solar - battery (保持符号)
                    const netFlow = gridPoints.map(p => p.consumption - p.solar - p.battery);
                    const gridLabels = gridPoints.map(p => p.label);

                    return (
                <div className="flex gap-6 mb-6">
                    {/* Left: Grid & Battery Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Grid & Battery Flow</h2>
                                <p className="text-sm text-gray-600">Hourly Grid Import vs Battery Discharge</p>
                            </div>
                            <select value={gridBuildingName} onChange={(e) => setSelectedGridBuilding(e.target.value)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                                {gridOpts.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-4 mb-4 justify-center">
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-blue-500 rounded" /><span className="text-sm text-gray-700 font-medium">Grid Import</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-500 rounded" /><span className="text-sm text-gray-700 font-medium">Battery Discharge</span></div>
                        </div>
                        <div key={`grid-battery-div-${gridBuildingName}-${hourlyLen}`}>
                        <Plot
                            data={[
                                { x: gridLabels, y: gridImport, type: 'bar', name: 'Grid Import', marker: { color: '#3b82f6', opacity: 0.9 } },
                                { x: gridLabels, y: gridPoints.map(p => p.battery), type: 'bar', name: 'Battery Discharge', marker: { color: '#f97316', opacity: 0.9 } },
                            ]}
                            layout={{
                                autosize: true, height: 350, barmode: 'stack',
                                margin: { l: 55, r: 10, t: 10, b: 40 },
                                xaxis: { tickfont: { size: 10, color: '#6b7280' }, gridcolor: '#e5e7eb', automargin: true, nticks: 4 },
                                yaxis: { title: { text: 'kWh', font: { size: 12, color: '#6b7280' } }, tickfont: { size: 10, color: '#6b7280' }, gridcolor: '#e5e7eb', rangemode: 'tozero' },
                                paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                                showlegend: false,
                            }}
                            config={{ displayModeBar: false }}
                            useResizeHandler style={{ width: '100%', height: '100%' }}
                        />
                        </div>
                    </div>

                    {/* Right: Net Grid Flow */}
                    <div className="flex-1 bg-white rounded-2xl shadow-lg p-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Net Grid Flow</h2>
                            <p className="text-sm text-gray-600">Net Grid Exchange (Consumption − Solar − Battery) — {gridBuildingName}</p>
                        </div>
                        <div className="flex items-center gap-4 mb-4 justify-center mt-4">
                            <div className="flex items-center gap-2"><div className="w-4 h-1 bg-blue-600 rounded" /><span className="text-sm text-gray-700 font-medium">Net Grid</span></div>
                        </div>
                        {(() => {
                            const absMax = Math.max(1, ...netFlow.map(v => Math.abs(v)));
                            const pad = absMax * 0.1;
                            const yMin = -absMax - pad;
                            const yMax = absMax + pad;
                            const yRange = yMax - yMin;
                            const svgW = 520;
                            const svgH = 300;
                            const padL = 50;
                            const padR = 10;
                            const padT = 15;
                            const padB = 30;
                            const plotW = svgW - padL - padR;
                            const plotH = svgH - padT - padB;
                            const toX = (i) => padL + (hourlyLen > 1 ? (i / (hourlyLen - 1)) * plotW : plotW / 2);
                            const toY = (v) => padT + plotH - ((v - yMin) / yRange) * plotH;
                            const points = netFlow.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
                            const yTicks = [...new Set([Math.round(yMin), Math.round(yMin / 2), 0, Math.round(yMax / 2), Math.round(yMax)])].sort((a,b) => a-b);
                            const xTickInterval = Math.max(1, Math.floor(hourlyLen / 5));
                            return (
                                <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 350 }}>
                                    {/* Grid lines */}
                                    {yTicks.map((tick, ti) => (
                                        <line key={`yg-${ti}-${tick}`} x1={padL} y1={toY(tick)} x2={padL + plotW} y2={toY(tick)}
                                            stroke="#e5e7eb" strokeWidth="1" />
                                    ))}
                                    {/* Zero line bold */}
                                    <line x1={padL} y1={toY(0)} x2={padL + plotW} y2={toY(0)}
                                        stroke="#9ca3af" strokeWidth="1.5" />
                                    {/* Net line */}
                                    <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                    {/* Dots */}
                                    {netFlow.map((v, i) => (
                                        <circle key={`dot-${i}`} cx={toX(i)} cy={toY(v)} r="3" fill="#2563eb" />
                                    ))}
                                    {/* Y-axis labels */}
                                    {yTicks.map((tick, ti) => (
                                        <text key={`yl-${ti}-${tick}`} x={padL - 5} y={toY(tick) + 4}
                                            textAnchor="end" fontSize="10" fill="#6b7280">{tick}</text>
                                    ))}
                                    {/* X-axis labels */}
                                    {gridLabels.map((label, i) => {
                                        if (i % xTickInterval !== 0) return null;
                                        return (
                                            <text key={`xl-${i}`} x={toX(i)} y={svgH - 5}
                                                textAnchor="middle" fontSize="10" fill="#6b7280">{label}</text>
                                        );
                                    })}
                                    {/* Y-axis title */}
                                    <text x={12} y={svgH / 2} textAnchor="middle" fontSize="11" fill="#6b7280"
                                        transform={`rotate(-90, 12, ${svgH / 2})`}>kWh</text>
                                </svg>
                            );
                        })()}
                    </div>
                </div>
                    );
                })()}

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

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Export Report</h2>

                        {/* Building Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Buildings</label>
                            {(() => {
                                const blds = Object.values(buildingStats);
                                const allSelected = exportBuildings.length === 0;
                                return (
                                    <div className="space-y-3">
                                        {/* Quick select */}
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { key: 'all', label: '🌐 All', active: allSelected, onClick: () => setExportBuildings([]) },
                                                { key: 'produce', label: '☀️ Produce', active: !allSelected && blds.filter(b => b.hasProducer).every(b => exportBuildings.includes(b.name)), onClick: () => setExportBuildings(blds.filter(b => b.hasProducer).map(b => b.name)) },
                                                { key: 'consume', label: '🏠 Consume', active: !allSelected && blds.filter(b => b.hasConsumer).every(b => exportBuildings.includes(b.name)), onClick: () => setExportBuildings(blds.filter(b => b.hasConsumer).map(b => b.name)) },
                                                { key: 'battery', label: '🔋 Battery', active: !allSelected && blds.filter(b => b.hasBattery).every(b => exportBuildings.includes(b.name)), onClick: () => setExportBuildings(blds.filter(b => b.hasBattery).map(b => b.name)) },
                                            ].map(btn => (
                                                <button
                                                    key={btn.key}
                                                    type="button"
                                                    onClick={btn.onClick}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${btn.active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
                                                >
                                                    {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Individual buildings */}
                                        <div className="flex flex-wrap gap-2">
                                            {blds.map(b => {
                                                const active = allSelected || exportBuildings.includes(b.name);
                                                return (
                                                    <button
                                                        key={b.name}
                                                        type="button"
                                                        onClick={() => {
                                                            if (allSelected) {
                                                                setExportBuildings(blds.filter(x => x.name !== b.name).map(x => x.name));
                                                            } else if (exportBuildings.includes(b.name)) {
                                                                const next = exportBuildings.filter(n => n !== b.name);
                                                                setExportBuildings(next.length === blds.length ? [] : next);
                                                            } else {
                                                                const next = [...exportBuildings, b.name];
                                                                setExportBuildings(next.length === blds.length ? [] : next);
                                                            }
                                                        }}
                                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${active ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                                    >
                                                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${active ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                                                            {active ? '✓' : ''}
                                                        </span>
                                                        🏢 {b.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Time Range */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                            <div className="flex items-center gap-2">
                                <DatePicker selected={exportStartDate} onChange={setExportStartDate} dateFormat="MMM d, yyyy" maxDate={exportEndDate} className="w-full rounded border px-3 py-2 text-sm" />
                                <span className="text-gray-400">to</span>
                                <DatePicker selected={exportEndDate} onChange={setExportEndDate} dateFormat="MMM d, yyyy" minDate={exportStartDate} maxDate={new Date()} className="w-full rounded border px-3 py-2 text-sm" />
                            </div>
                        </div>

                        {/* Format */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                            <div className="flex gap-3">
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${exportFormat === 'excel' ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                    <input type="radio" name="fmt" value="excel" checked={exportFormat === 'excel'} onChange={() => setExportFormat('excel')} className="sr-only" />
                                    <span>📊</span><span className="text-sm font-semibold">Excel</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer ${exportFormat === 'pdf' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                                    <input type="radio" name="fmt" value="pdf" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} className="sr-only" />
                                    <span>📄</span><span className="text-sm font-semibold">PDF</span>
                                </label>
                            </div>
                        </div>

                        {/* Data Types to Export */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data to Export</label>
                            <div className="flex gap-3">
                                {[
                                    { key: 'consume', label: '🏠 Consumption', color: 'border-red-200 bg-red-50 text-red-700' },
                                    { key: 'produce', label: '☀️ Production', color: 'border-green-200 bg-green-50 text-green-700' },
                                    { key: 'battery', label: '🔋 Battery', color: 'border-orange-200 bg-orange-50 text-orange-700' },
                                ].map(t => (
                                    <label
                                        key={t.key}
                                        className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 cursor-pointer text-xs font-semibold transition ${exportTypes[t.key] ? t.color : 'border-gray-200 text-gray-400'}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={exportTypes[t.key]}
                                            onChange={() => setExportTypes(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                                            className="sr-only"
                                        />
                                        {t.label}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowExportModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50">Cancel</button>
                            <button onClick={handleModalExport} disabled={exporting} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                                {exporting ? 'Exporting...' : 'Export'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
