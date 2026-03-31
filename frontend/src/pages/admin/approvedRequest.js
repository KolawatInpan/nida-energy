import React, { useMemo, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Modal, message } from 'antd';
import { getPendingMeters, getUserFromBuilding, updateMeter } from '../../core/data_connecter/meter';
import { useTOR } from '../../global/TORContext';

function StatCard({ title, value, tag }) {
    return (
                <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[110px] shadow-sm flex-1 min-w-[220px]">
                        <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-gray-500">{title}</div>
                                {tag && (
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">
                                        {tag}
                                    </span>
                                )}
            </div>
                        <div className="text-4xl leading-none font-bold text-gray-900">{value}</div>
        </div>
    );
}

export default function BuildingRequest() {
    const history = useHistory();
    const { showTOR } = useTOR();
    const [q, setQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actioningId, setActioningId] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await getPendingMeters();
                const list = Array.isArray(res) ? res : [];
                const normalizeType = (rawType) => {
                    const v = getString(rawType).toLowerCase();
                    if (v.includes('produce')) return 'Producer';
                    if (v.includes('consume')) return 'Consumer';
                    if (v.includes('battery')) return 'Battery';
                    return getString(rawType) || 'Unknown';
                };
                const getString = (v) => {
                    if (!v && v !== 0) return '';
                    if (typeof v === 'string') return v;
                    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
                    if (Array.isArray(v)) return v.map(i => (i && i.name) ? i.name : String(i)).filter(Boolean).join(', ');
                    if (typeof v === 'object') return v.name || v.title || v.label || '';
                    return String(v);
                };

                const mapped = await Promise.all(list.map(async item => {
                    const rawBuilding = item.building || item.buildingName || item.name || item.site;
                    // detect building id if building is object or has id fields
                    const buildingId = (rawBuilding && typeof rawBuilding === 'object')
                        ? (rawBuilding.id || rawBuilding._id || rawBuilding._id_str || rawBuilding.buildingId)
                        : (item.buildingId || item.siteId || item.site || rawBuilding);

                    let contactVal = getString(item.contact || item.contactName || item.requester || (item.user && item.user.name));
                    let contactEmailVal = getString(item.contactEmail || item.email || item.requesterEmail || (item.user && item.user.email));

                    // If contact info missing, try to fetch users for the building
                    if ((!contactVal || !contactEmailVal) && buildingId) {
                        try {
                            const users = await getUserFromBuilding(buildingId);
                            const ulist = Array.isArray(users) ? users : (users ? [users] : []);
                            // Prefer admin/owner, then first with email
                            let found = ulist.find(u => u && u.role && /admin|owner/i.test(u.role));
                            if (!found) found = ulist.find(u => u && (u.email));
                            if (found) {
                                if (!contactVal) contactVal = getString(found.name);
                                if (!contactEmailVal) contactEmailVal = getString(found.email);
                            }
                        } catch (err) {
                            console.debug('getUserFromBuilding failed for', buildingId, err);
                        }
                    }

                    const requestId = getString(item.requestId || item.id || item._id || item.reqId || item.snid || item.meterName);

                    return {
                        id: requestId || '',
                        building: getString(rawBuilding),
                        contact: contactVal,
                        contactEmail: contactEmailVal,
                        contactPhone: getString(item.contactPhone || item.contactPhoneNumber || item.tel || item.phone),
                        // New schema uses string type (produce/consume/battery)
                        type: normalizeType(item.type || item.unitType || item.category),
                        meter: getString(item.meter || item.snid || item.sn || item.serial || item.meterId),
                        date: getString(item.dateSubmit)
                    };
                })).then((rows) => rows.filter((row) => row.id));
                if (!mounted) return;
                setRequests(mapped);
            } catch (err) {
                console.error('Error loading pending meters:', err);
                if (mounted) setRequests([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetch();
        return () => { mounted = false; };
    }, []);

    const filtered = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return requests.filter(r => {
            if (typeFilter !== 'all' && !r.type.toLowerCase().includes(typeFilter)) return false;
            if (!ql) return true;
            return (r.building + ' ' + r.id + ' ' + r.contact).toLowerCase().includes(ql);
        });
    }, [requests, q, typeFilter]);

    const getTypeColor = (type) => {
        switch(type.toLowerCase()) {
            case 'producer': return 'bg-green-50 text-green-600 border border-green-100';
            case 'consumer': return 'bg-red-50 text-red-500 border border-red-100';
            case 'battery': return 'bg-indigo-50 text-indigo-600 border border-indigo-100';
            default: return 'bg-gray-100 text-gray-700 border border-gray-200';
        }
    };

    const handleDecision = async (request, nextStatus) => {
        if (!request?.meter) return;
        const label = nextStatus === 'approved' ? 'approve' : 'reject';

        Modal.confirm({
            title: `${nextStatus === 'approved' ? 'Approve' : 'Reject'} Meter Request`,
            content: `Request ${request.id} will be marked as ${nextStatus}. This action will update the meter approval status immediately.`,
            okText: nextStatus === 'approved' ? 'Approve Request' : 'Reject Request',
            cancelText: 'Cancel',
            okButtonProps: {
                className: nextStatus === 'approved' ? '!bg-green-500 !border-green-500 hover:!bg-green-600' : '!bg-red-500 !border-red-500 hover:!bg-red-600'
            },
            centered: true,
            async onOk() {
                setActioningId(request.id);
                try {
                    await updateMeter(request.meter, { status: nextStatus });
                    setRequests((prev) => prev.filter((item) => item.id !== request.id));
                    message.success(`Request ${request.id} ${nextStatus === 'approved' ? 'approved' : 'rejected'} successfully.`);
                } catch (error) {
                    console.error(`Failed to ${label} request`, error);
                    message.error(error?.response?.data?.error || `Unable to ${label} this request right now.`);
                    throw error;
                } finally {
                    setActioningId('');
                }
            },
        });
    };

    return (
        <div className="min-h-screen bg-[#f5f6f8] p-5">
            <div className="max-w-6xl mx-auto">

                {/* TOR Requirements Panel */}
                {showTOR && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
                        <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <span>📋</span> TOR Requirements — Approval
                        </h2>
                        <div className="text-sm text-blue-900">
                            <span className="font-bold text-blue-700">1.2)</span>
                            <p className="mt-1 leading-relaxed">สามารถกำหนดรูปแบบขั้นการการอนุมัติขั้นตอนการขึ้นทะเบียนหน่วยบริการ</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Pending Meter Registration Approvals</h2>
                        <p className="text-xs text-gray-500">Review and approve meter registration requests</p>
                        {loading && <p className="text-xs text-blue-600 mt-1">Loading latest requests...</p>}
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500">Today</div>
                        <div className="text-xs font-semibold text-gray-700">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="mb-4 overflow-x-auto">
                    <div className="flex flex-nowrap gap-3 w-full min-w-[920px]">
                        <StatCard title="Total Requests" value={requests.length} tag="Total" />
                        <StatCard title="Producer Units" value={requests.filter(r => r.type.toLowerCase().includes('producer')).length} tag="Producer" />
                        <StatCard title="Consumer Units" value={requests.filter(r => r.type.toLowerCase().includes('consumer')).length} tag="Consumer" />
                        <StatCard title="Battery Units" value={requests.filter(r => r.type.toLowerCase().includes('battery')).length} tag="Battery" />
                    </div>
                </div>

                {/* Filter Section */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-gray-500 mb-2">Search by Building Name or Request ID</label>
                            <input 
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Search..." 
                                value={q} 
                                onChange={e=>setQ(e.target.value)} 
                            />
                        </div>
                        <div className="min-w-[220px]">
                            <label className="block text-xs font-semibold text-gray-500 mb-2">Filter by Service Unit Type</label>
                            <select 
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={typeFilter} 
                                onChange={e=>setTypeFilter(e.target.value)}
                            >
                                <option value="all">All Types</option>
                                <option value="producer">Producer</option>
                                <option value="consumer">Consumer</option>
                                <option value="battery">Battery</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Requests Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900">Pending Registration Requests</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Review detailed information and take action on pending requests</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[920px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Request ID</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Building Name</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Contact Person</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Service Unit Type</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Meter SNID</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 uppercase tracking-wide text-[10px]">Date Submitted</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-3 uppercase tracking-wide text-[10px] w-[190px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length > 0 ? filtered.map(r => (
                                    <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors align-top">
                                        <td className="py-3 px-4 font-semibold text-blue-600">{r.id}</td>
                                        <td className="py-3 px-4 text-gray-900 font-semibold">
                                            <div>{r.building}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="text-gray-900 font-medium">{r.contact || '-'}</div>
                                            <div className="text-[11px] text-gray-500">{r.contactEmail || '-'}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold ${getTypeColor(r.type)}`}>
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-700 font-medium">{r.meter}</td>
                                        <td className="py-3 px-4 text-gray-600">{r.date}</td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-1.5">
                                                <button 
                                                    onClick={() => history.push(`/approved-request/${r.id}`)}
                                                    className="px-2 py-1 bg-white border border-blue-200 text-blue-600 font-semibold rounded-md hover:bg-blue-50 transition-colors text-[10px] leading-tight w-[54px] h-6">
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDecision(r, 'approved')}
                                                    disabled={actioningId === r.id}
                                                    className="px-2 py-1 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600 transition-colors text-[10px] leading-tight w-[60px] h-6 disabled:opacity-60 disabled:cursor-not-allowed">
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleDecision(r, 'rejected')}
                                                    disabled={actioningId === r.id}
                                                    className="px-2 py-1 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 transition-colors text-[10px] leading-tight w-[56px] h-6 disabled:opacity-60 disabled:cursor-not-allowed">
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="py-8 px-4 text-center text-gray-500">
                                            No requests found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                            Showing <strong>{filtered.length}</strong> of <strong>{requests.length}</strong> requests
                        </div>
                        <div className="flex gap-2">
                            <button className="px-2 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors text-xs">
                                &lt; Previous
                            </button>
                            <button className="px-2 py-1 bg-blue-600 text-white rounded-md text-xs">1</button>
                            <button className="px-2 py-1 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 transition-colors text-xs">
                                Next &gt;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

