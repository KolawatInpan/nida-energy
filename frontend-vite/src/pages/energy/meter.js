import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../../store/auth/auth.action";
import TORMeter from '../../components/TOR/TORMeter';
import { getHourlyEnergyByMeter, getDailyEnergyByMeter, getMeters, getMeterBySnid } from '../../core/data_connecter/register';
import { getEnergyRates } from '../../core/data_connecter/rate';
import { buildHourlyTrend, buildTrailingDailyTrend, buildXAxisLabels, formatLocalDate } from '../../utils/meterAnalytics';

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

export default function Meter() {
    const { meterId } = useParams();
    const history = useHistory();
    const location = useLocation();
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const [meter, setMeter] = useState(null);
    const [allMeters, setAllMeters] = useState([]);
    const [selectedBuildingName, setSelectedBuildingName] = useState('');
    const [trendMode, setTrendMode] = useState('today');
    const [hourlyTrend, setHourlyTrend] = useState({
        labels: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`),
        values: Array(24).fill(0),
        maxValue: 0,
        total: 0,
        peak: 0,
    });
    const [energyRates, setEnergyRates] = useState([]);
    const [notFound, setNotFound] = useState(false);

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

    const buildTrendPath = (values = [], width = 770, height = 120) => {
        if (!values.length) return '';

        const maxValue = Math.max(...values, 1);
        return values.map((value, index) => {
            const x = 30 + (index * (width / Math.max(values.length - 1, 1)));
            const y = 140 - ((Number(value || 0) / maxValue) * height);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
    };

    const buildAreaPath = (values = [], width = 770, height = 120) => {
        const linePath = buildTrendPath(values, width, height);
        if (!linePath) return '';
        const endX = 30 + width;
        return `${linePath} L ${endX} 140 L 30 140 Z`;
    };

    const formatInstalledDate = (value) => {
        if (!value) return 'Unknown';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown';
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

                if (trendMode === 'week' || trendMode === 'month') {
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
    }, [meter?.id, trendMode]);

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
    const trendChart = hourlyTrend;
    const yAxisMax = Math.max(Math.ceil(trendChart.maxValue || 0), 1);
    const yAxisStep = yAxisMax / 3;
    const yAxisLabels = [yAxisMax, yAxisStep * 2, yAxisStep, 0].map((value) => Math.round(value * 100) / 100);
    const trendPath = buildTrendPath(trendChart.values);
    const areaPath = buildAreaPath(trendChart.values);
    const xAxisLabels = buildXAxisLabels(trendChart.labels, trendMode);
    const rawMeter = meter?.raw || {};
    const activePanel = new URLSearchParams(location.search).get('panel') || '';
    const isGridPanel = activePanel === 'grid';
    const liveKwh = Number(rawMeter.kWH ?? rawMeter.value ?? 0);
    const liveCapacity = Number(rawMeter.capacity ?? 0);
    const liveCurrentKw = Number(rawMeter.value ?? 0);
    const liveUtilization = liveCapacity > 0 ? Math.min(100, Math.round((liveCurrentKw / liveCapacity) * 100)) : null;
    const peakHourIndex = trendChart.values.findIndex((value) => Number(value || 0) === Number(trendChart.peak || 0));
    const peakHourLabel = peakHourIndex >= 0 ? trendChart.labels[peakHourIndex] : 'N/A';
    const batterySoc = rawMeter.currentPercentage != null ? Number(rawMeter.currentPercentage) : null;
    const batteryStoredKwh = rawMeter.currentkWH != null ? Number(rawMeter.currentkWH) : liveKwh;
    const dailyTargetKwh = liveCapacity > 0 ? liveCapacity * 24 : 0;
    const progressPercent = dailyTargetKwh > 0 ? Math.min(100, Math.round((Number(meter?.lastReadingValue || 0) / dailyTargetKwh) * 100)) : null;
    const efficiencyValue = rawMeter.systemEfficiency != null
        ? Number(rawMeter.systemEfficiency)
        : (rawMeter.efficiency != null ? Number(rawMeter.efficiency) : null);
    const isProducerMeter = meter?.type === 'Producer';
    const isConsumerMeter = meter?.type === 'Consumer';
    const isBatteryMeter = meter?.type === 'Battery / ESS';
    const solarTargetKwh = liveCapacity > 0 ? liveCapacity * 8 : 0;
    const storagePercent = batterySoc != null
        ? Math.max(0, Math.min(100, Math.round(batterySoc)))
        : (liveCapacity > 0 ? Math.max(0, Math.min(100, Math.round((batteryStoredKwh / liveCapacity) * 100))) : null);
    const summaryValue = isBatteryMeter
        ? (storagePercent != null ? `${storagePercent}%` : 'N/A')
        : `${formatWholeNumber(trendChart.total || 0)} kWh`;
    const summaryAccentClass = isConsumerMeter ? 'text-rose-600' : isBatteryMeter ? 'text-amber-600' : 'text-green-600';
    const progressBarClass = isConsumerMeter ? 'bg-rose-500' : isBatteryMeter ? 'bg-amber-500' : 'bg-green-500';
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
    const timeframeLabel = trendMode === 'month' ? '30 Days' : trendMode === 'week' ? '7 Days' : 'Today';
    const trendTitle = isGridPanel ? 'Real-time Grid Import Trend' : 'Real-time Production Trend';
    const trendSubtitle = isGridPanel
        ? 'Energy drawn from the utility grid'
        : (isConsumerMeter ? 'Energy consumption in kWh over 24 hours' : 'Energy generation in kWh over 24 hours');

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
    const summaryUnitLabel = isConsumerMeter
        ? 'kWh consumed today'
        : isBatteryMeter
            ? `${formatWholeNumber(batteryStoredKwh)} kWh stored`
            : 'kWh generated today';
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
            : 'No target available';
    const summaryMetrics = isBatteryMeter
        ? [
            {
                label: 'Stored Energy',
                value: `${formatWholeNumber(batteryStoredKwh)} kWh`,
                className: 'text-gray-900',
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

                        <div className="bg-white rounded-full h-2 overflow-hidden mt-4">
                            <div 
                                className={`h-full rounded-full transition-all ${progressBarClass}`}
                                style={{ width: `${summaryProgressPercent != null ? summaryProgressPercent : 0}%` }}
                            ></div>
                        </div>
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
                            <span className="w-4 h-4 bg-green-500 rounded-full"></span>
                            <div>
                                <div className="text-lg font-bold text-gray-900">1/1</div>
                                <div className="text-sm text-green-600">Online</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">API Status</span>
                                <span className="text-sm font-semibold text-green-600">• Connected</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Last Sync</span>
                                <span className="text-sm font-semibold text-gray-900">2 min ago</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Data Interval</span>
                                <span className="text-sm font-semibold text-gray-900">15 seconds</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600">Signal Strength</span>
                                <span className="text-sm font-semibold text-gray-900">Excellent</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Real-time Production Trend */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
                    <div className="mb-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">{trendTitle}</h2>
                        <p className="text-sm text-gray-600">{trendSubtitle}</p>
                    </div>

                    {/* Simple line chart visualization */}
                    <div className="relative h-64 bg-gradient-to-b from-green-50 to-transparent rounded-lg p-4">
                        <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid meet">
                            {/* Y-axis labels */}
                            <text x="5" y="20" className="text-xs fill-gray-400">{yAxisLabels[0]}</text>
                            <text x="5" y="60" className="text-xs fill-gray-400">{yAxisLabels[1]}</text>
                            <text x="5" y="100" className="text-xs fill-gray-400">{yAxisLabels[2]}</text>
                            <text x="5" y="140" className="text-xs fill-gray-400">{yAxisLabels[3]}</text>

                            {/* Grid lines */}
                            <line x1="30" y1="20" x2="800" y2="20" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="60" x2="800" y2="60" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="100" x2="800" y2="100" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="140" x2="800" y2="140" stroke="#e5e7eb" strokeWidth="1"/>

                            {areaPath ? (
                                <path
                                    d={areaPath}
                                    fill="rgba(34, 197, 94, 0.10)"
                                    stroke="none"
                                />
                            ) : null}

                            {trendPath ? (
                                <path
                                    d={trendPath}
                                    stroke="#22c55e"
                                    strokeWidth="3"
                                    fill="none"
                                />
                            ) : null}

                            {/* X-axis labels */}
                            {xAxisLabels.map((tick) => (
                                <text key={`${tick.index}-${tick.label}`} x={tick.x} y="160" className="text-xs fill-gray-400">
                                    {tick.label}
                                </text>
                            ))}
                        </svg>
                    </div>

                    {/* Chart controls */}
                    <div className="flex justify-end gap-2 mt-4">
                        <button
                            type="button"
                            onClick={() => setTrendMode('today')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${trendMode === 'today' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => setTrendMode('week')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${trendMode === 'week' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            Week
                        </button>
                        <button
                            type="button"
                            onClick={() => setTrendMode('month')}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${trendMode === 'month' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                            Month
                        </button>
                    </div>
                </div>

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
                                        <div className="text-xs text-purple-600 mb-1">{isGridPanel ? 'Est. Grid Cost' : '24h Total'}</div>
                                        <div className="text-xl font-bold text-purple-600">
                                            {isGridPanel ? `${formatWholeNumber(estimatedGridCost)} THB` : `${formatWholeNumber(trendChart.total || 0)} kWh`}
                                        </div>
                                        <div className="text-xs text-purple-600">
                                            {isGridPanel ? `@ ${formatWholeNumber(latestEnergyRate)} THB per kWh` : 'Calculated from hourly records'}
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

