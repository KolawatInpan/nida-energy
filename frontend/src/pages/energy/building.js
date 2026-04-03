import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../../store/auth/auth.action";
import { getBuildings, getMetersByBuilding } from '../../core/data_connecter/register';
import { searchBuildingEnergy } from '../../core/data_connecter/dashboard';
import { getWalletByEmail, getWalletBalance } from '../../core/data_connecter/wallet';
import { normalizeRoleName } from '../../utils/authSession';
import { ROUTE_PATHS } from '../../routes/routePaths';
import Key from '../../global/key';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatBuildingId = (id) => {
    if (id === null || id === undefined || id === '') return 'BLD-000';
    const raw = String(id).trim();
    if (/^BLD-/i.test(raw)) return raw.toUpperCase();
    return `BLD-${raw.padStart(3, '0')}`;
};

const toNumeric = (value) => {
    if (value === null || value === undefined) return 0;
    const parsed = Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatLastReading = (value) => {
    if (!value) return 'No reading yet';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const extractTokenBalance = (response) => {
    const payload = response?.data ?? response ?? {};
    const raw =
        payload?.tokenBalance ??
        payload?.balance ??
        payload?.wallet?.tokenBalance ??
        payload?.wallet?.balance ??
        0;
    return Math.round(toNumeric(raw));
};

const loadWalletBalanceSafe = async ({ email, walletId }) => {
    const normalizedEmail = (email || '').toString().trim().toLowerCase();

    if (normalizedEmail) {
        try {
            const wres = await getWalletByEmail(normalizedEmail);
            return extractTokenBalance(wres);
        } catch (err) {
            console.warn('getWalletByEmail failed, fallback to walletId', err);
        }
    }

    if (walletId !== null && walletId !== undefined && walletId !== '') {
        try {
            const bres = await getWalletBalance(String(walletId));
            return extractTokenBalance(bres);
        } catch (err) {
            console.warn('getWalletBalance fallback failed', err);
        }
    }

    return 0;
};

// Mock data for building details
const getMockBuildingData = (buildingId) => {
    return {
        id: 'BLD-042',
        name: 'Ratchaphruek Building',
        campus: 'Main Campus',
        zone: 'Comprehensive Energy Overview',
        status: 'Active',
        address: '123 Ratchaphruek Road',
        location: 'Bangkok, 10300, Thailand',
        email: 'ratchaphruek@lems.com',
        phone: '+66 2 123 4567',
        capacity: '10,000',
        registeredDate: 'Jan 2024',
        serviceUnits: '3',
        connectivity: '3/3',
        connectedStatus: 'Online',
        lastCheck: '2min ago',
        ageUpdatedUnits: '3 Service Units',
        // Energy Overview
        production: {
            value: 1650,
            unit: 'kWh',
            status: 'generated',
            color: 'green',
            maxValue: 15000
        },
        consumption: {
            value: 1245,
            unit: 'kWh',
            status: 'consumed',
            color: 'red',
            maxValue: 10000
        },
        storage: {
            value: 425,
            unit: 'kWh',
            status: 'stored',
            color: 'orange',
            maxValue: 2000
        },
        // Service Units
        serviceUnitsList: [
            {
                id: 'MTR-042-PRD',
                type: 'Producer',
                typeId: 'Type 01',
                icon: '🔋',
                color: 'green',
                location: 'Rooftop & Carport',
                subLocation: 'Solar PV System',
                status: 'Online',
                lastReading: '2 min ago',
                totalKWh: '1,650 kWh',
                value: 'Readable'
            },
            {
                id: 'MTR-042-CON',
                type: 'Consumer',
                typeId: 'Type 02',
                icon: '⚡',
                color: 'red',
                location: 'All Floors & Facilities',
                subLocation: 'Building-wide usage',
                status: 'Online',
                lastReading: '1 min ago',
                totalKWh: '1,245 kWh',
                value: 'Readable'
            },
            {
                id: 'MTR-042-BAT',
                type: 'Battery / ESS',
                typeId: 'Type 03',
                icon: '🔋',
                color: 'orange',
                location: 'Basement Storage',
                subLocation: 'Energy Storage System',
                status: 'Online',
                lastReading: '3 min ago',
                totalKWh: '425 kWh',
                value: 'Readable (75%SOC)'
            }
        ],
        pendingRequests: 0,
        pendingMessage: ''
    };
};

export default function Building() {
    const { buildingId } = useParams();
    const history = useHistory();
    const location = useLocation();
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const memberStore = useSelector((store) => store.member.all);
    const [building, setBuilding] = useState(null);
    const [serviceUnitsList, setServiceUnitsList] = useState([]);
    const [productionToday, setProductionToday] = useState(0);
    const [consumptionToday, setConsumptionToday] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [walletBalance, setWalletBalance] = useState(0);
    const [notFound, setNotFound] = useState(false);

    const member = useMemo(() => {
        if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
        if (memberStore && typeof memberStore === 'object') return memberStore;
        return null;
    }, [memberStore]);

    const roleName = useMemo(() => {
        if (member) return normalizeRoleName(member);
        return String(localStorage.getItem(Key.UserRole) || '').trim().toUpperCase() || 'USER';
    }, [member]);

    const memberEmail = useMemo(() => {
        return String(member?.email || localStorage.getItem(Key.UserEmail) || '').toLowerCase();
    }, [member?.email]);

    const isUserRole = roleName === 'USER' || roleName === 'CONSUMER';

    // Store the last viewed building in localStorage
    useEffect(() => {
        if (buildingId) {
            localStorage.setItem('lastViewedBuilding', buildingId);
        }
    }, [buildingId]);

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        // Support old links that passed BLD-codes. If buildingId looks like a code, map to a name and replace URL.
        const mapCodeToName = (code) => {
            const mapping = {
                'BLD-042': 'ratchaphruek',
                'BLD-001': 'navamin',
                'BLD-002': 'naradhip',
                'BLD-003': 'nidasumpan',
                'BLD-004': 'chup',
                'BLD-005': 'malai',
                'BLD-006': 'nida house',
                'BLD-007': 'bunchana',
                'BLD-008': 'siam',
                'BLD-009': 'auditorium',
                'BLD-010': 'serithai'
            };
            return mapping[code] || null;
        };

        const init = async () => {
            try {
                let nameParam = buildingId;
                if (/^BLD-/i.test(buildingId)) {
                    const mapped = mapCodeToName(buildingId.toUpperCase());
                    if (mapped) {
                        // update URL to use building name
                        const slug = mapped.toLowerCase();
                        history.replace(`/building/${slug}`);
                        nameParam = slug;
                    }
                }

                // Load building from backend only
                let buildings = [];
                try {
                    const bres = await getBuildings();
                    buildings = Array.isArray(bres) ? bres : (bres?.data || bres?.buildings || []);
                } catch (err) {
                    buildings = [];
                }

                let data = null;
                if (buildings && buildings.length) {
                    const assignedBuilding = buildings.find((item) => String(item?.email || '').toLowerCase() === memberEmail) || null;
                    if (isUserRole && !assignedBuilding) {
                        history.replace(ROUTE_PATHS.noBuildingAssigned);
                        return;
                    }

                    const found = buildings.find(b => (b.name || '').toString().toLowerCase() === (nameParam || '').toString().toLowerCase());
                    if (isUserRole && assignedBuilding && found && String(found?.email || '').toLowerCase() !== memberEmail) {
                        history.replace(ROUTE_PATHS.noBuildingAssigned);
                        return;
                    }

                    if (found) {
                        data = {
                            id: formatBuildingId(found.id),
                            name: found.name,
                            campus: found.campus || 'Main Campus',
                            zone: found.zone || 'Overview',
                            status: found.status || 'Active',
                            address: found.address || found.mapURL || '',
                            location: found.province || '',
                            email: found.email || '',
                            phone: found.phone || '',
                            capacity: found.capacity || 'N/A',
                            registeredDate: found.createdAt ? new Date(found.createdAt).toLocaleDateString() : 'N/A',
                            serviceUnits: 0,
                            connectivity: '0/0',
                            connectedStatus: 'Unknown',
                            lastCheck: 'N/A',
                            ageUpdatedUnits: '0 Service Units',
                            production: { value: 0, unit: 'kWh', status: 'generated', color: 'green', maxValue: 1 },
                            consumption: { value: 0, unit: 'kWh', status: 'consumed', color: 'red', maxValue: 1 },
                            storage: { value: 0, unit: 'kWh', status: 'stored', color: 'orange', maxValue: 1 },
                            serviceUnitsList: []
                        };

                        setBuilding(data);

                        // load meters for this building (use DB id)
                        try {
                            const metersRes = await getMetersByBuilding(found.id);
                            const meters = Array.isArray(metersRes) ? metersRes : (metersRes?.data || []);
                            const meterTypeOf = (m) => (m?.type || '').toString().toLowerCase();
                            const isProduce = (m) => meterTypeOf(m).includes('produce');
                            const isConsume = (m) => meterTypeOf(m).includes('consume');
                            const isBattery = (m) => meterTypeOf(m).includes('battery');
                            const units = (meters || []).map(m => ({
                                id: m.snid || m.meterName || m.id,
                                type: isProduce(m) ? 'Producer' : (isConsume(m) ? 'Consumer' : (isBattery(m) ? 'Battery / ESS' : 'Meter')),
                                typeId: m.meterType || 'Type 01',
                                icon: isProduce(m) ? '🌤️' : (isConsume(m) ? '⚡' : '🔋'),
                                color: isProduce(m) ? 'green' : (isConsume(m) ? 'red' : 'orange'),
                                location: m.location || data.name,
                                subLocation: m.subLocation || m.buildingName || data.name,
                                status: m.approveStatus || 'approved',
                                lastReading: formatLastReading(m.timestamp || m.lastReading),
                                totalKWh: m.totalKWh ? `${m.totalKWh} kWh` : '0 kWh',
                                value: m.value || ''
                            }));
                            const approvedMeters = (meters || []).filter((m) =>
                                String(m.approveStatus || '').toLowerCase() === 'approved'
                            );
                            const pendingRequests = (meters || []).filter((m) =>
                                String(m.approveStatus || '').toLowerCase() === 'pending'
                            ).length;
                            const totalCapacity = (meters || []).reduce((sum, m) => sum + toNumeric(m?.capacity), 0);
                            const batteryMeter = (meters || []).find(m => isBattery(m));
                            const storageValue = toNumeric(batteryMeter?.value ?? batteryMeter?.kwh ?? 0);
                            const storageMaxRaw = toNumeric(batteryMeter?.capacity ?? 0);
                            const storageMax = storageMaxRaw > 0 ? storageMaxRaw : Math.max(1, storageValue || 1);

                            setServiceUnitsList(units);
                            setBuilding({
                                ...data,
                                serviceUnits: units.length,
                                connectivity: `${approvedMeters.length}/${units.length}`,
                                connectedStatus: approvedMeters.length > 0
                                    ? (approvedMeters.length === units.length ? 'All Approved' : `${approvedMeters.length} Approved`)
                                    : 'No approved meter',
                                lastCheck: approvedMeters.length > 0
                                    ? formatLastReading(
                                        approvedMeters
                                            .map((m) => m.timestamp || m.lastReading)
                                            .filter(Boolean)
                                            .sort((a, b) => new Date(b || 0) - new Date(a || 0))[0]
                                      )
                                    : 'No approved reading',
                                capacity: totalCapacity > 0 ? totalCapacity.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A',
                                pendingRequests,
                                pendingMessage: pendingRequests > 0
                                    ? `${pendingRequests} meter change request${pendingRequests > 1 ? 's are' : ' is'} currently pending your approval`
                                    : '',
                                storage: {
                                    ...data.storage,
                                    value: Math.round(storageValue),
                                    maxValue: storageMax,
                                }
                            });
                        
                            // load today's energy aggregates for this building
                            loadTodayEnergy(found.name || nameParam);
                            // Load wallet token by email and fallback to walletId/building id.
                            const balance = await loadWalletBalanceSafe({
                                email: found.email,
                                walletId: found.id,
                            });
                            setWalletBalance(balance);
                        } catch (err) {
                            console.warn('Failed to load meters for building', err);
                        }

                        setNotFound(false);
                        return;
                    }
                }

                setNotFound(true);
                setBuilding(null);
                setServiceUnitsList([]);
                setWalletBalance(0);

            } catch (err) {
                console.error('init building error', err);
                setNotFound(true);
                setBuilding(null);
                setServiceUnitsList([]);
                setWalletBalance(0);
            }
        };

        init();
    }, [buildingId, history, isUserRole, memberEmail]);

    // Reload wallet balance when returning to this page
    useEffect(() => {
        const loadWalletBalance = async () => {
            const balance = await loadWalletBalanceSafe({
                email: building?.email,
                walletId: building?.id,
            });
            setWalletBalance(balance);
        };
        
        loadWalletBalance();
    }, [location.key, building?.email, building?.id]);

    async function loadTodayEnergy(buildingName, dateParam) {
        try {
            if (!buildingName) return;
            // normalize
            let bname = buildingName.toString().toLowerCase();
            if (bname === 'nidasumpan') bname = 'nidasumpun';
            if (bname === 'narathip') bname = 'naradhip';

            const d = dateParam ? new Date(dateParam) : selectedDate || new Date();
            const start = formatDateLocal(d);
            const end = formatDateLocal(d);

            const res = await searchBuildingEnergy({
                building: bname,
                start,
                end,
                timeunit: 'hour'
            });

            const payload = res?.data || {};
            if (payload.result !== 'success') {
                setConsumptionToday(0);
                setProductionToday(0);
                return;
            }

            const consumption = payload.consumption || { value: [] };
            const production = payload.production || { value: [] };
            const totalC = (consumption.value || []).reduce((s, v) => s + Number(v || 0), 0);
            const totalP = (production.value || []).reduce((s, v) => s + Number(v || 0), 0);

            setConsumptionToday(Math.round(totalC));
            setProductionToday(Math.round(totalP));

        } catch (err) {
            console.error('loadTodayEnergy error', err);
        }
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
                    <div className="text-xl font-semibold text-gray-900">Building not found</div>
                    <div className="mt-2 text-sm text-gray-500">No live building record matches this URL.</div>
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

    if (!building) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    const storageValueNum = Number(building?.storage?.value || 0);
    const storageCapNum = Number(building?.storage?.maxValue || 0);
    const storagePercent = storageCapNum > 0 ? (storageValueNum / storageCapNum) * 100 : 0;
    const totalFlow = Math.max(1, Number(productionToday || 0) + Number(consumptionToday || 0));
    const productionRate = Math.max(0, Math.min(100, Math.round((Number(productionToday || 0) / totalFlow) * 100)));
    const consumptionRate = Math.max(0, Math.min(100, Math.round((Number(consumptionToday || 0) / totalFlow) * 100)));
    const storagePercentLabel = storagePercent > 0 && storagePercent < 1
        ? storagePercent.toFixed(2)
        : Math.round(storagePercent).toString();
    const storageRatioLabel = `${Math.round(storageValueNum)} / ${Math.round(storageCapNum || 0)} kWh`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header and Building Title */}
                <div className="mb-6 flex items-center gap-4">
                    <button 
                        className="hidden"
                    >
                        <span className="text-xl">←</span>
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">{building.name}</h1>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                                {formatBuildingId(building.id)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{building.campus} - {building.zone}</p>
                    </div>
                        <div className="flex items-center gap-3">
                        <div className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-sm font-semibold flex items-center gap-2">
                            <span>📅</span>
                            <DatePicker
                                selected={selectedDate}
                                onChange={(date) => { setSelectedDate(date); loadTodayEnergy(building?.name || buildingId, date); }}
                                dateFormat="MMM d, yyyy"
                                maxDate={new Date()}
                            />
                        </div>
                        <button
                            onClick={() => history.push(`/wallet/${encodeURIComponent((building?.name || buildingId || '').toString().toLowerCase())}`)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <span>💰</span>
                            <span>{walletBalance ?? 0} Token</span>
                        </button>
                    </div>
                </div>

                {/* Pending Meter Change Requests Alert */}
                {building.pendingRequests > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900">Pending Meter Change Requests</h3>
                                <p className="text-sm text-gray-600">{building.pendingMessage}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => history.push('/approved-request')}
                            className="px-6 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                        >
                            📋 View Approvals
                        </button>
                    </div>
                )}

                <div className="flex gap-6 mb-6">
                    {/* Left Column: Building Information */}
                    <div className="w-1/2">
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <span className="text-2xl">🏢</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Building Information</h2>
                                    <p className="text-sm text-gray-600">General details and configuration</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Building ID and Campus Row */}
                                <div className="relative">
                                    {/* Building ID */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">🎫</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-gray-600 mb-1">Building ID</div>
                                            <div className="font-bold text-gray-900">{formatBuildingId(building.id)}</div>
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${building.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                                <span className="text-xs text-gray-600">{building.status}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Campus */}
                                    <div className="absolute top-0 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">🏫</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Campus</div>
                                            <div className="font-bold text-gray-900">{building.campus}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Physical Address */}
                                <div className="flex items-start gap-3 pt-3 border-t border-gray-100">
                                    <span className="text-lg">📍</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-600 mb-1">Physical Address</div>
                                        <div className="font-bold text-gray-900">{building.address}</div>
                                        <div className="text-sm text-gray-600">{building.location}</div>
                                    </div>
                                </div>

                                {/* Contact Information Header */}
                                <div className="pt-4 border-t-2 border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-3">Contact Information</h3>
                                </div>

                                {/* Email and Phone Row */}
                                <div className="relative">
                                    {/* Email */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">📧</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Email</div>
                                            <div className="font-bold text-gray-900">{building.email}</div>
                                        </div>
                                    </div>

                                    {/* Phone */}
                                    <div className="absolute top-0 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">📞</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Phone</div>
                                            <div className="font-bold text-gray-900">{building.phone}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Technical Specifications Header */}
                                <div className="pt-4 border-t-2 border-gray-200">
                                    <h3 className="font-bold text-gray-900 mb-3">Technical Specifications</h3>
                                </div>

                                {/* Capacity and Registered Row */}
                                <div className="relative">
                                    {/* Capacity */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">⚡</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Capacity</div>
                                            <div className="font-bold text-gray-900">{building.capacity} kWh</div>
                                        </div>
                                    </div>

                                    {/* Registered */}
                                    <div className="absolute top-0 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">📅</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Registered</div>
                                            <div className="font-bold text-gray-900">{building.registeredDate}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Service Units and Meter Connectivity Row */}
                                <div className="relative pt-3 border-t border-gray-100">
                                    {/* Service Units */}
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg">🔧</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Service Units</div>
                                            <div className="font-bold text-gray-900">{building.serviceUnits} units</div>
                                            <div className="text-xs text-gray-600">(renewable meters)</div>
                                        </div>
                                    </div>

                                    {/* Meter Connectivity */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">📡</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Meter Connectivity</div>
                                            <div className="font-bold text-green-600 text-lg mb-1">{building.connectivity}</div>
                                            <div className="text-xs text-gray-600 mb-2">{building.connectedStatus}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Energy Overview and Service Units */}
                    <div className="w-1/2 space-y-6">
                        {/* Energy Overview Dashboard */}
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                            <div className="mb-6">
                                <h2 className="text-lg font-bold text-gray-900 mb-1">Energy Overview Dashboard</h2>
                                <p className="text-sm text-gray-600">Real-time energy metrics for today</p>
                            </div>

                            <div className="flex gap-4">
                                {/* Production */}
                                <div className="w-1/3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">🌤️</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-green-700 font-semibold">Production</div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-green-700 mb-1">{productionToday}</div>
                                                <div className="text-xs text-green-600 mb-3">{building.production.unit} {building.production.status}</div>
                                    <div className="bg-white rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500 rounded-full transition-all"
                                            style={{ width: `${(productionToday / (building.production.maxValue || Math.max(1, productionToday))) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-green-600 mt-1 flex justify-between">
                                        <span>● Rate</span>
                                        <span>{productionRate}%</span>
                                    </div>
                                </div>

                                {/* Consumption */}
                                <div className="w-1/3 bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">⚡</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-red-700 font-semibold">Consumption</div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-red-700 mb-1">{consumptionToday}</div>
                                    <div className="text-xs text-red-600 mb-3">{building.consumption.unit} {building.consumption.status}</div>
                                    <div className="bg-white rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-red-500 rounded-full transition-all"
                                            style={{ width: `${(consumptionToday / (building.consumption.maxValue || Math.max(1, consumptionToday))) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-red-600 mt-1 flex justify-between">
                                        <span>● Rate</span>
                                        <span>{consumptionRate}%</span>
                                    </div>
                                </div>

                                {/* Storage */}
                                <div className="w-1/3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-2xl">🔋</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-orange-700 font-semibold">Storage</div>
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-orange-700 mb-1">{building.storage.value}</div>
                                    <div className="text-xs text-orange-600 mb-3">{building.storage.unit} {building.storage.status}</div>
                                    <div className="bg-white rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-orange-500 rounded-full transition-all"
                                            style={{ width: `${Math.max(0, Math.min(100, storagePercent))}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1 flex justify-between">
                                        <span>● Orange</span>
                                        <span>{storagePercentLabel}%</span>
                                    </div>
                                    <div className="text-[11px] text-orange-700 mt-1">
                                        {storageRatioLabel}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assigned Service Units */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Assigned Service Units</h2>
                                        <p className="text-sm text-gray-600">Aggregated meters registered to this building</p>
                                    </div>
                                    <button className="text-gray-600 hover:text-gray-900">
                                        <span className="text-xl">📄</span>
                                    </button>
                                </div>
                            </div>

                            {/* List Header */}
                            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="text-xs font-semibold text-gray-600 flex-1">Meter ID</div>
                                    <div className="text-xs font-semibold text-gray-600 flex-1">Service Unit Type</div>
                                    <div className="text-xs font-semibold text-gray-600 flex-1">Location</div>
                                    <div className="text-xs font-semibold text-gray-600 w-24">Status</div>
                                    <div className="text-xs font-semibold text-gray-600 w-32 text-right">Last Reading</div>
                                    <div className="text-xs font-semibold text-gray-600 w-24 text-right">Total (kWh)</div>
                                    <div className="text-xs font-semibold text-gray-600 w-16 text-right">Action</div>
                                </div>
                            </div>

                            {/* List Body */}
                            <div className="divide-y divide-gray-200">
                                {(serviceUnitsList.length ? serviceUnitsList : building.serviceUnitsList || []).map((unit, index) => (
                                    <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            {/* Meter ID */}
                                            <div className="flex-1 flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                                                    unit.color === 'green' ? 'bg-green-100' :
                                                    unit.color === 'red' ? 'bg-red-100' : 'bg-orange-100'
                                                }`}>
                                                    {unit.icon}
                                                </div>
                                                <div className="text-sm font-bold text-blue-600">{unit.id}</div>
                                            </div>

                                            {/* Service Unit Type */}
                                            <div className="flex-1">
                                                <div className="text-sm font-semibold text-gray-900">{unit.type}</div>
                                                <div className="text-xs text-gray-600">Type: {unit.typeId.split(' ')[1]}</div>
                                            </div>

                                            {/* Location */}
                                            <div className="flex-1">
                                                <div className="text-sm text-gray-900">{unit.location}</div>
                                                <div className="text-xs text-gray-500">{unit.subLocation}</div>
                                            </div>

                                            {/* Status */}
                                            <div className="w-24">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                    {unit.status}
                                                </span>
                                            </div>

                                            {/* Last Reading */}
                                            <div className="w-32 text-right">
                                                <div className="text-sm text-gray-900">{unit.lastReading}</div>
                                                <div className="text-xs text-gray-500">{unit.lastReading}</div>
                                            </div>

                                            {/* Total (kWh) */}
                                            <div className="w-24 text-right">
                                                <div className="text-sm font-semibold text-gray-900">{unit.totalKWh}</div>
                                                <div className="text-xs text-gray-500">{unit.value}</div>
                                            </div>

                                            {/* Action */}
                                            <div className="w-16 text-right">
                                                <button 
                                                    onClick={() => history.push(`/meter/${unit.id}`)}
                                                    className="text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 justify-end">
                                                    <span>👁️</span>
                                                    <span>View</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer */}
                            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
                                <div className="text-sm text-gray-600">
                                    Showing <span className="font-semibold">3</span> service units 
                                    <span className="ml-4">
                                        <span className="inline-flex items-center gap-1 text-xs">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span> 3 P
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs ml-3">
                                            <span className="w-2 h-2 bg-red-500 rounded-full"></span> 1 C
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-xs ml-3">
                                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span> 1 B
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end">
                    <button 
                        onClick={() => history.push('/utility')}
                        className="hidden"
                    >
                        <span>←</span>
                        <span>Back to Buildings</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📥</span>
                            <span>Export Report</span>
                        </button>
                        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>📊</span>
                            <span>View Analytics</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

