import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import axios from 'axios';
import { validateAuth } from "../../store/auth/auth.action";
import TORMeter from '../../components/TOR/TORMeter';
import { getHourlyEnergyByMeter, getDailyEnergyByMeter, getGaps, getMeters, getMeterBySnid } from '../../core/data_connecter/register';
import { getEnergyRates } from '../../core/data_connecter/rate';
import { buildHourlyTrend, buildTrailingDailyTrend, formatLocalDate } from '../../utils/meterAnalytics';
import Plot from 'react-plotly.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { getApiBase } from '../../core/data_connecter/apiBase';
import GapBar from '../../components/charts/GapBar';

const slugify = (name) => {
    if (!name) return '';
    return String(name).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

const formatMeterDisplayId = (value) => {
    if (value === null || value === undefined || value === '') return 'MTR-0';
    const raw = String(value).trim();
    if (/^MTR-/i.test(raw)) return raw.toUpperCase();
    return `MTR-${raw}`;
};

const getMeterRouteId = (item = {}) => item.snid || item.meterNumber || item.id || '';
const getMeterDisplayName = (item = {}) => {
    const baseName = item.meterName || item.name || getMeterRouteId(item);
    const typeName = String(item.type || item.meterType || '').trim();
    return typeName ? `${baseName} (${typeName})` : baseName;
};
const getMeterBuildingName = (item = {}) => item.building?.name || item.buildingName || item.building || '';

const formatWholeNumber = (value) => {
    const numeric = Number(value);
    const safeNumber = Number.isFinite(numeric) ? Math.round(numeric) : 0;
    return safeNumber.toLocaleString();
};

const getMockMeterData = (meterId) => {
    const meterLookup = {
        'MTR-042-PRD': {
            id: 'MTR-042-PRD',
            name: 'Producer Meter',
            type: 'Producer',
            typeId: 'Type P',
            icon: '🔋',
            color: 'green',
            building: 'Ratchaphruek Building',
            buildingId: 'BLD-042',
            location: 'Rooftop & Carport',
            subLocation: 'Solar Array',
            status: 'Online',
            connectedStatus: 'Connected',
            lastReading: '2 min ago',
            totalKWh: '1,650 kWh',
            capacity: '15 kW',
            registeredDate: 'Jan 2024',
            lastReadingValue: 1650,
            maxValue: 15000,
            dailyProduction: 1650,
            weeklyAverage: 8500,
            monthlyTotal: 35000,
            systemEfficiency: 92,
            inverterStatus: 'Operational',
            panelCount: 60
        },
        'MTR-042-CON': {
            id: 'MTR-042-CON',
            name: 'Consumer Meter',
            type: 'Consumer',
            typeId: 'Type C',
            icon: '⚡',
            color: 'red',
            building: 'Ratchaphruek Building',
            buildingId: 'BLD-042',
            location: 'All Floors & Facilities',
            subLocation: 'Main Meter',
            status: 'Online',
            connectedStatus: 'Connected',
            lastReading: '1 min ago',
            totalKWh: '1,245 kWh',
            capacity: '10,000 kWh',
            registeredDate: 'Jan 2024',
            lastReadingValue: 1245,
            maxValue: 10000,
            dailyConsumption: 1245,
            weeklyAverage: 8200,
            monthlyTotal: 32000,
            peakHours: '9:00 AM - 5:00 PM',
            avgDemand: '52 kW'
        },
        'MTR-042-BAT': {
            id: 'MTR-042-BAT',
            name: 'Battery Meter',
            type: 'Battery / ESS',
            typeId: 'Type B',
            icon: '🔋',
            color: 'orange',
            building: 'Ratchaphruek Building',
            buildingId: 'BLD-042',
            location: 'Basement Storage',
            subLocation: 'Battery Room',
            status: 'Online',
            connectedStatus: 'Connected',
            lastReading: '3 min ago',
            totalKWh: '425 kWh',
            capacity: '500 kWh',
            registeredDate: 'Jan 2024',
            lastReadingValue: 425,
            maxValue: 2000,
            stateOfCharge: 85,
            cycleCount: 1245,
            healthStatus: 98,
            chargeRate: '50 kW',
            dischargeRate: '60 kW'
        }
    };

    return meterLookup[meterId] || {
        id: meterId,
        name: 'Unknown Meter',
        type: 'Unknown',
        status: 'Offline',
        building: 'Unknown Building',
        location: 'Unknown Location',
        lastReading: 'N/A',
        totalKWh: '0 kWh'
    };
};

// ---- Battery Charge Source Donut Chart ----
const SOURCE_COLORS = {
    SOLAR: '#f59e0b',
    MARKET: '#3b82f6',
    GRID: '#ef4444',
    MANUAL: '#8b5cf6',
    UNKNOWN: '#9ca3af',
};
const SOURCE_LABELS = {
    SOLAR: '☀️ Solar',
    MARKET: '🏪 Market',
    GRID: '🔌 Grid',
    MANUAL: '🔧 Manual',
    UNKNOWN: '❓ Unknown',
};
const DISCHARGE_LABELS = {
    SELF: '🏠 Self-Consumption',
    MARKET: '🏪 Market Sale',
};

function BatteryChargeSource({ snid }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!snid) { setLoading(false); return; }
        let mounted = true;
        const controller = new AbortController();
        setLoading(true);
        axios.get(`${getApiBase()}/runningMeters/battery-charge-sources/${snid}?days=7`, {
            signal: controller.signal,
            timeout: 10000,
        })
            .then(res => { if (mounted) setData(res.data); })
            .catch(() => { if (mounted) setData(null); })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; controller.abort(); };
    }, [snid]);

    if (loading) return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
            <div className="animate-pulse h-6 bg-gray-200 rounded w-1/2 mb-4" />
            <div className="animate-pulse h-48 bg-gray-100 rounded" />
        </div>
    );

    // Show placeholder when data unavailable
    if (!data || !data.chargeSources) return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🔋</span>
                </div>
                <div>
                    <h3 className="text-base font-bold text-gray-900">Battery Charge Sources</h3>
                    <p className="text-xs text-gray-400">Charge source tracking will appear here once the backend is updated with the latest deployment.</p>
                </div>
            </div>
        </div>
    );

    const buildingName = data.buildingName || 'This Building';
    const chargeSources = data.chargeSources || [];
    const dischargeSources = data.dischargeSources || [];
    const dischargeTotal = data.dischargeTotalKwh || 0;
    const chargeTotal = data.chargeTotalKwh || 0;

    // Merge with all known sources
    const sourceMap = {};
    for (const s of chargeSources) sourceMap[s.source] = s.kwh;
    const ALL_SOURCES = ['SOLAR', 'MARKET', 'GRID'];
    const merged = ALL_SOURCES.map(src => ({ source: src, kwh: sourceMap[src] || 0 }))
        .sort((a, b) => b.kwh - a.kwh);

    const fmtKwh = (v) => v >= 10 ? v.toFixed(0) : v.toFixed(1);

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🔋</span>
                </div>
                <div>
                    <h3 className="text-base font-bold text-gray-900">Battery Energy Flow (7 days)</h3>
                    <p className="text-xs text-gray-500">{buildingName}</p>
                </div>
            </div>

            {/* Charge Section */}
            <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600 text-sm font-bold">⬇ CHARGE</span>
                    <span className="text-xs text-gray-400">{fmtKwh(chargeTotal)} kWh total</span>
                </div>
                <div className="space-y-1.5">
                    {merged.map(s => {
                        const pct = chargeTotal > 0 ? (s.kwh / chargeTotal * 100) : 0;
                        const color = SOURCE_COLORS[s.source] || '#9ca3af';
                        return (
                            <div key={s.source} className="flex items-center gap-2 pl-2 py-1 rounded hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-medium text-gray-700">
                                            {SOURCE_LABELS[s.source] || s.source}
                                            <span className="text-gray-400 font-normal"> from {s.source === 'MARKET' ? 'Marketplace' : buildingName}</span>
                                        </span>
                                        <span className="text-xs font-semibold text-gray-800">{fmtKwh(s.kwh)} kWh</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Discharge Section */}
            <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-red-500 text-sm font-bold">⬆ DISCHARGE</span>
                    <span className="text-xs text-gray-400">{fmtKwh(dischargeTotal)} kWh total</span>
                </div>
                <div className="space-y-1.5">
                    {dischargeSources.map(s => {
                        const pct = dischargeTotal > 0 ? (s.kwh / dischargeTotal * 100) : 0;
                        const color = s.source === 'MARKET' ? SOURCE_COLORS.MARKET : '#ef4444';
                        return (
                            <div key={s.source} className="flex items-center gap-2 pl-2 py-1 rounded hover:bg-gray-50 transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-medium text-gray-700">
                                            {DISCHARGE_LABELS[s.source] || `❓ ${s.source}`}
                                            <span className="text-gray-400 font-normal"> at {buildingName}</span>
                                        </span>
                                        <span className="text-xs font-semibold text-gray-800">{fmtKwh(s.kwh)} kWh</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default function Meter() {
    const { meterId } = useParams();
    const history = useHistory();
    const location = useLocation();
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const [meter, setMeter] = useState(null);
    const [offeredKwh, setOfferedKwh] = useState(0);
    const [allMeters, setAllMeters] = useState([]);
    const [selectedBuildingName, setSelectedBuildingName] = useState('');
    const [trendMode, setTrendMode] = useState('today');
    const [customDateRange, setCustomDateRange] = useState([null, null]);
    const [meterGaps, setMeterGaps] = useState([]);
    const [meterGapRange, setMeterGapRange] = useState({ start: null, end: null });
    const [startDate, endDate] = customDateRange;
    const [hourlyTrend, setHourlyTrend] = useState({
        labels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`),
        values: Array(24).fill(0),
        maxValue: 0,
        total: 0,
        peak: 0,
    });
    const [energyRates, setEnergyRates] = useState([]);
    const [notFound, setNotFound] = useState(false);
    const [batterySource, setBatterySource] = useState('solar'); // 'solar' | 'central'

    const normalizeMeterType = (value) => {
        const text = String(value || '').toLowerCase();
        if (text.includes('produce') || text.includes('producer')) return 'Producer';
        if (text.includes('consume') || text.includes('consumer')) return 'Consumer';
        if (text.includes('battery')) return 'Battery / ESS';
        return value || 'Unknown';
    };

    const buildDailyTrend = (rows = [], monthNumber = null) => {
        const latestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        const labels = Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            if (!monthNumber) return `D${day}`;
            return `${String(day).padStart(2, '0')}/${String(monthNumber).padStart(2, '0')}`;
        });
        const values = labels.map((_, index) => Number(latestRow?.days?.[`d${index + 1}`] || 0));
        const maxValue = Math.max(...values, 0);
        const total = values.reduce((sum, value) => sum + value, 0);
        const peak = Math.max(...values, 0);
        return { labels, values, maxValue, total, peak };
    };

    const buildMonthlyTrend = (rows = []) => {
        const latestRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const values = labels.map((_, index) => Number(latestRow?.months?.[`M${index + 1}`] || 0));
        const maxValue = Math.max(...values, 0);
        const total = values.reduce((sum, value) => sum + value, 0);
        const peak = Math.max(...values, 0);
        return { labels, values, maxValue, total, peak };
    };

    const buildEmptyTrendForMode = (mode, now = new Date()) => {
        if (mode === 'week') {
            return buildTrailingDailyTrend([], 7, now);
        }
        if (mode === 'month') {
            return buildTrailingDailyTrend([], 30, now);
        }
        if (mode === 'custom') {
            return { labels: [], values: [], maxValue: 0, total: 0, peak: 0 };
        }
        return buildHourlyTrend([]);
    };

    const hasMeaningfulTrendData = (trend) => {
        return Array.isArray(trend?.values) && trend.values.some((value) => Number(value) > 0);
    };

    const buildDailyTrendFromHourlyFallback = async (energyMeterId, daysBack, endDate) => {
        const points = [];

        for (let offset = daysBack - 1; offset >= 0; offset -= 1) {
            const date = new Date(endDate);
            date.setDate(endDate.getDate() - offset);
            const dateLabel = formatLocalDate(date);
            const rows = await getHourlyEnergyByMeter(energyMeterId, dateLabel).catch(() => []);
            const hourly = buildHourlyTrend(Array.isArray(rows) ? rows : []);
            points.push({
                label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
                value: Number(hourly.total || 0),
            });
        }

        const labels = points.map((point) => point.label);
        const values = points.map((point) => point.value);
        const maxValue = Math.max(...values, 0);
        const total = values.reduce((sum, value) => sum + value, 0);
        const peak = Math.max(...values, 0);
        return { labels, values, maxValue, total, peak };
    };

    const formatInstalledDate = (value) => {
        if (!value) return 'Unknown';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const buildMeterViewModel = (source) => {
        if (!source) return null;

        const buildingName = source.building?.name || source.buildingName || source.building || 'N/A';
        const buildingId = source.building?.id != null ? String(source.building.id) : (source.buildingId || '');
        const serviceType = normalizeMeterType(source.type || source.meterType);
        const capacityValue = Number(source.capacity || 0);
        const installedDate = formatInstalledDate(source.dateInstalled || source.registeredDate);
        const rawLocation = source.location || source.subLocation || source.building?.address || source.building?.province || '';

        return {
            id: source.snid || source.id || source.meterName || meterId,
            name: source.meterName || source.name || `${serviceType} Meter`,
            type: serviceType,
            typeId: source.typeId || source.meterType || serviceType,
            building: buildingName,
            buildingId,
            buildingSlug: slugify(buildingName),
            location: rawLocation || 'N/A',
            subLocation: source.subLocation || source.building?.address || source.building?.province || '',
            status: source.approveStatus || source.status || 'Unknown',
            connectedStatus: source.connectedStatus || 'Connected',
            lastReading: source.lastReading || (source.timestamp ? new Date(source.timestamp).toLocaleString() : 'N/A'),
            totalKWh: `${formatWholeNumber(source.kWH || source.totalKWh || source.value || 0)} kWh`,
            capacity: capacityValue > 0 ? `${formatWholeNumber(capacityValue)} kW` : 'N/A',
            registeredDate: installedDate,
            lastReadingValue: Number(source.value || source.kWH || source.lastReadingValue || 0),
            meterCount: 1,
            warranty: source.warranty || 'N/A',
            subLocationLabel: source.subLocation || '',
            raw: source
        };
    };

    useEffect(() => {
        const fetchAllMeters = async () => {
            try {
                const response = await getMeters();
                const list = Array.isArray(response) ? response : (response?.meters || []);
                if (list.length > 0) {
                    setAllMeters(list);
                } else {
                    throw new Error('empty');
                }
            } catch (error) {
                setAllMeters([]);
            }
        };
        fetchAllMeters();
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadRates = async () => {
            try {
                const items = await getEnergyRates();
                if (mounted) {
                    setEnergyRates(Array.isArray(items) ? items : []);
                }
            } catch (error) {
                if (mounted) {
                    setEnergyRates([]);
                }
            }
        };

        loadRates();
        return () => { mounted = false; };
    }, []);

    // Store the last viewed meter in localStorage
    useEffect(() => {
        if (meterId) {
            localStorage.setItem('lastViewedMeter', meterId);
        }
    }, [meterId]);

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        const loadMeter = async () => {
            try {
                const response = await getMeterBySnid(meterId);
                const normalized = buildMeterViewModel(response);
                if (normalized) {
                    setMeter(normalized);
                    setNotFound(false);
                    return;
                }
            } catch (error) {
                console.error('Error loading meter detail:', error);
            }

            setNotFound(true);
            setMeter(null);
        };

        loadMeter();
    }, [meterId]);

    useEffect(() => {
        if (!meter || !Array.isArray(allMeters) || allMeters.length === 0) return;

        const currentBuilding = String(meter.building || '').toLowerCase();
        if (!currentBuilding) return;

        const countInBuilding = allMeters.filter((item) => {
            const candidate = String(item.building?.name || item.buildingName || item.building || '').toLowerCase();
            return candidate && candidate === currentBuilding;
        }).length;

        if (countInBuilding > 0 && countInBuilding !== meter.meterCount) {
            setMeter((prev) => ({ ...prev, meterCount: countInBuilding }));
        }
    }, [allMeters, meter]);

    useEffect(() => {
        if (meter?.building) {
            setSelectedBuildingName(meter.building);
        }
    }, [meter?.building]);

    useEffect(() => {
        let mounted = true;

        const loadTrend = async () => {
            if (!meter?.id) return;

            try {
                const rawAnchorDate = meter?.raw?.timestamp ? new Date(meter.raw.timestamp) : new Date();
                const anchorDate = Number.isNaN(rawAnchorDate.getTime()) ? new Date() : rawAnchorDate;
                let nextTrend = buildEmptyTrendForMode(trendMode, anchorDate);
                const energyMeterId = String(meter?.raw?.snid || meter?.id || meterId || '');

                if (trendMode === 'custom') {
                    if (startDate && endDate) {
                        const startMonth = startDate.getMonth() + 1;
                        const startYear = startDate.getFullYear();
                        const endMonth = endDate.getMonth() + 1;
                        const endYear = endDate.getFullYear();

                        const monthsToFetch = [];
                        let currY = startYear;
                        let currM = startMonth;
                        while (currY < endYear || (currY === endYear && currM <= endMonth)) {
                            monthsToFetch.push({ year: currY, month: currM });
                            currM++;
                            if (currM > 12) {
                                currM = 1;
                                currY++;
                            }
                        }

                        const allRows = await Promise.all(
                            monthsToFetch.map(async ({ year, month }) => {
                                const rows = await getDailyEnergyByMeter(energyMeterId, month, year).catch(()=>[]);
                                return { year, month, rows };
                            })
                        );

                        const points = [];
                        let currDate = new Date(startDate);
                        currDate.setHours(0,0,0,0);
                        const endDateZero = new Date(endDate);
                        endDateZero.setHours(0,0,0,0);

                        while (currDate <= endDateZero) {
                            const d = currDate.getDate();
                            const m = currDate.getMonth() + 1;
                            const y = currDate.getFullYear();

                            const monthData = allRows.find(r => r.year === y && r.month === m);
                            const latestRow = Array.isArray(monthData?.rows) && monthData.rows.length > 0 ? monthData.rows[0] : null;
                            const val = Number(latestRow?.days?.[`d${d}`] || 0);

                            points.push({
                                label: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
                                value: val,
                                date: new Date(currDate)
                            });
                            currDate.setDate(currDate.getDate() + 1);
                        }

                        const labels = points.map(p => p.label);
                        const values = points.map(p => p.value);
                        const total = values.reduce((s, v) => s + v, 0);
                        const maxValue = Math.max(...values, 0);
                        const peak = Math.max(...values, 0);
                        nextTrend = { labels, values, maxValue, total, peak };

                        if (!hasMeaningfulTrendData(nextTrend)) {
                            const diffDaysCalc = Math.ceil((endDateZero.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            if (diffDaysCalc <= 31) {
                                 const hourlyPoints = [];
                                 for (const p of points) {
                                     const dateLabel = formatLocalDate(p.date);
                                     const hRows = await getHourlyEnergyByMeter(energyMeterId, dateLabel).catch(() => []);
                                     const hourly = buildHourlyTrend(Array.isArray(hRows) ? hRows : []);
                                     hourlyPoints.push(Number(hourly.total || 0));
                                 }
                                 const hValues = hourlyPoints;
                                 const hTotal = hValues.reduce((s, v) => s + v, 0);
                                 nextTrend = {
                                     labels: points.map(p => p.label),
                                     values: hValues,
                                     maxValue: Math.max(...hValues, 0),
                                     total: hTotal,
                                     peak: Math.max(...hValues, 0)
                                 };
                            }
                        }
                    } else {
                        if (!mounted) return;
                        setHourlyTrend({ labels: [], values: [], maxValue: 0, total: 0, peak: 0 });
                        return;
                    }
                } else if (trendMode === 'week' || trendMode === 'month') {
                    const currentMonth = anchorDate.getMonth() + 1;
                    const currentYear = anchorDate.getFullYear();
                    const previousDate = new Date(anchorDate);
                    previousDate.setMonth(anchorDate.getMonth() - 1);
                    const previousMonth = previousDate.getMonth() + 1;
                    const previousYear = previousDate.getFullYear();
                    const [currentRows, previousRows] = await Promise.all([
                        getDailyEnergyByMeter(energyMeterId, currentMonth, currentYear),
                        previousMonth !== currentMonth || previousYear !== currentYear
                            ? getDailyEnergyByMeter(energyMeterId, previousMonth, previousYear)
                            : Promise.resolve([]),
                    ]);

                    nextTrend = buildTrailingDailyTrend(
                        [
                            { year: currentYear, month: currentMonth, rows: currentRows },
                            { year: previousYear, month: previousMonth, rows: previousRows },
                        ],
                        trendMode === 'week' ? 7 : 30,
                        anchorDate
                    );

                    if (!hasMeaningfulTrendData(nextTrend)) {
                        nextTrend = await buildDailyTrendFromHourlyFallback(
                            energyMeterId,
                            trendMode === 'week' ? 7 : 30,
                            anchorDate
                        );
                    }
                } else {
                    const today = formatLocalDate(anchorDate);
                    const rows = await getHourlyEnergyByMeter(energyMeterId, today);
                    nextTrend = buildHourlyTrend(rows);
                }

                if (!mounted) return;
                setHourlyTrend(nextTrend);
            } catch (error) {
                console.error('Error loading meter trend:', error);
                if (!mounted) return;
                setHourlyTrend(buildEmptyTrendForMode(trendMode, new Date()));
            }
        };

        loadTrend();
        return () => { mounted = false; };
    }, [meter?.id, trendMode, startDate, endDate]);

    // Detect data gaps for the current meter and time range
    useEffect(() => {
        if (!meter?.id) return;
        let mounted = true;
        const energyMeterId = String(meter?.raw?.snid || meter?.id || meterId || '');

        const now = new Date();
        let rangeStart, rangeEnd;

        if (trendMode === 'custom' && startDate && endDate) {
            rangeStart = new Date(startDate); rangeStart.setHours(0, 0, 0, 0);
            rangeEnd = new Date(endDate); rangeEnd.setHours(23, 59, 59, 999);
        } else if (trendMode === 'week') {
            rangeEnd = new Date(now);
            rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 7);
            rangeStart.setHours(0, 0, 0, 0);
        } else if (trendMode === 'month') {
            rangeEnd = new Date(now);
            rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 30);
            rangeStart.setHours(0, 0, 0, 0);
        } else {
            // today
            rangeStart = new Date(now); rangeStart.setHours(0, 0, 0, 0);
            rangeEnd = new Date(now); rangeEnd.setHours(23, 59, 59, 999);
        }

        getGaps({ meterId: energyMeterId, from: rangeStart.toISOString(), to: rangeEnd.toISOString() })
            .then((g) => {
                if (mounted) {
                    setMeterGaps(Array.isArray(g) ? g : []);
                    setMeterGapRange({ start: rangeStart.toISOString(), end: rangeEnd.toISOString() });
                }
            })
            .catch(() => {});

        return () => { mounted = false; };
    }, [meter?.id, trendMode, startDate, endDate, meterId]);

    const buildingOptions = useMemo(() => {
        const seen = new Set();
        return allMeters.reduce((acc, item) => {
            const buildingName = getMeterBuildingName(item);
            if (!buildingName) return acc;
            const key = String(buildingName).toLowerCase();
            if (seen.has(key)) return acc;
            seen.add(key);
            acc.push({ label: buildingName, value: buildingName });
            return acc;
        }, []);
    }, [allMeters]);

    const metersForSelectedBuilding = useMemo(() => {
        if (!selectedBuildingName) return [];
        return allMeters.filter((item) => (
            String(getMeterBuildingName(item)).toLowerCase() === String(selectedBuildingName).toLowerCase()
        ));
    }, [allMeters, selectedBuildingName]);

    const currentMeterRouteId = meterId || getMeterRouteId(meter?.raw || {});
    const rawMeter = meter?.raw || {};
    const activePanel = new URLSearchParams(location.search).get('panel') || '';
    const isGridPanel = activePanel === 'grid';
    // Battery source override: Central Battery → all zeros (no data from centralized storage)
    const isCentralBattery = batterySource === 'central';
    const trendChart = isCentralBattery
        ? { labels: hourlyTrend.labels, values: hourlyTrend.values.map(() => 0), maxValue: 0, total: 0, peak: 0 }
        : hourlyTrend;
    const isProducerMeter = meter?.type === 'Producer';
    const isConsumerMeter = meter?.type === 'Consumer';
    const isBatteryMeter = String(meter?.type || meter?.raw?.type || '').toLowerCase().includes('battery');

    // Fetch offered energy in marketplace for battery meters
    useEffect(() => {
        if (!meter?.id || !isBatteryMeter) { setOfferedKwh(0); return; }
        axios.get(`${getApiBase()}/runningMeters/battery-charge-sources/${meter.id}?days=7`)
            .then(res => { setOfferedKwh(res.data?.offeredKwh || 0); })
            .catch(() => { setOfferedKwh(0); });
    }, [meter?.id, isBatteryMeter]);

    // Y-axis label: dynamic based on meter type
    const yAxisUnitLabel = isConsumerMeter ? 'Consumption (kWh)'
        : isBatteryMeter ? 'Storage (kWh)'
        : 'Production (kWh)';
    const liveKwh = isCentralBattery ? 0 : Number(rawMeter.kWH ?? rawMeter.value ?? 0);
    const liveCapacity = isCentralBattery ? 0 : Number(rawMeter.capacity ?? 0);
    // Battery: value field stores kWh (SoC from trading engine), not instantaneous kW
    const liveCurrentKw = isCentralBattery ? 0 : (isBatteryMeter ? 0 : Number(rawMeter.value ?? 0));
    const liveUtilization = liveCapacity > 0 ? Math.min(100, Math.round((liveCurrentKw / liveCapacity) * 100)) : null;
    const peakHourIndex = trendChart.values.findIndex((value) => Number(value || 0) === Number(trendChart.peak || 0));
    const peakHourLabel = peakHourIndex >= 0 ? trendChart.labels[peakHourIndex] : 'N/A';
    const batterySoc = rawMeter.currentPercentage != null ? Number(rawMeter.currentPercentage) : null;
    // Battery stored energy: ALWAYS cap at capacity
    const batteryStoredKwh = isBatteryMeter
        ? (liveCapacity > 0 ? Math.min(liveKwh, liveCapacity) : liveKwh)
        : liveKwh;
    const dailyTargetKwh = liveCapacity > 0 ? liveCapacity * 24 : 0;
    const progressPercent = dailyTargetKwh > 0 ? Math.min(100, Math.round((Number(meter?.lastReadingValue || 0) / dailyTargetKwh) * 100)) : null;
    const efficiencyValue = rawMeter.systemEfficiency != null
        ? Number(rawMeter.systemEfficiency)
        : (rawMeter.efficiency != null ? Number(rawMeter.efficiency) : null);
    const solarTargetKwh = liveCapacity > 0 ? liveCapacity * 8 : 0;
    const storagePercent = batterySoc != null
        ? Math.max(0, Math.min(100, Math.round(batterySoc)))
        : (liveCapacity > 0 ? Math.max(0, Math.min(100, Math.round((batteryStoredKwh / liveCapacity) * 100))) : null);
    const summaryValue = isBatteryMeter
        ? (storagePercent != null ? `${storagePercent}%` : 'N/A')
        : `${formatWholeNumber(trendChart.total || 0)} kWh`;
    const summaryAccentClass = isConsumerMeter ? 'text-rose-600' : isBatteryMeter ? 'text-amber-600' : 'text-green-600';
    const progressBarClass = isConsumerMeter ? 'bg-rose-500' : isBatteryMeter ? 'bg-amber-500' : 'bg-green-500';
    const trendColor = isConsumerMeter ? '#ef4444' : isBatteryMeter ? '#f97316' : '#22c55e';
    const trendColorRgba = isConsumerMeter ? 'rgba(239,68,68,0.10)' : isBatteryMeter ? 'rgba(249,115,22,0.10)' : 'rgba(34,197,94,0.10)';
    const trendBtnActive = isConsumerMeter ? 'bg-red-100 text-red-700 hover:bg-red-200' : isBatteryMeter ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200';
    const summaryProgressPercent = isBatteryMeter ? storagePercent : progressPercent;
    const summaryCardTitle = isConsumerMeter
        ? "Today's Consumption"
        : isBatteryMeter
            ? 'Battery Storage'
            : "Today's Production";
    const summaryCardSubtitle = isConsumerMeter
        ? 'Real-time demand from consumer meter'
        : isBatteryMeter
            ? 'Real-time ESS storage and charge state'
            : 'Real-time generation from producer meter';
    const latestEnergyRate = Number(energyRates?.[0]?.rate ?? energyRates?.[0]?.value ?? 3.85);
    const gridImportedTotal = Number(trendChart.total || 0);
    const estimatedGridCost = gridImportedTotal * latestEnergyRate;
    const timeframeLabel = trendMode === 'month' ? '30 Days' : trendMode === 'week' ? '7 Days' : trendMode === 'custom' ? 'Custom Range' : 'Today';
    const trendTitle = isGridPanel ? 'Real-time Grid Import Trend'
        : isConsumerMeter ? 'Real-time Consumption Trend'
        : isBatteryMeter ? 'Real-time Storage Trend'
        : 'Real-time Production Trend';
    const trendSubtitle = isGridPanel
        ? 'Energy drawn from the utility grid'
        : (isConsumerMeter ? 'Energy consumption in kWh over 24 hours' : trendMode === 'custom' ? 'Custom date range' : 'Energy generation in kWh over 24 hours');

    // --- Meter Connectivity (real data) ---
    const meterExists = Boolean(meter?.raw?.snid);
    const lastMeterTimestamp = rawMeter?.timestamp ? new Date(rawMeter.timestamp) : null;
    const nowMs = Date.now();
    const lastSyncMs = lastMeterTimestamp ? nowMs - lastMeterTimestamp.getTime() : null;
    // Last sync: show relative time or "Never"
    const lastSyncText = lastSyncMs != null
        ? (lastSyncMs < 60_000 ? 'Just now'
            : lastSyncMs < 3_600_000 ? `${Math.round(lastSyncMs / 60_000)} min ago`
            : lastSyncMs < 86_400_000 ? `${Math.round(lastSyncMs / 3_600_000)}h ago`
            : `${Math.round(lastSyncMs / 86_400_000)}d ago`)
        : 'Never';
    // Signal strength based on data freshness
    const signalStrength = lastSyncMs == null ? 'No Data'
        : lastSyncMs < 3_600_000 ? 'Excellent'
        : lastSyncMs < 86_400_000 ? 'Good'
        : 'Weak';
    const signalColor = lastSyncMs == null ? 'text-gray-400'
        : lastSyncMs < 3_600_000 ? 'text-green-600'
        : lastSyncMs < 86_400_000 ? 'text-amber-600'
        : 'text-red-500';

    const handleBuildingChange = (nextBuildingName) => {
        setSelectedBuildingName(nextBuildingName);
        const nextMeter = allMeters.find((item) => (
            String(getMeterBuildingName(item)).toLowerCase() === String(nextBuildingName).toLowerCase()
        ));
        const nextMeterId = getMeterRouteId(nextMeter);
        if (nextMeterId && nextMeterId !== currentMeterRouteId) {
            history.push(`/meter/${nextMeterId}`);
        }
    };

    const handleMeterChange = (nextMeterId) => {
        if (nextMeterId && nextMeterId !== currentMeterRouteId) {
            history.push(`/meter/${nextMeterId}`);
        }
    };
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmtLabel = (l) => { const p = String(l).split('/'); return p.length === 2 ? `${parseInt(p[0])} ${MONTHS[parseInt(p[1])-1]||''}` : l; };
    const customRangeLabel = trendMode === 'custom' && trendChart.labels.length > 0
        ? `from ${fmtLabel(trendChart.labels[0])} to ${fmtLabel(trendChart.labels[trendChart.labels.length - 1])}`
        : 'in range';
    const timeframeUnit = trendMode === 'week' ? 'this week'
        : trendMode === 'month' ? 'this month'
        : trendMode === 'custom' ? customRangeLabel
        : 'today';
    const summaryUnitLabel = isConsumerMeter
        ? `kWh consumed ${timeframeUnit}`
        : isBatteryMeter
            ? (offeredKwh > 0
                ? `${formatWholeNumber(Math.max(0, batteryStoredKwh - offeredKwh))} kWh available · ${offeredKwh.toFixed(1)} kWh on market`
                : `${formatWholeNumber(batteryStoredKwh)} kWh stored`)
            : `kWh generated ${timeframeUnit}`;
    const summaryProgressText = isBatteryMeter
        ? (
            liveCurrentKw > 0
                ? `Charging at ${formatWholeNumber(liveCurrentKw)} kW`
                : liveCurrentKw < 0
                    ? `Discharging at ${formatWholeNumber(Math.abs(liveCurrentKw))} kW`
                    : 'Storage level is steady'
        )
        : summaryProgressPercent != null
            ? `Up ${summaryProgressPercent}% of target`
            : `Total ${timeframeUnit}`;
    const summaryMetrics = isBatteryMeter
        ? [
            {
                label: 'Stored Energy',
                value: `${formatWholeNumber(batteryStoredKwh)} kWh`,
                className: 'text-gray-900',
            },
            {
                label: 'On Market',
                value: offeredKwh > 0 ? `${offeredKwh.toFixed(1)} kWh` : '—',
                className: offeredKwh > 0 ? 'text-blue-600' : 'text-gray-400',
            },
            {
                label: 'Current Power',
                value: `${formatWholeNumber(liveCurrentKw)} kW`,
                className: 'text-gray-900',
            },
            {
                label: 'State of Charge',
                value: storagePercent != null ? `${storagePercent}%` : 'N/A',
                className: 'text-amber-600',
            },
        ]
        : isConsumerMeter
            ? [
                {
                    label: 'Installed Capacity',
                    value: liveCapacity > 0 ? `${formatWholeNumber(liveCapacity)} kW` : 'N/A',
                    className: 'text-gray-900',
                },
                {
                    label: 'Peak Demand',
                    value: `${formatWholeNumber(liveCurrentKw)} kW`,
                    className: 'text-gray-900',
                },
                {
                    label: 'Load Ratio',
                    value: liveUtilization != null ? `${liveUtilization}%` : 'N/A',
                    className: 'text-rose-600',
                },
            ]
            : [
                {
                    label: 'Daily Target',
                    value: solarTargetKwh > 0 ? `${formatWholeNumber(solarTargetKwh)} kWh` : 'N/A',
                    className: 'text-gray-900',
                },
                {
                    label: 'Live Output',
                    value: `${formatWholeNumber(liveCurrentKw)} kW`,
                    className: 'text-gray-900',
                },
                {
                    label: 'Efficiency',
                    value: efficiencyValue != null ? `${efficiencyValue}%` : 'N/A',
                    className: 'text-green-600',
                },
            ];

    if (notFound) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
                    <div className="text-xl font-semibold text-gray-900">Meter not found</div>
                    <div className="mt-2 text-sm text-gray-500">No live meter record matches this URL.</div>
                    <button
                        onClick={() => history.push('/home')}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!meter) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">

                {/* TOR Requirements Panel */}
                <TORMeter />

                {/* Header with Back Button and Meter Title */}
                <div className="mb-6 flex items-center gap-4">
                    <button 
                        onClick={() => history.push(`/building/${meter.buildingSlug || slugify(meter.building)}`)}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <span className="text-xl">←</span>
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">{meter.name}</h1>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                                {formatMeterDisplayId(meter.id)}
                            </span>
                            {allMeters.length > 0 && (
                                <div className="flex flex-wrap items-stretch gap-3">
                                    <div
                                        style={{
                                            minWidth: 190,
                                            padding: '8px 10px',
                                            borderRadius: 12,
                                            border: '1px solid #dbeafe',
                                            background: 'linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)',
                                            boxShadow: '0 8px 20px rgba(37,99,235,0.08)',
                                        }}
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">Building</div>
                                        <select
                                            value={selectedBuildingName}
                                            onChange={(e) => handleBuildingChange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                minWidth: 168,
                                                fontSize: 13,
                                                padding: '7px 10px',
                                                borderRadius: 9,
                                                border: '1px solid #bfdbfe',
                                                background: '#ffffff',
                                                color: '#0f172a',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                outline: 'none',
                                            }}
                                        >
                                            {buildingOptions.map((item) => (
                                                <option key={item.value} value={item.value}>{item.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div
                                        style={{
                                            minWidth: 240,
                                            padding: '8px 10px',
                                            borderRadius: 12,
                                            border: '1px solid #dbeafe',
                                            background: 'linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)',
                                            boxShadow: '0 8px 20px rgba(37,99,235,0.08)',
                                        }}
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">Meter</div>
                                        <select
                                            value={currentMeterRouteId}
                                            onChange={(e) => handleMeterChange(e.target.value)}
                                            style={{
                                                width: '100%',
                                                minWidth: 220,
                                                fontSize: 13,
                                                padding: '7px 10px',
                                                borderRadius: 9,
                                                border: '1px solid #bfdbfe',
                                                background: '#ffffff',
                                                color: '#1d4ed8',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                outline: 'none',
                                            }}
                                        >
                                            {metersForSelectedBuilding.map((item) => {
                                                const val = getMeterRouteId(item);
                                                return <option key={val} value={val}>{getMeterDisplayName(item)}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-600">{meter.building} - {meter.location}</p>
                    </div>
                    {false && <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📊</span>
                            <span>Analytics</span>
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>🔧</span>
                            <span>Settings</span>
                        </button>
                    </div>}
                </div>

                {/* Meter Summary and Meter Connectivity */}
                <div className="flex gap-6 mb-6">
                    {/* Summary Card */}
                    <div className="flex-1 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                        {meter.type === 'Battery / ESS' && (
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-gray-500 font-semibold">Source:</span>
                                <button
                                    onClick={() => setBatterySource('solar')}
                                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                        batterySource === 'solar'
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50'
                                    }`}
                                >☀️ Solar</button>
                                <button
                                    onClick={() => setBatterySource('central')}
                                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                        batterySource === 'central'
                                            ? 'bg-gray-500 text-white'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                    }`}
                                >🏭 Central Battery</button>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-3xl">🌤️</span>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{summaryCardTitle}</h2>
                                <p className="text-sm text-gray-600">{summaryCardSubtitle}</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className={`text-5xl font-bold mb-1 ${summaryAccentClass}`}>{summaryValue}</div>
                            <div className="text-sm text-gray-600 mb-3">{summaryUnitLabel}</div>
                            <div className={`text-xs mb-3 ${summaryAccentClass}`}>{summaryProgressText}</div>
                        </div>

                        <div className="flex gap-4">
                            {summaryMetrics.map((metric) => (
                                <div key={metric.label} className="flex-1">
                                    <div className="text-xs text-gray-600 mb-1">{metric.label}</div>
                                    <div className={`text-lg font-bold ${metric.className}`}>{metric.value}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-full h-2 overflow-hidden mt-4 flex">
                            {/* Offered portion */}
                            {isBatteryMeter && offeredKwh > 0 && liveCapacity > 0 && (
                                <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${Math.min(100, (offeredKwh / liveCapacity) * 100)}%` }}
                                ></div>
                            )}
                            {/* Available portion */}
                            <div 
                                className={`h-full rounded-full transition-all flex-1 ${progressBarClass}`}
                                style={{ width: isBatteryMeter && offeredKwh > 0 ? `${Math.max(0, (summaryProgressPercent || 0) - Math.min(100, (offeredKwh / (liveCapacity || 1)) * 100))}%` : `${summaryProgressPercent != null ? summaryProgressPercent : 0}%` }}
                            ></div>
                        </div>
                        {isBatteryMeter && offeredKwh > 0 && (
                            <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-400">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Available</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> On Market</span>
                            </div>
                        )}
                    </div>

                    {/* Meter Connectivity Card */}
                    <div className="flex-1 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-3xl">📡</span>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Meter Connectivity</h2>
                                <p className="text-sm text-gray-600">Connection status and details</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 mb-6">
                            <span className={`w-4 h-4 rounded-full ${meterExists ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <div>
                                <div className="text-lg font-bold text-gray-900">{meterExists ? '1/1' : '0/1'}</div>
                                <div className={`text-sm ${meterExists ? 'text-green-600' : 'text-red-600'}`}>{meterExists ? 'Online' : 'Offline'}</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">API Status</span>
                                <span className={`text-sm font-semibold ${meterExists ? 'text-green-600' : 'text-red-600'}`}>{meterExists ? '• Connected' : '• Not Found'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Last Sync</span>
                                <span className="text-sm font-semibold text-gray-900">{lastSyncText}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Data Interval</span>
                                <span className="text-sm font-semibold text-gray-900">Hourly</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Signal Strength</span>
                                <span className={`text-sm font-semibold ${signalColor}`}>{signalStrength}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Real-time Trend Chart */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">{trendTitle}</h2>
                        <p className="text-sm text-gray-600">{trendSubtitle}</p>
                    </div>

                    <div className="h-64">
                        <Plot
                            data={[{
                                x: trendChart.labels,
                                y: trendChart.values,
                                type: 'scatter',
                                mode: 'lines+markers',
                                marker: { color: trendColor, size: 3 },
                                line: { color: trendColor, width: 2 },
                                fill: 'tozeroy',
                                fillcolor: trendColorRgba,
                                hovertemplate: '%{x}<br>%{y:,.0f} kWh<extra></extra>',
                            }]}
                            layout={{
                                autosize: true,
                                margin: { l: 55, r: 15, t: 5, b: 45 },
                                xaxis: {
                                    tickfont: { size: 10, color: '#9ca3af' },
                                    gridcolor: '#e5e7eb',
                                    automargin: true,
                                },
                                yaxis: {
                                    title: { text: yAxisUnitLabel, font: { size: 10, color: '#6b7280' } },
                                    tickfont: { size: 10, color: '#9ca3af' },
                                    gridcolor: '#e5e7eb',
                                    rangemode: 'tozero',
                                },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                showlegend: false,
                                hovermode: 'x unified',
                                hoverlabel: { bgcolor: 'rgba(0,0,0,0.8)', font: { size: 11, color: '#fff' } },
                            }}
                            config={{ displayModeBar: false }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '100%' }}
                        />
                    </div>

                    <GapBar gaps={meterGaps} rangeStart={meterGapRange.start} rangeEnd={meterGapRange.end} />

                    {/* Chart controls */}
                    <div className="text-right mt-3">
                        <div className="inline-flex gap-1.5 items-center">
                        <button
                            type="button"
                            onClick={() => setTrendMode('today')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${trendMode === 'today' ? trendBtnActive : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >Today</button>
                        <button
                            type="button"
                            onClick={() => setTrendMode('week')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${trendMode === 'week' ? trendBtnActive : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >Week</button>
                        <button
                            type="button"
                            onClick={() => setTrendMode('month')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${trendMode === 'month' ? trendBtnActive : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >Month</button>
                        <button
                            type="button"
                            onClick={() => setTrendMode('custom')}
                            className={`px-2.5 py-1 rounded text-xs font-semibold ${trendMode === 'custom' ? trendBtnActive : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >Custom</button>
                        {trendMode === 'custom' && (
                            <DatePicker
                                selectsRange={true}
                                startDate={startDate}
                                endDate={endDate}
                                maxDate={new Date()}
                                onChange={(update) => setCustomDateRange(update)}
                                isClearable={true}
                                placeholderText="Select range"
                                className="px-2 py-1 pr-6 text-xs border border-gray-300 rounded"
                                style={{ width: 140 }}
                            />
                        )}
                        </div>
                    </div>
                </div>

                {/* Battery Charge Source Breakdown — only for battery meters */}
                {isBatteryMeter && (
                <BatteryChargeSource snid={meter?.id || meter?.raw?.snid} />
                )}

                <div className="flex gap-6 mb-6">
                    {/* Left Column: Meter Information */}
                    <div className="w-1/2">
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-2xl">ℹ️</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Meter Information</h2>
                                    <p className="text-sm text-gray-600">Technical specifications and location</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Meter ID */}
                                <div className="flex items-start gap-3">
                                    <span className="text-lg">📡</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-600 mb-1">Meter ID</div>
                                        <div className="font-bold text-gray-900">{formatMeterDisplayId(meter.id)}</div>
                                    </div>
                                </div>

                                {/* Service Type and Building */}
                                <div className="relative pt-3 border-t border-gray-100">
                                    {/* Service Type */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">🏷️</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Service Type</div>
                                            <div className="font-bold text-gray-900">{meter.type}</div>
                                        </div>
                                    </div>

                                    {/* Building */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">🏢</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Building Assignment</div>
                                            <div className="font-bold text-gray-900">{meter.building}</div>
                                            <div className="text-xs text-gray-600">{meter.buildingId}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Physical Location */}
                                <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                                    <span className="text-lg">📍</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-600 mb-1">Physical Location</div>
                                        <div className="font-bold text-gray-900">{meter.location}</div>
                                        <div className="text-xs text-gray-600">{meter.subLocation}</div>
                                    </div>
                                </div>

                                {/* Technical Details */}
                                <div className="relative pt-3 border-t border-gray-100">
                                    {/* Installed Capacity */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">⚡</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Installed Capacity</div>
                                            <div className="font-bold text-gray-900">{meter.capacity}</div>
                                        </div>
                                    </div>

                                    {/* Device Count */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">📊</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Device Count</div>
                                            <div className="font-bold text-gray-900">{meter.meterCount || 1} unit{(meter.meterCount || 1) > 1 ? 's' : ''}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Installation and Warranty */}
                                <div className="relative pt-3 border-t border-gray-100">
                                    {/* Installation Date */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">📅</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Installation Date</div>
                                            <div className="font-bold text-gray-900">{meter.registeredDate}</div>
                                        </div>
                                    </div>

                                    {/* Warranty */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">🛡️</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Warranty</div>
                                            <div className="font-bold text-gray-900">{meter.warranty}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Performance Metrics */}
                    <div className="w-1/2">
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <span className="text-2xl">📈</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">{isGridPanel ? 'Grid Import Metrics' : 'Performance Metrics'}</h2>
                                    <p className="text-sm text-gray-600">{isGridPanel ? 'Utility import and cost overview' : 'Current operational statistics'}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {isCentralBattery && (
                                    <div className="bg-gray-100 rounded-lg p-3 border border-gray-300 text-center">
                                        <span className="text-sm text-gray-500">⚠️ No data available — Central Battery storage is not monitored in this system</span>
                                    </div>
                                )}
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <div className="text-xs text-blue-600 mb-1">{isGridPanel ? 'Current Draw' : 'Live Reading'}</div>
                                    <div className="text-2xl font-bold text-blue-600">{formatWholeNumber(liveCurrentKw)} kW</div>
                                    <div className="text-xs text-blue-600">
                                        {isGridPanel
                                            ? `${timeframeLabel} import trend from utility meter`
                                            : (liveUtilization != null ? `${liveUtilization}% of installed capacity` : 'No live utilization data')}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                        <div className="text-xs text-green-600 mb-1">{isGridPanel ? `Total Import (${timeframeLabel})` : 'Latest Energy'}</div>
                                        <div className="text-xl font-bold text-green-600">{formatWholeNumber(isGridPanel ? gridImportedTotal : liveKwh)} kWh</div>
                                        <div className="text-xs text-green-600">{isGridPanel ? 'Imported energy from utility grid' : 'Current meter energy value'}</div>
                                    </div>
                                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                        <div className="text-xs text-purple-600 mb-1">{isGridPanel ? 'Est. Grid Cost' : trendMode === 'week' ? '7-Day Total' : trendMode === 'month' ? '30-Day Total' : trendMode === 'custom' ? customRangeLabel : '24h Total'}</div>
                                        <div className="text-xl font-bold text-purple-600">
                                            {isGridPanel ? `${formatWholeNumber(estimatedGridCost)} THB` : `${formatWholeNumber(trendChart.total || 0)} kWh`}
                                        </div>
                                        <div className="text-xs text-purple-600">
                                            {isGridPanel ? `@ ${formatWholeNumber(latestEnergyRate)} THB per kWh` : trendMode === 'today' ? 'Calculated from hourly records' : 'Calculated from daily records'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                        <div className="text-xs text-orange-600 mb-1">Peak Hour</div>
                                        <div className="text-lg font-bold text-orange-600">{peakHourLabel}</div>
                                        <div className="text-xs text-orange-600">{formatWholeNumber(trendChart.peak || 0)} kWh at peak</div>
                                    </div>
                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <div className="text-xs text-slate-600 mb-1">{meter.type === 'Battery / ESS' ? 'State of Charge' : 'Installed Capacity'}</div>
                                        <div className="text-lg font-bold text-slate-700">
                                            {meter.type === 'Battery / ESS'
                                                ? (batterySoc != null ? `${batterySoc}%` : 'N/A')
                                                : (liveCapacity > 0 ? `${formatWholeNumber(liveCapacity)} kW` : 'N/A')}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {meter.type === 'Battery / ESS'
                                                ? `${formatWholeNumber(batteryStoredKwh)} kWh stored`
                                                : 'Registered meter capacity'}
                                        </div>
                                    </div>
                                </div>

                                {false && meter.type === 'Producer' && (
                                    <>
                                        {/* Current Output */}
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-blue-600 mb-1">💡 Current Output</div>
                                                    <div className="text-2xl font-bold text-blue-600">{liveCurrentKw.toLocaleString()} kW</div>
                                                    <div className="text-xs text-blue-600">{liveUtilization != null ? `${liveUtilization}% of capacity` : 'No live utilization data'}</div>
                                                </div>
                                                <span className="text-blue-600">📊</span>
                                            </div>
                                        </div>

                                        {/* This Month */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">🌱 This Month</div>
                                                <div className="text-xl font-bold text-green-600">{liveKwh.toLocaleString()}</div>
                                                <div className="text-xs text-green-600">kWh from latest reading</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">📊 This Year</div>
                                                <div className="text-xl font-bold text-purple-600">{Number(trendChart.total || 0).toLocaleString()}</div>
                                                <div className="text-xs text-purple-600">kWh from last 24 hours</div>
                                            </div>
                                        </div>

                                        {/* Environmental Impact */}
                                        <div className="bg-gradient-to-r from-green-50 to-orange-50 rounded-lg p-4 border border-green-200">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-green-600 mb-1">🌍 Environmental Impact</div>
                                                    <div className="text-xl font-bold text-green-600">N/A</div>
                                                    <div className="text-xs text-green-600">No live environmental data</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-orange-600 mb-1">🍃 CO₂ Offset</div>
                                                    <div className="text-xl font-bold text-orange-600">N/A</div>
                                                    <div className="text-xs text-orange-600">No live offset data</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weather Conditions */}
                                        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                            <div className="text-xs text-yellow-700 mb-2">🌤️ Weather Conditions</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <div className="text-xs text-yellow-600">Irradiance</div>
                                                    <div className="text-lg font-bold text-yellow-700">920 w/m²</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-yellow-600">Temperature</div>
                                                    <div className="text-lg font-bold text-yellow-700">31°C</div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {false && meter.type === 'Consumer' && (
                                    <>
                                        {/* Current Consumption */}
                                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-red-600 mb-1">⚡ Current Consumption</div>
                                                    <div className="text-2xl font-bold text-red-600">{liveCurrentKw.toLocaleString()} kW</div>
                                                    <div className="text-xs text-red-600">{liveUtilization != null ? `${liveUtilization}% of installed capacity` : 'No live demand ratio'}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Usage Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">📊 This Month</div>
                                                <div className="text-xl font-bold text-green-600">{liveKwh.toLocaleString()}</div>
                                                <div className="text-xs text-green-600">kWh from latest reading</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">📈 This Year</div>
                                                <div className="text-xl font-bold text-purple-600">{Number(trendChart.total || 0).toLocaleString()}</div>
                                                <div className="text-xs text-purple-600">kWh from last 24 hours</div>
                                            </div>
                                        </div>

                                        {/* Efficiency Rating */}
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <div className="text-xs text-blue-600 mb-2">📊 Efficiency Rating</div>
                                            <div className="text-lg font-bold text-blue-600">{peakHourLabel}</div>
                                            <div className="text-xs text-blue-600">{Number(trendChart.peak || 0).toLocaleString()} kWh peak hour</div>
                                        </div>
                                    </>
                                )}
                                {false && meter.type === 'Battery / ESS' && (
                                    <>
                                        {/* State of Charge */}
                                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-orange-600 mb-1">🔋 State of Charge</div>
                                                    <div className="text-2xl font-bold text-orange-600">{batterySoc != null ? `${batterySoc}%` : 'N/A'}</div>
                                                    <div className="text-xs text-orange-600">{batteryStoredKwh.toLocaleString()} kWh stored</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Health Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">💪 Health Status</div>
                                                <div className="text-xl font-bold text-green-600">{liveCapacity > 0 ? `${liveCapacity.toLocaleString()} kW` : 'N/A'}</div>
                                                <div className="text-xs text-green-600">Installed capacity</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">♻️ Cycle Count</div>
                                                <div className="text-xl font-bold text-purple-600">{Number(trendChart.total || 0).toLocaleString()}</div>
                                                <div className="text-xs text-purple-600">kWh from last 24 hours</div>
                                            </div>
                                        </div>

                                        {/* Charge/Discharge */}
                                        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-green-600 mb-1">⬆️ Charge Rate</div>
                                                    <div className="text-lg font-bold text-green-600">{liveKwh.toLocaleString()} kWh</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-blue-600 mb-1">⬇️ Discharge</div>
                                                    <div className="text-lg font-bold text-blue-600">{peakHourLabel}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => history.push(`/building/${meter.buildingSlug || slugify(meter.building)}`)}
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <span>←</span>
                        <span>Back</span>
                    </button>
                    {false && <div className="flex items-center gap-3">
                        <button className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📊</span>
                            <span>View Charts</span>
                        </button>
                        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>⬇️</span>
                            <span>Export Data</span>
                        </button>
                    </div>}
                </div>
            </div>
        </div>
    );
}
