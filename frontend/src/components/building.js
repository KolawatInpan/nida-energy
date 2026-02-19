import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import { validateAuth } from "../store/auth/auth.action";

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
        pendingRequests: 2,
        pendingMessage: '2 meter change requests are currently pending your approval'
    };
};

export default function Building() {
    const { buildingId } = useParams();
    const history = useHistory();
    const dispatch = useDispatch();
    const authStore = useSelector((store) => store.auth.isAuthenticate);
    const [building, setBuilding] = useState(null);

    useEffect(() => {
        dispatch(validateAuth());
    }, []);

    useEffect(() => {
        // Simulate fetching building data
        const data = getMockBuildingData(buildingId);
        setBuilding(data);
    }, [buildingId]);

    if (!building) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header with Back Button and Building Title */}
                <div className="mb-6 flex items-center gap-4">
                    <button 
                        onClick={() => history.push('/utility')}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <span className="text-xl">←</span>
                    </button>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-gray-900">{building.name}</h1>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-semibold">
                                {building.id}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600">{building.campus} - {building.zone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <span>📅</span>
                            <span>Today</span>
                            <span className="text-gray-500">Nov 26, 2025</span>
                            <span className="text-gray-400">▼</span>
                        </button>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2">
                            <span>💰</span>
                            <span>40,000 Token</span>
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
                        <button className="px-6 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors">
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
                                            <div className="font-bold text-gray-900">{building.id}</div>
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
                                    <div className="text-3xl font-bold text-green-700 mb-1">{building.production.value}</div>
                                    <div className="text-xs text-green-600 mb-3">{building.production.unit} {building.production.status}</div>
                                    <div className="bg-white rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-green-500 rounded-full transition-all"
                                            style={{ width: `${(building.production.value / building.production.maxValue) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-green-600 mt-1 flex justify-between">
                                        <span>● Rate</span>
                                        <span>{Math.round((building.production.value / building.production.maxValue) * 100)}%</span>
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
                                    <div className="text-3xl font-bold text-red-700 mb-1">{building.consumption.value}</div>
                                    <div className="text-xs text-red-600 mb-3">{building.consumption.unit} {building.consumption.status}</div>
                                    <div className="bg-white rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-red-500 rounded-full transition-all"
                                            style={{ width: `${(building.consumption.value / building.consumption.maxValue) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-red-600 mt-1 flex justify-between">
                                        <span>● Rate</span>
                                        <span>{Math.round((building.consumption.value / building.consumption.maxValue) * 100)}%</span>
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
                                            style={{ width: `${(building.storage.value / building.storage.maxValue) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1 flex justify-between">
                                        <span>● Orange</span>
                                        <span>{Math.round((building.storage.value / building.storage.maxValue) * 100)}%</span>
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
                                {building.serviceUnitsList.map((unit, index) => (
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
                <div className="flex items-center justify-between">
                    <button 
                        onClick={() => history.push('/utility')}
                        className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
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
