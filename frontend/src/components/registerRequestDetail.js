import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';

// Mock detailed data for a registration request
const getMockRequestDetail = (id) => {
    return {
        // Header Information
        requestId: id,
        submittedDate: '2025-11-15',
        submittedTime: '10:30 AM',
        serviceUnitType: 'Producer',
        currentStatus: 'Pending Review',

        // Contact Information
        contactName: 'Somchai Phairot',
        contactPosition: 'Building Manager',
        contactEmail: 'somchai@university.ac.th',
        contactPhone: '095-123-4567',

        // Building Information
        buildingName: 'Ratchaphruek Building',
        buildingCode: 'BLDG-RPK-001',
        zone: 'Academic Zone A',
        floorArea: '12,500 sq.m',
        address: '148 Pattanakarn Road, Suanluang, Bangkok 10250, Thailand',

        // Meter Specifications
        meterServiceType: 'Solar Energy Production Meter',
        meterId: 'MTR-2025-001',
        meterBrand: 'Siemens PAC4200',
        meterCapacity: '500 kWH',
        installationDate: '2025-10-01',
        warrantyPeriod: '5 years (until 2030-10-01)',

        // Terms & Conditions Agreement
        termsAgreed: [
            {
                title: 'Data Privacy Policy',
                description: 'Applicant has read and agreed to the data privacy policy terms',
                agreedAt: 'Nov 26, 2025 at 09:10:05'
            },
            {
                title: 'Service Level Agreement',
                description: 'Applicant acknowledges the service level agreement and expectations',
                agreedAt: 'Nov 26, 2025 at 09:10:12'
            },
            {
                title: 'Billing Terms & Conditions',
                description: 'Applicant accepts the token-based prepaid billing mechanism',
                agreedAt: 'Nov 26, 2025 at 09:10:18'
            },
            {
                title: 'Blockchain Data Recording Consent',
                description: 'Applicant consents to transaction recording on blockchain',
                agreedAt: 'Nov 26, 2025 at 09:10:25'
            }
        ],

        // Submission Information
        submissionDate: 'November 26, 2025',
        submissionTime: '09:12:33',
        ipAddress: '172.16.25.88',
    };
};

function InfoRow({ label, value }) {
    return (
        <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b border-gray-100 last:border-0">
            <div className="text-sm font-semibold text-gray-700">{label}:</div>
            <div className="text-sm text-gray-900">{value}</div>
        </div>
    );
}

function SectionCard({ title, icon, children }) {
    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>{icon}</span>
                    <span>{title}</span>
                </h3>
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );
}

