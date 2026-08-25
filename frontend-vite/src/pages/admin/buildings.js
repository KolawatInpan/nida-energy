import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, message } from 'antd';
import { deleteBuilding, getBuildings as getBldsFromBuilding, getTotalMeters, updateBuilding, assignUserToBuilding } from '../../core/data_connecter/building';
import { getUsers } from '../../core/data_connecter/user';
import { formatEntityId } from '../../utils/formatters';

const slugify = (name) => String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
const normalizeStatus = (value) => String(value || 'ACTIVE').trim().toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
const getSortIndicator = (key, sortConfig) => {
  if (sortConfig.key !== key) return '↕';
  return sortConfig.direction === 'asc' ? '↑' : '↓';
};

const shellClass = 'min-h-screen bg-slate-50 px-6 py-8';
const panelClass = 'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
const tableHeadButtonClass = 'inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:text-slate-700';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';
const primaryButtonClass = 'rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800';
const secondaryButtonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50';
const dangerButtonClass = 'rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600';

const statusBadgeClass = (status) => (
  normalizeStatus(status) === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
);

const Buildings = () => {
  const [buildings, setBuildings] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [actioningId, setActioningId] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignBuilding, setAssignBuilding] = useState(null);
  const [assignEmail, setAssignEmail] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const list = await getBldsFromBuilding(true);
        const items = Array.isArray(list) ? list : (list?.buildings || list || []);
        const counts = await Promise.all(items.map(async (building) => {
          try {
            return await getTotalMeters(building.id);
          } catch (error) {
            return building.totalMeter || 0;
          }
        }));
        const normalized = items.map((building, index) => ({
          id: building.id || building.name,
          name: building.name || '-',
          contact: building.owner?.name ? `${building.owner.name} (${building.owner.email || building.email})` : (building.owner ? building.email : '—'),
          contactEmail: building.owner?.email || '—',
          totalMeter: counts[index] ?? (building.meters ? building.meters.length : building.totalMeter || 0),
          status: normalizeStatus(building.status),
          approvalStatus: building.approvalStatus || 'approved',  // pending | approved | rejected
        }));
        setBuildings(normalized);
      } catch (error) {
        console.error('getBuildings error', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleEdit = (buildingId) => {
    const target = buildings.find((item) => item.id === buildingId);
    if (!target) return;
    setEditingRow(buildingId);
    setEditData({ ...target });
  };

  const handleSave = async (buildingId) => {
    try {
      const payload = { approvalStatus: editData.approvalStatus };
      if (editData.id !== undefined && editData.id !== buildingId) {
        payload.id = parseInt(editData.id, 10);
        if (Number.isNaN(payload.id)) delete payload.id;
      }
      const updated = await updateBuilding(buildingId, payload);

      setBuildings((prev) => prev.map((item) => (
        item.id === buildingId
          ? { ...item, id: payload.id || item.id, approvalStatus: updated?.approvalStatus || editData.approvalStatus }
          : item
      )));
      setEditingRow(null);
      setEditData({});
      message.success('Building updated');
    } catch (error) {
      console.error('Failed to update building:', error);
      message.error(error?.response?.data?.error || 'Failed to update building');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (buildingId, buildingName) => {
    const name = buildingName || `Building #${buildingId}`;
    if (!window.confirm(`Delete "${name}"?\n\nThis will permanently remove all data including meters, energy records, wallet, transactions, and invoices.`)) return;

    try {
      // Try force delete first (removes ALL related data)
      await deleteBuilding(buildingId, true);
      setBuildings((prev) => prev.filter((item) => item.id !== buildingId));
    } catch (error) {
      console.error('Failed to delete building:', error);
      window.alert(error?.response?.data?.error || 'Failed to delete building');
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedBuildings = useMemo(() => {
    const rows = [...buildings];
    rows.sort((a, b) => {
      const left = a?.[sortConfig.key];
      const right = b?.[sortConfig.key];

      if (typeof left === 'number' || typeof right === 'number') {
        const leftNum = Number(left || 0);
        const rightNum = Number(right || 0);
        return sortConfig.direction === 'asc' ? leftNum - rightNum : rightNum - leftNum;
      }

      const leftText = String(left || '').toLowerCase();
      const rightText = String(right || '').toLowerCase();
      const result = leftText.localeCompare(rightText);
      return sortConfig.direction === 'asc' ? result : -result;
    });
    return rows;
  }, [buildings, sortConfig]);

  const activeCount = buildings.filter((item) => normalizeStatus(item.status) === 'ACTIVE').length;
  const inactiveCount = buildings.length - activeCount;
  const totalMeters = buildings.reduce((sum, item) => sum + Number(item.totalMeter || 0), 0);

  const refreshBuildings = async () => {
    const list = await getBuildings();
    const items = Array.isArray(list) ? list : (list?.buildings || list || []);
    const counts = await Promise.all(items.map(async (b) => { try { return await getTotalMeters(b.id); } catch { return b.totalMeter || 0; } }));
    setBuildings(items.map((b, i) => ({
      id: b.id || b.name, name: b.name || '-',
      contact: b.owner?.name ? `${b.owner.name} (${b.owner.email || b.email})` : (b.owner ? b.email : '—'),
      contactEmail: b.owner?.email || '—',
      totalMeter: counts[i] ?? 0,
      status: normalizeStatus(b.status),
      approvalStatus: b.approvalStatus || 'approved',
    })));
  };

  const openAssignModal = async (building) => {
    setAssignBuilding(building); setAssignEmail(''); setUserSearch(''); setShowUnassignedOnly(false);
    try {
      const [u, blds] = await Promise.all([getUsers(), getBldsFromBuilding(true)]);
      const users = Array.isArray(u?.data) ? u.data : Array.isArray(u) ? u : [];
      const buildings = Array.isArray(blds?.data) ? blds.data : Array.isArray(blds) ? blds : [];
      const ubMap = {};
      buildings.forEach(b => {
        if (b.owner?.email) {
          if (!ubMap[b.owner.email]) ubMap[b.owner.email] = [];
          ubMap[b.owner.email].push(b.name);
        }
      });
      setAllUsers(users.filter(x => x.status === 'approved').map(x => ({ label: `${x.name || 'No Name'} (${x.email || ''})`, email: x.email, name: x.name, buildings: ubMap[x.email] || [] })));
    } catch { setAllUsers([]); }
    setAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!assignEmail || !assignBuilding) return;
    setActioningId(assignBuilding.id);
    try { await assignUserToBuilding(assignBuilding.id, assignEmail, 'owner'); message.success('User assigned'); setAssignModalOpen(false); refreshBuildings(); }
    catch (e) { message.error(e?.response?.data?.error || 'Failed'); }
    finally { setActioningId(null); }
  };

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Management
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Buildings</h1>
              <p className="mt-1 text-sm text-slate-500">Review buildings, update ownership details, and manage visibility across the platform.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] flex-nowrap gap-3">
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Total</div>
              <div className="mt-2 text-2xl font-semibold">{buildings.length}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-800 ring-1 ring-emerald-100">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">Active</div>
              <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-5 py-4 text-slate-700 ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Meters</div>
              <div className="mt-2 text-2xl font-semibold">{totalMeters}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Buildings</h2>
              <p className="text-sm text-slate-500">Inactive buildings are hidden from operational dropdowns and user-facing quick selectors.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-500">
              {inactiveCount} inactive building{inactiveCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-[14%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('id')} className={tableHeadButtonClass}>
                      <span>Building ID</span>
                      <span>{getSortIndicator('id', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[24%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('name')} className={tableHeadButtonClass}>
                      <span>Name</span>
                      <span>{getSortIndicator('name', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[22%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('contact')} className={tableHeadButtonClass}>
                      <span>Contact</span>
                      <span>{getSortIndicator('contact', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[14%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('totalMeter')} className={tableHeadButtonClass}>
                      <span>Total Meter</span>
                      <span>{getSortIndicator('totalMeter', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[8%] px-2 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Status</th>
                  <th className="w-[10%] px-2 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">Loading building data...</td>
                  </tr>
                ) : sortedBuildings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">No buildings available.</td>
                  </tr>
                ) : sortedBuildings.map((building) => (
                  <tr key={building.id} className="transition hover:bg-slate-50/80">
                    {editingRow === building.id ? (
                      <>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <input
                            type="number"
                            value={editData.id ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') { handleInputChange('id', null); return; }
                              const num = parseInt(raw, 10);
                              handleInputChange('id', Number.isNaN(num) ? raw : num);
                            }}
                            placeholder="Building ID"
                            className={inputClass}
                            style={{ maxWidth: 90 }}
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.name} readOnly className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.contact} readOnly className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="number" value={editData.totalMeter} readOnly className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <select value={editData.approvalStatus || 'pending'} onChange={(e) => handleInputChange('approvalStatus', e.target.value)} className={inputClass}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button type="button" onClick={() => handleSave(building.id)} className={primaryButtonClass}>Save</button>
                            <button type="button" onClick={handleCancel} className={secondaryButtonClass}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => handleEdit(building.id)} title="Edit"
                              className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs">✏️</button>
                            <Link
                              to={`/building/${slugify(building.name)}`}
                              className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100 whitespace-nowrap"
                              title={`Open ${building.name}`}
                            >
                              {formatEntityId('BUILDING', building.id)}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-800">{building.name}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600 max-w-[200px] truncate" title={building.contact}>{building.contact}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-700">{building.totalMeter}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            building.approvalStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            building.approvalStatus === 'rejected' ? 'bg-red-50 text-red-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {building.approvalStatus || 'pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <button onClick={() => openAssignModal(building)} title="Assign User"
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 text-sm">👤</button>
                            <button type="button" onClick={() => handleDelete(building.id, building.name)} title="Delete"
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 text-sm">🗑️</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <input type="checkbox" checked={showUnassignedOnly}
                onChange={e => setShowUnassignedOnly(e.target.checked)} className="rounded" />
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
  );
};

export default Buildings;

