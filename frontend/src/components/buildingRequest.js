import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

function StatCard({ title, value, tag }) {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 w-72 h-full min-w-0 min-h-[120px]">
            <div className="text-sm font-medium text-gray-600 mb-2 min-h-[28px]">
                {title}
                {tag && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {tag}
                  </span>
                )}
            </div>
            <div className="text-3xl font-bold text-gray-900">{value}</div>
        </div>
    );
}


// Mock data for display
const mockRequests = [
    { id: 'REQ-001', building: 'Ratchaphruek Building', contact: 'Somchai Phairot', contactEmail: 'somchai@university.ac.th', contactPhone: '095-123-4567', type: 'Producer', meter: 'MTR-2025-001', date: '2025-11-15 10:30 AM' },
    { id: 'REQ-002', building: 'Malai Building', contact: 'Niran Kumthorn', contactEmail: 'niran@university.ac.th', contactPhone: '081-456-7890', type: 'Consumer', meter: 'MTR-2025-002', date: '2025-11-14 14:22 PM' },
    { id: 'REQ-003', building: 'Engineering Center', contact: 'Pranom Sontai', contactEmail: 'pranom@university.ac.th', contactPhone: '089-789-1234', type: 'Battery', meter: 'MTR-2025-003', date: '2025-11-13 09:15 AM' },
    { id: 'REQ-004', building: 'Science Building', contact: 'Duangchai Promsan', contactEmail: 'duangchai@university.ac.th', contactPhone: '092-345-6789', type: 'Consumer', meter: 'MTR-2025-004', date: '2025-11-12 16:45 PM' },
    { id: 'REQ-005', building: 'Library Complex', contact: 'Somsak Wipanon', contactEmail: 'somsak@university.ac.th', contactPhone: '086-234-5678', type: 'Producer', meter: 'MTR-2025-005', date: '2025-11-11 11:30 AM' },
];

export default function BuildingRequest() {
    const history = useHistory();
    const [q, setQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [requests, setRequests] = useState(mockRequests);

    const filtered = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return requests.filter(r => {
            if (typeFilter !== 'all' && r.type.toLowerCase() !== typeFilter) return false;
            if (!ql) return true;
            return (r.building + ' ' + r.id + ' ' + r.contact).toLowerCase().includes(ql);
        });
    }, [requests, q, typeFilter]);

    const getTypeColor = (type) => {
        switch(type.toLowerCase()) {
            case 'producer': return 'bg-green-100 text-green-700';
            case 'consumer': return 'bg-blue-100 text-blue-700';
            case 'battery': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Building Registration Requests</h2>
                    {/* <p className="text-gray-600">Manage and review pending building registration requests in the LEMS network. Review each request and approve or reject accordingly.</p> */}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-4 mb-6 items-stretch w-fit mx-auto">
                    <StatCard title="🧾 Total Requests" value={requests.length} />
                    <StatCard title="🌞 Producer Units" value={requests.filter(r=>r.type==='Producer').length} />
                    <StatCard title="🏠 Consumer Units" value={requests.filter(r=>r.type==='Consumer').length} />
                    <StatCard title="🔋 Battery Units" value={requests.filter(r=>r.type==='Battery').length} />
                </div>

                {/* Filter Section */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">🔎 Search</label>
                            <input 
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Search by Building Name, Request ID, or Contact" 
                                value={q} 
                                onChange={e=>setQ(e.target.value)} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">🧰 Filter by Type</label>
                            <select 
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900">Pending Registration Requests</h3>
                    </div>

                    <div className="overflow-x-hidden">
                        <table className="w-full text-xs table-fixed">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-300">
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Request ID</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Building Name</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Contact Person</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Unit Type</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Meter SNID</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Date Submitted</th>
                                    <th className="text-left font-semibold text-gray-900 py-2 px-4 whitespace-normal break-words">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length > 0 ? filtered.map(r => (
                                    <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                        <td className="py-2 px-4 font-medium text-gray-900 whitespace-normal break-words">{r.id}</td>
                                        <td className="py-2 px-4 text-gray-900 whitespace-normal break-words">{r.building}</td>
                                        <td className="py-2 px-4 whitespace-normal break-words">
                                            <div className="text-gray-900">{r.contact}</div>
                                            <div className="text-[11px] text-gray-500">{r.contactEmail}</div>
                                        </td>
                                        <td className="py-2 px-4 whitespace-normal break-words">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(r.type)}`}>
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-gray-900 whitespace-normal break-words">{r.meter}</td>
                                        <td className="py-2 px-4 text-gray-600 whitespace-normal break-words">{r.date}</td>
                                        <td className="py-2 px-4 pr-4 whitespace-normal break-words">
                                            <div className="grid grid-cols-[88px_minmax(120px,1fr)] gap-2 items-start">
                                                <button 
                                                    onClick={() => history.push(`/building-request/${r.id}`)}
                                                    className="px-2 py-1 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-colors text-[11px]">
                                                    View
                                                </button>
                                                <div className="flex flex-col gap-2 items-start">
                                                    <button className="px-2 py-1 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition-colors text-[11px] w-24">
                                                        Approve
                                                    </button>
                                                    <button className="px-2 py-1 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 transition-colors text-[11px] w-24">
                                                        Reject
                                                    </button>
                                                </div>
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
                    <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Showing <strong>{filtered.length}</strong> of <strong>{requests.length}</strong> requests
                        </div>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm">
                                &lt; Previous
                            </button>
                            <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm">1</button>
                            <button className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm">
                                Next &gt;
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