export default function RegisterRequestDetail() {
    const { id } = useParams();
    const history = useHistory();
    const [request, setRequest] = useState(null);

    useEffect(() => {
        // Simulate fetching data
        const data = getMockRequestDetail(id);
        setRequest(data);
    }, [id]);

    if (!request) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch(status.toLowerCase()) {
            case 'approved': return 'bg-green-100 text-green-700 border-green-300';
            case 'rejected': return 'bg-red-100 text-red-700 border-red-300';
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case 'pending review': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-5xl mx-auto">
                {/* Back Button */}
                <button 
                    onClick={() => history.push('/building-request')}
                    className="mb-4 px-4 py-2 text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2 transition-colors"
                >
                    <span>←</span>
                    <span>Back to Requests</span>
                </button>

                {/* Page Title */}
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    Building Registration Request Details
                </h1>

                {/* Pending Review Banner */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-yellow-600 text-xl">⏱</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 mb-1">Pending Review</h2>
                                <p className="text-sm text-gray-600">This request is awaiting your approval decision</p>
                            </div>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                            <button className="px-5 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                                <span>✖</span>
                                <span>Reject Request</span>
                            </button>
                            <button className="px-5 py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                                <span>✓</span>
                                <span>Approve Request</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Header Cards */}
                <div className="flex gap-3 mb-6">
                    {/* Request ID Card */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 flex-1">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-xl font-bold">#</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600 mb-1">Request ID</div>
                                <div className="text-lg font-bold text-gray-900">{request.requestId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Submitted Date Card */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 flex-1">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-indigo-600 text-xl">📅</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600 mb-1">Submitted Date</div>
                                <div className="text-lg font-bold text-gray-900">{request.submittedDate}</div>
                                <div className="text-xs text-gray-500">{request.submittedTime}</div>
                            </div>
                        </div>
                    </div>

                    {/* Service Unit Type Card */}
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 flex-1">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-purple-600 text-xl">🎫</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-600 mb-1">Service Unit Type</div>
                                <div className="text-lg font-bold text-gray-900">{request.serviceUnitType}</div>
                                <div className="text-xs text-gray-500">
                                    {request.serviceUnitType === 'Producer' && 'Energy Production System'}
                                    {request.serviceUnitType === 'Consumer' && 'Energy Consumption System'}
                                    {request.serviceUnitType === 'Battery' && 'Energy Storage System'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">👤</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Contact Information</h3>
                                <p className="text-sm text-gray-600">Person responsible for this registration</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex">
                            {/* Left Column */}
                            <div className="w-1/2 pr-8 space-y-6">
                                {/* Full Name */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Full Name</div>
                                    <div className="text-base font-bold text-gray-900">{request.contactName}</div>
                                </div>
                                {/* Email Address */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Email Address</div>
                                    <div className="text-base text-gray-900 flex items-center gap-2">
                                        <span className="text-gray-500">✉</span>
                                        <span>{request.contactEmail}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Right Column */}
                            <div className="w-1/2 pl-8 space-y-6">
                                {/* Position */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Position</div>
                                    <div className="text-base font-bold text-gray-900">{request.contactPosition}</div>
                                </div>
                                {/* Phone Number */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Phone Number</div>
                                    <div className="text-base text-gray-900 flex items-center gap-2">
                                        <span className="text-gray-500">📞</span>
                                        <span>{request.contactPhone}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Building Information */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">🏢</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Building Information</h3>
                                <p className="text-sm text-gray-600">Details about the building facility</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        {/* First Row - Two Columns */}
                        <div className="flex mb-6">
                            {/* Left Column */}
                            <div className="w-1/2 pr-8 space-y-6">
                                {/* Building Name */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Building Name</div>
                                    <div className="text-base font-bold text-gray-900">{request.buildingName}</div>
                                </div>
                                {/* Zone */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Zone</div>
                                    <div className="text-base text-gray-900 flex items-center gap-2">
                                        <span className="text-gray-500">📍</span>
                                        <span>{request.zone}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Right Column */}
                            <div className="w-1/2 pl-8 space-y-6">
                                {/* Building Code */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Building Code</div>
                                    <div className="text-base font-bold text-gray-900">{request.buildingCode}</div>
                                </div>
                                {/* Floor Area */}
                                <div>
                                    <div className="text-sm text-gray-600 mb-2">Floor Area</div>
                                    <div className="text-base text-gray-900 flex items-center gap-2">
                                        <span className="text-gray-500">🏗</span>
                                        <span>{request.floorArea}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Second Row - Full Width Address */}
                        <div className="pt-6 border-t border-gray-200">
                            <div className="text-sm text-gray-600 mb-2">Complete Address</div>
                            <div className="text-base text-gray-900 flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                                <span className="text-gray-500">📍</span>
                                <span>{request.address}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Meter Specifications */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">⚡</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Meter Specifications</h3>
                                <p className="text-sm text-gray-600">Technical details and meter information</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex gap-4">
                            {/* First Column */}
                            <div className="w-1/3 flex flex-col gap-4">
                                {/* Service Unit Type */}
                                <div className="h-32 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Service Unit Type</div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-blue-600">🎫</span>
                                        <span className="text-base font-bold text-gray-900">{request.serviceUnitType}</span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {request.serviceUnitType === 'Producer' && 'Energy Production System'}
                                        {request.serviceUnitType === 'Consumer' && 'Energy Consumption System'}
                                        {request.serviceUnitType === 'Battery' && 'Energy Storage System'}
                                    </div>
                                </div>
                                {/* Storage Capacity */}
                                <div className="h-32 bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Storage Capacity</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterCapacity}</div>
                                </div>
                            </div>

                            {/* Second Column */}
                            <div className="w-1/3 flex flex-col gap-4">
                                {/* Meter SNID */}
                                <div className="h-32 bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Meter SNID</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterId}</div>
                                </div>
                                {/* Installation Date */}
                                <div className="h-32 bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Installation Date</div>
                                    <div className="text-base font-bold text-gray-900">{request.installationDate}</div>
                                </div>
                            </div>

                            {/* Third Column */}
                            <div className="w-1/3 flex flex-col gap-4">
                                {/* Meter Brand */}
                                <div className="h-32 bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Meter Brand</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterBrand}</div>
                                </div>
                                {/* Warranty Period */}
                                <div className="h-32 bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Warranty Period</div>
                                    <div className="text-base font-bold text-gray-900">{request.warrantyPeriod}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Terms & Conditions Agreement */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📋</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Terms & Conditions Agreement</h3>
                                <p className="text-sm text-gray-600">Legal agreements accepted by the applicant</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {request.termsAgreed.map((term, index) => (
                                <div key={index} className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                            <span className="text-white text-lg">✓</span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-base font-bold text-gray-900 mb-1">{term.title}</h4>
                                        <p className="text-sm text-gray-600 mb-2">{term.description}</p>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <span>🕐</span>
                                            <span>Agreed on {term.agreedAt}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Submission Information */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">ℹ️</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Submission Information</h3>
                                <p className="text-sm text-gray-600">Technical details about the submission</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="flex gap-4">
                            {/* Submitted Date */}
                            <div className="w-1/4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Submitted Date</div>
                                    <div className="text-base font-bold text-gray-900">{request.submissionDate}</div>
                                </div>
                            </div>

                            {/* Submitted Time */}
                            <div className="w-1/4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Submitted Time</div>
                                    <div className="text-base font-bold text-gray-900">{request.submissionTime}</div>
                                </div>
                            </div>

                            {/* IP Address */}
                            <div className="w-1/4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">IP Address</div>
                                    <div className="text-base font-bold text-gray-900">{request.ipAddress}</div>
                                </div>
                            </div>

                            {/* Current Status */}
                            <div className="w-1/4">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-sm text-gray-600 mb-2">Current Status</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getStatusColor(request.currentStatus)}`}>
                                            ⏱ {request.currentStatus}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decision Section */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-2xl">💡</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Ready to make a decision?</h3>
                                <p className="text-sm text-gray-600">Review all information carefully before approving or rejecting this request</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => {/* Handle reject */}}
                                className="px-6 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                            >
                                <span>✕</span>
                                <span>Reject Request</span>
                            </button>
                            <button 
                                onClick={() => {/* Handle approve */}}
                                className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                            >
                                <span>✓</span>
                                <span>Approve Request</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Back to List Button */}
                <div className="flex justify-start">
                    <button 
                        onClick={() => history.push('/building-request')}
                        className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        ← Back to List
                    </button>
                </div>
            </div>
        </div>
    );
}
