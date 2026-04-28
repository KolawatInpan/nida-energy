import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteMeter, getMeters, updateMeter } from '../../core/data_connecter/meter';
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

  const sortedMeters = useMemo(() => {
    const rows = [...meters];
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
  }, [meters, sortConfig]);

  const approvedCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'APPROVED').length;
  const pendingCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'PENDING').length;
  const rejectedCount = meters.filter((meter) => normalizeApprovalStatus(meter.status) === 'REJECTED').length;

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

        <div className={panelClass}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Meters</h2>
              <p className="text-sm text-slate-500">Keep approval states readable and maintain clear links back to their assigned buildings.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-500">
              {rejectedCount} rejected meter{rejectedCount === 1 ? '' : 's'}
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
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                            {formatEntityId('MTR', editData.snid)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.buildingName || ''} onChange={(e) => handleInputChange('buildingName', e.target.value)} className={inputClass} />
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
                        <td className="px-6 py-4 text-center">
                          <Link
                            to={`/meter/${encodeURIComponent(meter.snid)}`}
                            className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                            title={`Open meter ${meter.snid}`}
                          >
                            {formatEntityId('MTR', meter.snid)}
                          </Link>
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
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEdit(meter.snid)} className={secondaryButtonClass}>Edit</button>
                            <button type="button" onClick={() => handleDelete(meter.snid)} className={dangerButtonClass}>Delete</button>
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

