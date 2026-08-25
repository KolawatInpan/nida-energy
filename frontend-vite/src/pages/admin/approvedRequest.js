import React, { useMemo, useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Modal, message } from 'antd';
import { useSelector } from 'react-redux';
import { fmtDate } from '../../utils/dateFormat';
import { getPendingMeters, updateMeter } from '../../core/data_connecter/meter';
import { getPendingBuildings, approveBuilding, rejectBuilding, assignUserToBuilding } from '../../core/data_connecter/building';
import { getBuildings } from '../../core/data_connecter/register';
import { getPendingUsers, approveUser, rejectUser, getUsers } from '../../core/data_connecter/user';
import { useTOR } from '../../global/TORContext';
import { normalizeRoleName } from '../../utils/authSession';

const TABS = ['buildings', 'users', 'meters'];

function StatCard({ title, value, tag }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[110px] shadow-sm flex-1 min-w-[220px]">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-500">{title}</div>
                {tag && (
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-semibold border border-blue-100">{tag}</span>
                )}
            </div>
            <div className="text-4xl leading-none font-bold text-gray-900">{value}</div>
        </div>
    );
}

export default function BuildingRequest() {
    const history = useHistory();
    const { showTOR } = useTOR();
    const memberStore = useSelector((store) => store.member.all);
    const [tab, setTab] = useState('buildings');
    const [q, setQ] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [actioningId, setActioningId] = useState('');

    // Data per tab
    const [buildings, setBuildings] = useState([]);
    const [users, setUsers] = useState([]);
    const [meters, setMeters] = useState([]);
    // Assign modal
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignBuilding, setAssignBuilding] = useState(null);
    const [assignEmail, setAssignEmail] = useState('');
    const [allUsers, setAllUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [userBuildings, setUserBuildings] = useState({});
    const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

    const member = useMemo(() => {
        if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
        if (memberStore && typeof memberStore === 'object') return memberStore;
        return null;
    }, [memberStore]);
    const isAdmin = normalizeRoleName(member) === 'ADMIN';

    const fetchData = async () => {
        setLoading(true);
        try {
            const [b, u, m] = await Promise.all([
                getPendingBuildings().catch(() => []),
                getPendingUsers().catch(() => []),
                getPendingMeters().catch(() => []),
            ]);
            setBuildings(Array.isArray(b) ? b : []);
            setUsers(Array.isArray(u) ? u : []);
            setMeters(Array.isArray(m) ? m : []);
        } catch (err) {
            console.error('Error loading pending requests:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const normalizeMeterType = (rawType) => {
        const v = String(rawType || '').toLowerCase();
        if (v.includes('produce')) return 'Producer';
        if (v.includes('consume')) return 'Consumer';
        if (v.includes('battery')) return 'Battery';
        return rawType || 'Unknown';
    };

    const getMeterTypeColor = (type) => {
        const v = String(type || '').toLowerCase();
        if (v.includes('produce')) return 'bg-green-50 text-green-600';
        if (v.includes('consume')) return 'bg-red-50 text-red-500';
        if (v.includes('battery')) return 'bg-indigo-50 text-indigo-600';
        return 'bg-gray-100 text-gray-700';
    };

    const currentData = tab === 'buildings' ? buildings : tab === 'users' ? users : meters;
    const filtered = useMemo(() => {
        let rows = currentData;
        if (tab === 'meters' && typeFilter !== 'all') {
            rows = rows.filter(r => normalizeMeterType(r.type).toLowerCase().includes(typeFilter));
        }
        const ql = q.trim().toLowerCase();
        if (ql) {
            rows = rows.filter(r => {
                const searchStr = (r.name || r.email || r.id || r.snid || '').toLowerCase()
                    + ' ' + (r.owner?.name || r.owner?.email || r.contactEmail || '').toLowerCase();
                return searchStr.includes(ql);
            });
        }
        return rows;
    }, [currentData, q, typeFilter, tab]);

    const handleApprove = async (item) => {
        const id = item.id || item.email || item.snid;
        Modal.confirm({
            title: `Approve ${tab.slice(0, -1)}`,
            content: `Confirm approval of ${item.name || item.email || item.snid}?`,
            okText: 'Approve',
            okButtonProps: { className: '!bg-green-500 !border-green-500' },
            centered: true,
            async onOk() {
                setActioningId(id);
                try {
                    if (tab === 'buildings') await approveBuilding(item.id);
                    else if (tab === 'users') await approveUser(item.email);
                    else await updateMeter(item.snid, { status: 'approved' });
                    message.success('Approved');
                    fetchData();
                } catch (e) {
                    message.error(e?.response?.data?.error || 'Failed');
                } finally { setActioningId(''); }
            },
        });
    };

    const handleReject = async (item) => {
        const id = item.id || item.email || item.snid;
        Modal.confirm({
            title: `Reject ${tab.slice(0, -1)}`,
            content: `Confirm rejection of ${item.name || item.email || item.snid}?`,
            okText: 'Reject',
            okButtonProps: { className: '!bg-red-500 !border-red-500' },
            centered: true,
            async onOk() {
                setActioningId(id);
                try {
                    if (tab === 'buildings') await rejectBuilding(item.id);
                    else if (tab === 'users') await rejectUser(item.email);
                    else await updateMeter(item.snid, { status: 'rejected' });
                    message.success('Rejected');
                    fetchData();
                } catch (e) {
                    message.error(e?.response?.data?.error || 'Failed');
                } finally { setActioningId(''); }
            },
        });
    };

    const openAssignModal = async (building) => {
        setAssignBuilding(building);
        setAssignEmail('');
        setUserSearch('');
        setShowUnassignedOnly(false);
        try {
            const [u, blds] = await Promise.all([getUsers(), getBuildings(true)]);
            const users = Array.isArray(u?.data) ? u.data : Array.isArray(u) ? u : [];
            const buildings = Array.isArray(blds?.data) ? blds.data : Array.isArray(blds) ? blds : [];
            
            const ubMap = {};
            buildings.forEach(b => {
                if (b.owner?.email) {
                    if (!ubMap[b.owner.email]) ubMap[b.owner.email] = [];
                    ubMap[b.owner.email].push(b.name);
                }
            });
            setUserBuildings(ubMap);
            
            setAllUsers(users.filter(x => x.status === 'approved').map(x => ({
                label: `${x.name || 'No Name'} (${x.email || ''})`,
                email: x.email,
                name: x.name,
                buildings: ubMap[x.email] || [],
            })));
        } catch { setAllUsers([]); setUserBuildings({}); }
        setAssignModalOpen(true);
    };

    const handleAssign = async () => {
        if (!assignEmail || !assignBuilding) return;
        setActioningId(assignBuilding.id);
        try {
            await assignUserToBuilding(assignBuilding.id, assignEmail, 'owner');
            message.success(`User assigned to ${assignBuilding.name}`);
            setAssignModalOpen(false);
            fetchData();
        } catch (e) {
            message.error(e?.response?.data?.error || 'Assignment failed');
        } finally { setActioningId(''); }
    };

    return (
        <div className="min-h-screen bg-[#f5f6f8] p-5">
            <div className="max-w-6xl mx-auto">
                {showTOR && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
                        <h2 className="text-sm font-bold text-blue-800 mb-3">📋 TOR — Unified Approval</h2>
                        <p className="text-sm text-blue-900">1.2) Multi-tier approval: Buildings → Users → Meters</p>
                    </div>
                )}

                <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Pending Registration Approvals</h2>
                        <p className="text-xs text-gray-500">Review and approve building, user & meter registrations</p>
                        {loading && <p className="text-xs text-blue-600 mt-1">Loading...</p>}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200">
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition ${tab === t ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {t === 'buildings' ? '🏢' : t === 'users' ? '👥' : '🔌'} {t} ({t === 'buildings' ? buildings.length : t === 'users' ? users.length : meters.length})
                        </button>
                    ))}
                </div>

                {/* Stats Row */}
                <div className="mb-4 overflow-x-auto">
                    <div className="flex flex-nowrap gap-3">
                        <StatCard title="🏢 Pending Buildings" value={buildings.length} tag="Buildings" />
                        <StatCard title="👥 Pending Users" value={users.length} tag="Users" />
                        <StatCard title="🔌 Pending Meters" value={meters.length} tag="Meters" />
                        {tab === 'meters' && (
                            <>
                                <StatCard title="☀️ Producer" value={meters.filter(r => normalizeMeterType(r.type).toLowerCase().includes('producer')).length} tag="Producer" />
                                <StatCard title="⚡ Consumer" value={meters.filter(r => normalizeMeterType(r.type).toLowerCase().includes('consumer')).length} tag="Consumer" />
                                <StatCard title="🔋 Battery" value={meters.filter(r => normalizeMeterType(r.type).toLowerCase().includes('battery')).length} tag="Battery" />
                            </>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center flex-wrap gap-2">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 capitalize">Pending {tab}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{filtered.length} request(s)</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48" placeholder="Search..."
                                value={q} onChange={e => setQ(e.target.value)} />
                            {tab === 'meters' && (
                                <select className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm"
                                    value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                    <option value="all">All Types</option>
                                    <option value="producer">Producer</option>
                                    <option value="consumer">Consumer</option>
                                    <option value="battery">Battery</option>
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">ID/Name</th>
                                    {tab === 'buildings' && <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">Address</th>}
                                    {tab === 'users' && <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">Role</th>}
                                    {tab === 'meters' && (
                                        <>
                                            <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">Building</th>
                                            <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">Type</th>
                                        </>
                                    )}
                                    <th className="text-left font-semibold text-gray-500 py-3 px-4 text-[10px]">Submitted</th>
                                    <th className="text-left font-semibold text-gray-500 py-3 px-3 text-[10px] w-[280px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length > 0 ? filtered.map((r, i) => (
                                    <tr key={r.id || r.email || r.snid || i} className="border-b border-gray-100 hover:bg-blue-50/40">
                                        <td className="py-3 px-4 font-semibold text-blue-600">
                                            {tab === 'users' ? (
                                                <><div>{r.name || '-'}</div><div className="text-[11px] text-gray-500">{r.email}</div></>
                                            ) : (r.name || r.snid || r.id)}
                                        </td>
                                        {tab === 'buildings' && <td className="py-3 px-4 text-gray-700">{r.address || r.province || '-'}</td>}
                                        {tab === 'users' && <td className="py-3 px-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-semibold">{r.role || 'USER'}</span></td>}
                                        {tab === 'meters' && (
                                            <>
                                                <td className="py-3 px-4 text-gray-700">{typeof r.building === 'object' ? r.building?.name : r.building || '-'}</td>
                                                <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getMeterTypeColor(r.type)}`}>{normalizeMeterType(r.type)}</span></td>
                                            </>
                                        )}
                                        <td className="py-3 px-4 text-gray-500">{r.createdAt ? fmtDate(new Date(r.createdAt)) : '-'}</td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-1.5">
                                                {tab === 'buildings' && (
                                                    <button onClick={() => history.push(`/approved-request/building/${r.id}`)}
                                                        className="px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-[10px] font-semibold">View</button>
                                                )}
                                                {tab === 'users' && (
                                                    <button onClick={() => history.push(`/approved-request/user/${r.credId || r.email}`)}
                                                        className="px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-[10px] font-semibold">View</button>
                                                )}
                                                {tab === 'meters' && (
                                                    <button onClick={() => history.push(`/approved-request/meter/${r.snid || r.id}`)}
                                                        className="px-2 py-1 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-[10px] font-semibold">View</button>
                                                )}
                                                <button onClick={() => handleApprove(r)} disabled={actioningId === (r.id || r.email || r.snid)}
                                                    className="px-2 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 text-[10px] font-semibold disabled:opacity-60">Approve</button>
                                                <button onClick={() => handleReject(r)} disabled={actioningId === (r.id || r.email || r.snid)}
                                                    className="px-2 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-[10px] font-semibold disabled:opacity-60">Reject</button>
                                                {tab === 'buildings' && (
                                                    <button onClick={() => openAssignModal(r)}
                                                        className="px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-[10px] font-semibold">Assign User</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="6" className="py-8 text-center text-gray-500">No pending {tab}</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Assign User Modal */}
                <Modal title={`Assign User to ${assignBuilding?.name || ''}`} open={assignModalOpen}
                    onOk={handleAssign} onCancel={() => setAssignModalOpen(false)}
                    okText="Assign" okButtonProps={{ className: '!bg-blue-600', loading: !!actioningId, disabled: !assignEmail }}>
                    <div className="py-2">
                        <label className="text-sm font-semibold text-gray-700 mb-2 block">Select User</label>
                        <div className="flex items-center gap-2 mb-2">
                            <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                placeholder="Search user..." value={userSearch}
                                onChange={e => setUserSearch(e.target.value)} />
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={showUnassignedOnly}
                                    onChange={e => setShowUnassignedOnly(e.target.checked)}
                                    className="rounded"
                                />
                                Unassigned only
                            </label>
                        </div>
                        <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto">
                            {allUsers
                                .filter(u => !userSearch || (u.label || '').toLowerCase().includes(userSearch.toLowerCase()))
                                .filter(u => !showUnassignedOnly || u.buildings.length === 0)
                                .map(u => (
                                <div key={u.email}
                                    onClick={() => { setAssignEmail(u.email); setUserSearch(u.label); }}
                                    className={`px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm ${assignEmail === u.email ? 'bg-blue-100 font-semibold' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span>👤</span>
                                        <span>{u.label}</span>
                                    </div>
                                    {u.buildings.length > 0 && (
                                        <div className="ml-6 mt-0.5 text-xs text-gray-400">
                                            🏢 {u.buildings.join(', ')}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {allUsers.length === 0 && (
                                <div className="px-3 py-4 text-sm text-gray-400 text-center">Loading users...</div>
                            )}
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}

