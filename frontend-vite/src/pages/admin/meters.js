import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteMeter, getMeters, updateMeter } from '../../core/data_connecter/meter';
import { getBuildings } from '../../core/data_connecter/register';
import { formatEntityId } from '../../utils/formatters';

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

const normalizeApprovalStatus = (status) => {
  const normalized = String(status || 'pending').trim().toUpperCase();
  if (normalized === 'APPROVED') return 'APPROVED';
  if (normalized === 'REJECTED') return 'REJECTED';
  return 'PENDING';
};

const getStatusColor = (status) => {
  const normalized = normalizeApprovalStatus(status);
  if (normalized === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (normalized === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
};

const getTypeColor = (type) => {
  const normalized = String(type || '').trim().toUpperCase();
  if (normalized === 'PRODUCE') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  if (normalized === 'CONSUME') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
  if (normalized === 'BATTERY') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
};

const Meters = () => {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'buildingName', direction: 'asc' });
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [allBuildings, setAllBuildings] = useState([]);

  useEffect(() => {
    const fetchMeters = async () => {
      setLoading(true);
      try {
        const data = await getMeters();
        const list = Array.isArray(data) ? data : (data?.meters || data || []);
        const normalized = list.map((meter) => ({
          snid: meter.snid,
          buildingName: meter.buildingName || meter.building?.name || meter.building?.owner?.name || '-',
          type: meter.produceMeter ? 'Produce' : meter.consumeMeter ? 'Consume' : meter.batMeter ? 'Battery' : (meter.type || 'Unknown'),
          capacity: meter.capacity || meter.kwh || meter.kWH || '',
          status: normalizeApprovalStatus(meter.approveStatus || meter.status || 'PENDING'),
          raw: meter,
        }));
        setMeters(normalized);
      } catch (error) {
        console.error('Error fetching meters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeters();
  }, []);

  useEffect(() => {
    getBuildings().then(data => {
      const list = Array.isArray(data) ? data : (data?.buildings || []);
      setAllBuildings(list.map(b => b.name || b).filter(Boolean).sort());
    }).catch(() => {});
  }, []);

  const handleEdit = (snid) => {
    const target = meters.find((item) => item.snid === snid);
    if (!target) return;
    setEditingRow(snid);
    setEditData({ ...target });
  };

  const handleSave = async (snid) => {
    try {
      const updated = await updateMeter(snid, {
        buildingName: editData.buildingName,
        type: editData.type,
        capacity: editData.capacity,
        status: normalizeApprovalStatus(editData.status),
        newSnid: editData.newSnid && editData.newSnid !== snid ? editData.newSnid : undefined,
      });

      setMeters((prev) => prev.map((item) => (
        item.snid === snid
          ? {
              ...item,
              snid: updated.snid,
              buildingName: updated.buildingName || updated.building?.name || item.buildingName,
              type: updated.type || item.type,
              capacity: updated.capacity ?? item.capacity,
              status: normalizeApprovalStatus(updated.approveStatus || updated.status || item.status),
              raw: updated,
            }
          : item
      )));
      setEditingRow(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update meter:', error);
      window.alert(error?.response?.data?.error || 'Failed to update meter');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (snid) => {
    if (window.confirm('Are you sure you want to delete this meter?')) {
      try {
        await deleteMeter(snid);
        setMeters((prev) => prev.filter((item) => item.snid !== snid));
      } catch (error) {
        console.error('Failed to delete meter:', error);
        window.alert(error?.response?.data?.error || 'Failed to delete meter');
      }
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const uniqueBuildings = useMemo(() => [...new Set(meters.map(m => m.buildingName))].sort(), [meters]);
  const uniqueTypes = useMemo(() => [...new Set(meters.map(m => String(m.type).trim()))].sort(), [meters]);

  const filteredMeters = useMemo(() => {
    return meters.filter(m => {
      if (filterBuilding && m.buildingName !== filterBuilding) return false;
      if (filterType && String(m.type).trim() !== filterType) return false;
      if (filterStatus && normalizeApprovalStatus(m.status) !== filterStatus) return false;
      return true;
    });
  }, [meters, filterBuilding, filterType, filterStatus]);

  const sortedMeters = useMemo(() => {
    const rows = [...filteredMeters];
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
  }, [filteredMeters, sortConfig]);

  const approvedCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'APPROVED').length;
  const pendingCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'PENDING').length;
  const rejectedCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'REJECTED').length;

  // Detect duplicate meter types within the same building
  const duplicateTypeWarnings = useMemo(() => {
    const byBuilding = {};
    meters.forEach((m) => {
      const bld = m.buildingName;
      const type = normalizeApprovalStatus(m.status) === 'APPROVED' ? String(m.type).trim() : '';
      if (!bld || !type) return;
      if (!byBuilding[bld]) byBuilding[bld] = {};
      if (!byBuilding[bld][type]) byBuilding[bld][type] = [];
      byBuilding[bld][type].push(m.snid);
    });
    const warnings = [];
    Object.entries(byBuilding).forEach(([bld, types]) => {
      Object.entries(types).forEach(([type, snids]) => {
        if (snids.length > 1) {
          warnings.push({ building: bld, type, snids });
        }
      });
    });
    warnings.sort((a, b) => a.building.localeCompare(b.building) || a.type.localeCompare(b.type));
    return warnings;
  }, [meters]);

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Management
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Meters</h1>
              <p className="mt-1 text-sm text-slate-500">Track meter assignments, manage approval flow, and keep physical assets aligned with buildings.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] flex-nowrap gap-3">
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Total</div>
              <div className="mt-2 text-2xl font-semibold">{meters.length}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-800 ring-1 ring-emerald-100">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">Approved</div>
              <div className="mt-2 text-2xl font-semibold">{approvedCount}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-amber-50 px-5 py-4 text-amber-800 ring-1 ring-amber-100">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-600">Pending</div>
              <div className="mt-2 text-2xl font-semibold">{pendingCount}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Duplicate Meter Type Warning */}
        {duplicateTypeWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-amber-800 mb-2">
                  Duplicate Meter Types Detected ({duplicateTypeWarnings.length} building{duplicateTypeWarnings.length > 1 ? 's' : ''})
                </h3>
                <div className="space-y-1.5">
                  {duplicateTypeWarnings.map((w) => (
                    <div key={`${w.building}-${w.type}`} className="text-xs text-amber-700 flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{w.building}</span>
                      <span className="inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {w.type}
                      </span>
                      <span className="text-amber-600">×{w.snids.length}</span>
                      <span className="text-amber-500 font-mono text-[10px]">({w.snids.join(', ')})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={panelClass}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Meters</h2>
              <p className="text-sm text-slate-500">Keep approval states readable and maintain clear links back to their assigned buildings.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                <option value="">🏢 All Buildings</option>
                {uniqueBuildings.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                <option value="">⚡ All Types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600">
                <option value="">📋 All Status</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING">Pending</option>
                <option value="REJECTED">Rejected</option>
              </select>
              {(filterBuilding || filterType || filterStatus) && (
                <button onClick={() => { setFilterBuilding(''); setFilterType(''); setFilterStatus(''); }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                  ✕ Clear
                </button>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                {sortedMeters.length} of {meters.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-[16%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('snid')} className={tableHeadButtonClass}>
                      <span>Meter ID</span>
                      <span>{getSortIndicator('snid', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[24%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('buildingName')} className={tableHeadButtonClass}>
                      <span>Building Name</span>
                      <span>{getSortIndicator('buildingName', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[16%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('type')} className={tableHeadButtonClass}>
                      <span>Type</span>
                      <span>{getSortIndicator('type', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[16%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('capacity')} className={tableHeadButtonClass}>
                      <span>Capacity</span>
                      <span>{getSortIndicator('capacity', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[16%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('status')} className={tableHeadButtonClass}>
                      <span>Status</span>
                      <span>{getSortIndicator('status', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[14%] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">Loading meter data...</td>
                  </tr>
                ) : sortedMeters.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">No meters available.</td>
                  </tr>
                ) : sortedMeters.map((meter) => (
                  <tr key={meter.snid} className="transition hover:bg-slate-50/80">
                    {editingRow === meter.snid ? (
                      <>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                              {editData.snid}
                            </span>
                            <input
                              type="text"
                              value={editData.newSnid || ''}
                              onChange={(e) => handleInputChange('newSnid', e.target.value)}
                              placeholder="New SNID"
                              className={inputClass}
                              style={{ maxWidth: 160, fontSize: 11 }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select value={editData.buildingName || ''} onChange={(e) => handleInputChange('buildingName', e.target.value)} className={inputClass}>
                            <option value="">Select building...</option>
                            {allBuildings.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select value={editData.type || 'Consume'} onChange={(e) => handleInputChange('type', e.target.value)} className={inputClass}>
                            <option value="Produce">Produce</option>
                            <option value="Consume">Consume</option>
                            <option value="Battery">Battery</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="number" value={editData.capacity || ''} onChange={(e) => handleInputChange('capacity', parseFloat(e.target.value || '0'))} className={inputClass} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select value={normalizeApprovalStatus(editData.status)} onChange={(e) => handleInputChange('status', e.target.value)} className={inputClass}>
                            <option value="APPROVED">APPROVED</option>
                            <option value="PENDING">PENDING</option>
                            <option value="REJECTED">REJECTED</option>
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button type="button" onClick={() => handleSave(meter.snid)} className={primaryButtonClass}>Save</button>
                            <button type="button" onClick={handleCancel} className={secondaryButtonClass}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => handleEdit(meter.snid)} title="Edit"
                              className="w-6 h-6 inline-flex items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs flex-shrink-0">✏️</button>
                            <Link
                              to={`/meter/${encodeURIComponent(meter.snid)}`}
                              className="inline-flex rounded-full bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                              title={`Open meter ${meter.snid}`}
                            >
                              {meter.snid}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-800">{meter.buildingName || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${getTypeColor(meter.type)}`}>
                            {meter.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">{meter.capacity || '-'}{meter.capacity ? ' kW' : ''}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${getStatusColor(meter.status)}`}>
                            {normalizeApprovalStatus(meter.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-1">
                            <button type="button" onClick={() => handleDelete(meter.snid)} title="Delete"
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
    </div>
  );
};

export default Meters;

