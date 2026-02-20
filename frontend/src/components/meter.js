import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../store/auth/auth.action";

// Mock data for meter details
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
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const [meter, setMeter] = useState(null);

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        // Simulate fetching meter data
        const data = getMockMeterData(meterId);
        setMeter(data);
    }, [meterId]);

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
                {/* Header with Back Button and Meter Title */}
                <div className="mb-6 flex items-center gap-4">
                    <button 
                        onClick={() => history.push(`/building/${meter.buildingId}`)}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <span className="text-xl">←</span>
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">{meter.name}</h1>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                                {meter.id}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{meter.building} - {meter.location}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📊</span>
                            <span>Analytics</span>
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>🔧</span>
                            <span>Settings</span>
                        </button>
                    </div>
                </div>

                {/* Today's Production and Meter Connectivity */}
                <div className="flex gap-6 mb-6">
                    {/* Production Card */}
                    <div className="flex-1 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-3xl">🌤️</span>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Today's Production</h2>
                                <p className="text-sm text-gray-600">Real-time meter data for current shift</p>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="text-5xl font-bold text-green-600 mb-1">{meter.lastReadingValue}</div>
                            <div className="text-sm text-gray-600 mb-3">kWh {meter.type === 'Producer' ? 'generated' : meter.type === 'Consumer' ? 'consumed' : 'stored'} today</div>
                            <div className="text-xs text-green-600 mb-3">↑ 95% of target</div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <div className="text-xs text-gray-600 mb-1">Daily Target</div>
                                <div className="text-lg font-bold text-gray-900">1,800 kWh</div>
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-600 mb-1">Peak Output</div>
                                <div className="text-lg font-bold text-gray-900">7.5 kW</div>
                            </div>
                            <div className="flex-1">
                                <div className="text-xs text-gray-600 mb-1">Efficiency</div>
                                <div className="text-lg font-bold text-green-600">96.2%</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-full h-2 overflow-hidden mt-4">
                            <div 
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `95%` }}
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
                        <h2 className="text-lg font-bold text-gray-900 mb-1">Real-time Production Trend</h2>
                        <p className="text-sm text-gray-600">Energy generation in kWh over 24 hours</p>
                    </div>

                    {/* Simple line chart visualization */}
                    <div className="relative h-64 bg-gradient-to-b from-green-50 to-transparent rounded-lg p-4">
                        <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="xMidYMid meet">
                            {/* Y-axis labels */}
                            <text x="5" y="20" className="text-xs fill-gray-400">30</text>
                            <text x="5" y="60" className="text-xs fill-gray-400">20</text>
                            <text x="5" y="100" className="text-xs fill-gray-400">10</text>
                            <text x="5" y="140" className="text-xs fill-gray-400">0</text>

                            {/* Grid lines */}
                            <line x1="30" y1="20" x2="800" y2="20" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="60" x2="800" y2="60" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="100" x2="800" y2="100" stroke="#e5e7eb" strokeWidth="1"/>
                            <line x1="30" y1="140" x2="800" y2="140" stroke="#e5e7eb" strokeWidth="1"/>

                            {/* Curved line chart */}
                            <path 
                                d="M 30 100 Q 80 80, 130 60 T 230 40 T 330 50 T 430 70 T 530 90 T 630 85 T 730 110 T 800 140"
                                stroke="#22c55e"
                                strokeWidth="3"
                                fill="none"
                            />

                            {/* X-axis labels */}
                            <text x="30" y="160" className="text-xs fill-gray-400">00:00</text>
                            <text x="130" y="160" className="text-xs fill-gray-400">06:00</text>
                            <text x="230" y="160" className="text-xs fill-gray-400">12:00</text>
                            <text x="330" y="160" className="text-xs fill-gray-400">18:00</text>
                            <text x="430" y="160" className="text-xs fill-gray-400">06:00</text>
                            <text x="530" y="160" className="text-xs fill-gray-400">07:00</text>
                            <text x="630" y="160" className="text-xs fill-gray-400">08:00</text>
                            <text x="700" y="160" className="text-xs fill-gray-400">20:00</text>
                            <text x="780" y="160" className="text-xs fill-gray-400">23:00</text>
                        </svg>
                    </div>

                    {/* Chart controls */}
                    <div className="flex justify-end gap-2 mt-4">
                        <button className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold hover:bg-green-200 transition-colors">Today</button>
                        <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors">Week</button>
                        <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-semibold hover:bg-gray-200 transition-colors">Month</button>
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
                                        <div className="font-bold text-gray-900">{meter.id}</div>
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
                                            <div className="font-bold text-gray-900">8.5 kW</div>
                                        </div>
                                    </div>

                                    {/* Device Count */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">📊</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Device Count</div>
                                            <div className="font-bold text-gray-900">28 units</div>
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
                                            <div className="font-bold text-gray-900">Jan 2024</div>
                                        </div>
                                    </div>

                                    {/* Warranty */}
                                    <div className="absolute top-3 left-1/2 right-0 flex items-start gap-3">
                                        <span className="text-lg">🛡️</span>
                                        <div className="flex-1">
                                            <div className="text-xs text-gray-600 mb-1">Warranty</div>
                                            <div className="font-bold text-gray-900">25 years</div>
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
                                    <h2 className="text-lg font-bold text-gray-900">Performance Metrics</h2>
                                    <p className="text-sm text-gray-600">Current operational statistics</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {meter.type === 'Producer' && (
                                    <>
                                        {/* Current Output */}
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-blue-600 mb-1">💡 Current Output</div>
                                                    <div className="text-2xl font-bold text-blue-600">6.8 kW</div>
                                                    <div className="text-xs text-blue-600">50% of capacity</div>
                                                </div>
                                                <span className="text-blue-600">📊</span>
                                            </div>
                                        </div>

                                        {/* This Month */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">🌱 This Month</div>
                                                <div className="text-xl font-bold text-green-600">48,600</div>
                                                <div className="text-xs text-green-600">kWh generated</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">📊 This Year</div>
                                                <div className="text-xl font-bold text-purple-600">542,800</div>
                                                <div className="text-xs text-purple-600">kWh generated</div>
                                            </div>
                                        </div>

                                        {/* Environmental Impact */}
                                        <div className="bg-gradient-to-r from-green-50 to-orange-50 rounded-lg p-4 border border-green-200">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-green-600 mb-1">🌍 Environmental Impact</div>
                                                    <div className="text-xl font-bold text-green-600">825 kg</div>
                                                    <div className="text-xs text-green-600">Trees Equivalent</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-orange-600 mb-1">🍃 CO₂ Offset</div>
                                                    <div className="text-xl font-bold text-orange-600">35 trees</div>
                                                    <div className="text-xs text-orange-600">Planted equivalent</div>
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
                                {meter.type === 'Consumer' && (
                                    <>
                                        {/* Current Consumption */}
                                        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-red-600 mb-1">⚡ Current Consumption</div>
                                                    <div className="text-2xl font-bold text-red-600">4.2 kW</div>
                                                    <div className="text-xs text-red-600">Peak demand</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Usage Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">📊 This Month</div>
                                                <div className="text-xl font-bold text-green-600">32,000</div>
                                                <div className="text-xs text-green-600">kWh used</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">📈 This Year</div>
                                                <div className="text-xl font-bold text-purple-600">385,000</div>
                                                <div className="text-xs text-purple-600">kWh used</div>
                                            </div>
                                        </div>

                                        {/* Efficiency Rating */}
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <div className="text-xs text-blue-600 mb-2">📊 Efficiency Rating</div>
                                            <div className="text-lg font-bold text-blue-600">92%</div>
                                            <div className="text-xs text-blue-600">Above average consumption</div>
                                        </div>
                                    </>
                                )}
                                {meter.type === 'Battery / ESS' && (
                                    <>
                                        {/* State of Charge */}
                                        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="text-xs text-orange-600 mb-1">🔋 State of Charge</div>
                                                    <div className="text-2xl font-bold text-orange-600">85%</div>
                                                    <div className="text-xs text-orange-600">425 kWh stored</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Health Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                                <div className="text-xs text-green-600 mb-1">💪 Health Status</div>
                                                <div className="text-xl font-bold text-green-600">98%</div>
                                                <div className="text-xs text-green-600">Excellent condition</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                                <div className="text-xs text-purple-600 mb-1">♻️ Cycle Count</div>
                                                <div className="text-xl font-bold text-purple-600">1,245</div>
                                                <div className="text-xs text-purple-600">Cycles completed</div>
                                            </div>
                                        </div>

                                        {/* Charge/Discharge */}
                                        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-green-600 mb-1">⬆️ Charge Rate</div>
                                                    <div className="text-lg font-bold text-green-600">50 kW</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-blue-600 mb-1">⬇️ Discharge</div>
                                                    <div className="text-lg font-bold text-blue-600">60 kW</div>
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
                        onClick={() => history.push(`/building/${meter.buildingId}`)}
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                        <span>←</span>
                        <span>Back</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <button className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📊</span>
                            <span>View Charts</span>
                        </button>
                        <button className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>⬇️</span>
                            <span>Export Data</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
