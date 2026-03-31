import React, { useState, useEffect } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { Modal, message } from 'antd';
import { getPendingMeters, getUserFromBuilding, updateMeter } from '../../core/data_connecter/meter';

const getString = (value) => {
    if (value === null || value === undefined) return '';
    return String(value);
};

const normalizeType = (rawType) => {
    const value = String(rawType || '').toLowerCase();
    if (value.includes('produce')) return 'Producer';
    if (value.includes('consume')) return 'Consumer';
    if (value.includes('battery')) return 'Battery';
    return rawType || 'Unknown';
};

export default function RegisterRequestDetail() {
    const { id } = useParams();
    const history = useHistory();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadDetail = async () => {
            setLoading(true);
            try {
                const pending = await getPendingMeters();
                const list = Array.isArray(pending) ? pending : [];
                const target = list.find((item) => {
                    const candidateId = getString(item.requestId || item.id || item._id || item.reqId || item.snid || item.meterName);
                    return candidateId === id;
                });

                if (!target) {
                    if (mounted) setRequest(null);
                    return;
                }

                const building = target.building || {};
                const owner = building.owner || {};
                let contactName = owner.name || '';
                let contactEmail = owner.email || target.email || '';

                if ((!contactName || !contactEmail) && building.id) {
                    try {
                        const users = await getUserFromBuilding(building.id);
                        const userList = Array.isArray(users) ? users : (users ? [users] : []);
                        const firstUser = userList.find((item) => item?.email) || userList[0];
                        if (firstUser) {
                            contactName = contactName || firstUser.name || '';
                            contactEmail = contactEmail || firstUser.email || '';
                        }
                    } catch (error) {
                        console.warn('Unable to load request contact from building users:', error);
                    }
                }

                const submittedAt = target.dateSubmit ? new Date(target.dateSubmit) : null;
                const detail = {
                    requestId: getString(target.requestId || target.id || target._id || target.reqId || target.snid || target.meterName),
                    submittedDate: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.toLocaleDateString() : '-',
                    submittedTime: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                    serviceUnitType: normalizeType(target.type),
                    currentStatus: String(target.approveStatus || 'Pending Review'),
                    contactName: contactName || '-',
                    contactPosition: '-',
                    contactEmail: contactEmail || '-',
                    contactPhone: getString(target.contactPhone || target.telNum || owner.telNum || '-'),
                    buildingName: getString(building.name || target.buildingName || '-'),
                    buildingCode: building.id != null ? `BLD-${String(building.id).padStart(3, '0')}` : '-',
                    zone: getString(building.province || '-'),
                    floorArea: '-',
                    address: getString(building.address || '-'),
                    meterServiceType: normalizeType(target.type),
                    meterId: getString(target.snid || target.meterName || '-'),
                    meterBrand: '-',
                    meterCapacity: target.capacity != null ? `${target.capacity} kWh` : '-',
                    installationDate: target.dateInstalled ? new Date(target.dateInstalled).toLocaleDateString() : '-',
                    warrantyPeriod: '-',
                    termsAgreed: [],
                    submissionDate: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.toLocaleDateString() : '-',
                    submissionTime: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.toLocaleTimeString() : '-',
                    ipAddress: '-',
                };

                if (mounted) setRequest(detail);
            } catch (error) {
                console.error('Failed to load request detail:', error);
                if (mounted) setRequest(null);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadDetail();
        return () => { mounted = false; };
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f6f8] p-6 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    if (!request) {
        return (
            <div className="min-h-screen bg-[#f5f6f8] p-6 flex items-center justify-center">
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
                    <div className="text-lg font-semibold text-gray-900">Request not found</div>
                    <div className="mt-2 text-sm text-gray-500">No live pending registration request matches this identifier.</div>
                    <button
                        onClick={() => history.push('/approved-request')}
                        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        Back to Approvals
                    </button>
                </div>
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

    const handleDecision = async (nextStatus) => {
        if (!request?.meterId || actioning) return;
        const label = nextStatus === 'approved' ? 'approve' : 'reject';

        Modal.confirm({
            title: `${nextStatus === 'approved' ? 'Approve' : 'Reject'} Meter Request`,
            content: `Request ${request.requestId} for ${request.buildingName} will be marked as ${nextStatus}.`,
            okText: nextStatus === 'approved' ? 'Approve Request' : 'Reject Request',
            cancelText: 'Cancel',
            okButtonProps: {
                className: nextStatus === 'approved' ? '!bg-green-500 !border-green-500 hover:!bg-green-600' : '!bg-red-500 !border-red-500 hover:!bg-red-600'
            },
            centered: true,
            async onOk() {
                setActioning(true);
                try {
                    await updateMeter(request.meterId, { status: nextStatus });
                    message.success(`Request ${request.requestId} ${nextStatus === 'approved' ? 'approved' : 'rejected'} successfully.`);
                    history.push('/approved-request');
                } catch (error) {
                    console.error(`Failed to ${label} request`, error);
                    message.error(error?.response?.data?.error || `Unable to ${label} this request right now.`);
                    throw error;
                } finally {
                    setActioning(false);
                }
            },
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f6f8] p-5">
            <div className="max-w-6xl mx-auto">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={() => history.push('/approved-request')}
                            className="w-8 h-8 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 flex items-center justify-center"
                            aria-label="Back"
                        >
                            ←
                        </button>
                        <div>
                            <h1 className="text-[28px] leading-none font-bold text-gray-900">Registration Request Details</h1>
                            <p className="text-xs text-gray-500 mt-1">{request.requestId} • {request.buildingName}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2 text-right min-w-[140px]">
                            <div className="text-[10px] text-gray-500">Admin Treasury</div>
                            <div className="text-sm font-bold text-blue-700">50,000 Token</div>
                        </div>
                        <div className="text-right px-1 py-1">
                            <div className="text-[10px] text-gray-500">Today</div>
                            <div className="text-xs font-semibold text-gray-700">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>

                {/* Pending Review Banner */}
                <div className="bg-[#fbf8e7] border border-[#e9df98] rounded-xl p-4 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-yellow-700 text-xs">●</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900 mb-1">Pending Review</h2>
                                <p className="text-xs text-gray-600">This request is awaiting your approval decision</p>
                            </div>
                        </div>
                        <div className="hidden">
                            <button className="px-4 py-2 bg-red-500 text-white text-xs font-semibold rounded-md hover:bg-red-600 transition-colors flex items-center gap-2">
                                <span>✖</span>
                                <span>Reject Request</span>
                            </button>
                            <button className="px-4 py-2 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600 transition-colors flex items-center gap-2">
                                <span>✓</span>
                                <span>Approve Request</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Header Cards */}
                <div className="flex flex-nowrap gap-3 mb-4 overflow-x-auto">
                    {/* Request ID Card */}
                    <div className="flex-1 min-w-[200px] bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-sm font-bold">#</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Request ID</div>
                                <div className="text-xl font-bold text-gray-900">{request.requestId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Submitted Date Card */}
                    <div className="flex-1 min-w-[200px] bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-sm">📅</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Submitted Date</div>
                                <div className="text-xl font-bold text-gray-900">{request.submittedDate}</div>
                                <div className="text-[11px] text-gray-500">{request.submittedTime}</div>
                            </div>
                        </div>
                    </div>

                    {/* Service Unit Type Card */}
                    <div className="flex-1 min-w-[200px] bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-sm">🎫</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Service Unit Type</div>
                                <div className="text-xl font-bold text-gray-900">{request.serviceUnitType}</div>
                                <div className="text-[11px] text-gray-500">
                                    {request.serviceUnitType === 'Producer' && 'Energy Production System'}
                                    {request.serviceUnitType === 'Consumer' && 'Energy Consumption System'}
                                    {request.serviceUnitType === 'Battery' && 'Energy Storage System'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="mb-4 flex flex-col lg:flex-row lg:items-start gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:basis-1/2 lg:flex-1 min-w-0">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                                <span className="text-sm">👤</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Contact Information</h3>
                                <p className="text-[11px] text-gray-500">Person responsible for this registration</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 md:gap-x-0">
                            {/* Left Column */}
                            <div className="space-y-5 md:w-1/2">
                                {/* Full Name */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Full Name</div>
                                    <div className="text-base font-bold text-gray-900">{request.contactName}</div>
                                </div>
                                {/* Email Address */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Email Address</div>
                                    <div className="text-base text-gray-900 flex items-center gap-2">
                                        <span className="text-gray-500">✉</span>
                                        <span>{request.contactEmail}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Right Column */}
                            <div className="space-y-5 md:w-1/2 md:flex md:flex-col md:justify-center">
                                {/* Position */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Position</div>
                                    <div className="text-base font-bold text-gray-900">{request.contactPosition}</div>
                                </div>
                                {/* Phone Number */}
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Phone Number</div>
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden lg:basis-1/2 lg:flex-1 min-w-0">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                                <span className="text-sm">🏢</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Building Information</h3>
                                <p className="text-[11px] text-gray-500">Details about the building facility</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        {/* Four Columns Layout */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
                            {/* Building Name */}
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Building Name</div>
                                <div className="text-base font-bold text-gray-900">{request.buildingName}</div>
                            </div>
                            {/* Zone */}
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Zone</div>
                                <div className="text-base text-gray-900 flex items-center gap-2">
                                    <span className="text-gray-500">📍</span>
                                    <span>{request.zone}</span>
                                </div>
                            </div>
                            {/* Building Code */}
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Building Code</div>
                                <div className="text-base font-bold text-gray-900">{request.buildingCode}</div>
                            </div>
                            {/* Floor Area */}
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Floor Area</div>
                                <div className="text-base text-gray-900 flex items-center gap-2">
                                    <span className="text-gray-500">🏗</span>
                                    <span>{request.floorArea}</span>
                                </div>
                            </div>
                        </div>
                        {/* Second Row - Full Width Address */}
                        <div className="pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500 mb-2">Complete Address</div>
                            <div className="text-sm text-gray-900 flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                                <span className="text-gray-500">📍</span>
                                <span>{request.address}</span>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                {/* Meter Specifications */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                                <span className="text-sm">⚡</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Meter Specifications</h3>
                                <p className="text-[11px] text-gray-500">Technical details and meter information</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 overflow-x-auto">
                        <div className="flex flex-nowrap gap-4 min-w-[1200px]">
                            {/* First Column */}
                            <div className="contents">
                                {/* Service Unit Type */}
                                <div className="bg-[#edf4ff] border border-blue-200 rounded-lg p-4 flex-1 min-w-[190px]">
                                    <div className="text-xs text-gray-500 mb-2">Service Unit Type</div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-blue-600">🎫</span>
                                        <span className="text-base font-bold text-gray-900">{request.serviceUnitType}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-600">
                                        {request.serviceUnitType === 'Producer' && 'Energy Production System'}
                                        {request.serviceUnitType === 'Consumer' && 'Energy Consumption System'}
                                        {request.serviceUnitType === 'Battery' && 'Energy Storage System'}
                                    </div>
                                </div>
                                {/* Storage Capacity */}
                                <div className="bg-gray-50 rounded-lg p-4 flex-1 min-w-[170px]">
                                    <div className="text-xs text-gray-500 mb-2">Storage Capacity</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterCapacity}</div>
                                </div>
                            </div>

                            {/* Second Column */}
                            <div className="contents">
                                {/* Meter SNID */}
                                <div className="bg-gray-50 rounded-lg p-4 flex-1 min-w-[150px]">
                                    <div className="text-xs text-gray-500 mb-2">Meter SNID</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterId}</div>
                                </div>
                                {/* Installation Date */}
                                <div className="bg-gray-50 rounded-lg p-4 flex-1 min-w-[180px]">
                                    <div className="text-xs text-gray-500 mb-2">Installation Date</div>
                                    <div className="text-base font-bold text-gray-900">{request.installationDate}</div>
                                </div>
                            </div>

                            {/* Third Column */}
                            <div className="contents">
                                {/* Meter Brand */}
                                <div className="bg-gray-50 rounded-lg p-4 flex-1 min-w-[150px]">
                                    <div className="text-xs text-gray-500 mb-2">Meter Brand</div>
                                    <div className="text-base font-bold text-gray-900">{request.meterBrand}</div>
                                </div>
                                {/* Warranty Period */}
                                <div className="bg-gray-50 rounded-lg p-4 flex-1 min-w-[160px]">
                                    <div className="text-xs text-gray-500 mb-2">Warranty Period</div>
                                    <div className="text-base font-bold text-gray-900">{request.warrantyPeriod}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Terms & Conditions Agreement */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                                <span className="text-sm">📋</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Terms & Conditions Agreement</h3>
                                <p className="text-[11px] text-gray-500">Legal agreements accepted by the applicant</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="space-y-4">
                            {request.termsAgreed.length === 0 && (
                                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                                    No additional agreement records are stored for this request.
                                </div>
                            )}
                            {request.termsAgreed.map((term, index) => (
                                <div key={index} className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                                            <span className="text-white text-[10px]">✓</span>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-gray-900 mb-1">{term.title}</h4>
                                        <p className="text-xs text-gray-600 mb-2">{term.description}</p>
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                    <div className="border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                                <span className="text-sm">ℹ️</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Submission Information</h3>
                                <p className="text-[11px] text-gray-500">Technical details about the submission</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 overflow-x-auto">
                        <div className="flex flex-nowrap gap-3 min-w-[900px]">
                            {/* Submitted Date */}
                            <div className="flex-1 min-w-[170px]">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-xs text-gray-500 mb-2">Submitted Date</div>
                                    <div className="text-base font-bold text-gray-900">{request.submissionDate}</div>
                                </div>
                            </div>

                            {/* Submitted Time */}
                            <div className="flex-1 min-w-[170px]">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-xs text-gray-500 mb-2">Submitted Time</div>
                                    <div className="text-base font-bold text-gray-900">{request.submissionTime}</div>
                                </div>
                            </div>

                            {/* IP Address */}
                            <div className="flex-1 min-w-[170px]">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-xs text-gray-500 mb-2">IP Address</div>
                                    <div className="text-base font-bold text-gray-900">{request.ipAddress}</div>
                                </div>
                            </div>

                            {/* Current Status */}
                            <div className="flex-1 min-w-[190px]">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="text-xs text-gray-500 mb-2">Current Status</div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(request.currentStatus)}`}>
                                            ⏱ {request.currentStatus}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Decision Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-sm">💡</span>
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Ready to make a decision?</h3>
                                <p className="text-xs text-gray-600">Review all information carefully before approving or rejecting this request</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => handleDecision('rejected')}
                                disabled={actioning}
                                className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-md hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span>✕</span>
                                <span>Reject Request</span>
                            </button>
                            <button 
                                onClick={() => handleDecision('approved')}
                                disabled={actioning}
                                className="px-4 py-2 bg-green-500 text-white text-xs font-bold rounded-md hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span>✓</span>
                                <span>Approve Request</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="text-xs text-gray-400 py-2">© 2025 Local Energy Management System. All rights reserved.</div>
            </div>
        </div>
    );
}

