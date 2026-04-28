import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteBuilding, getBuildings, getTotalMeters, updateBuilding } from '../../core/data_connecter/building';
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

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const list = await getBuildings();
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
          contact: building.owner?.name || building.email || building.contact || '-',
          totalMeter: counts[index] ?? (building.meters ? building.meters.length : building.totalMeter || 0),
          status: normalizeStatus(building.status),
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
      const updated = await updateBuilding(buildingId, {
        status: normalizeStatus(editData.status),
      });

      setBuildings((prev) => prev.map((item) => (
        item.id === buildingId
          ? { ...item, status: normalizeStatus(updated?.status || editData.status) }
          : item
      )));
      setEditingRow(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update building:', error);
      window.alert(error?.response?.data?.error || 'Failed to update building');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (buildingId) => {
    if (window.confirm('Are you sure you want to delete this building?')) {
      try {
        await deleteBuilding(buildingId);
        setBuildings((prev) => prev.filter((item) => item.id !== buildingId));
      } catch (error) {
        console.error('Failed to delete building:', error);
        window.alert(error?.response?.data?.error || 'Failed to delete building');
      }
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
                  <th className="w-[14%] px-6 py-4 text-center">
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
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100">
                            {formatEntityId('BLD', editData.id)}
                          </span>
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
                        <td className="px-6 py-4 text-center">
                          <select value={normalizeStatus(editData.status)} onChange={(e) => handleInputChange('status', e.target.value)} className={inputClass}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="INACTIVE">INACTIVE</option>
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
                        <td className="px-6 py-4 text-center">
                          <Link
                            to={`/building/${slugify(building.name)}`}
                            className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                            title={`Open ${building.name}`}
                          >
                            {formatEntityId('BLD', building.id)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-800">{building.name}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">{building.contact}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-700">{building.totalMeter}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${statusBadgeClass(building.status)}`}>
                            {normalizeStatus(building.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <button type="button" onClick={() => handleEdit(building.id)} className={secondaryButtonClass}>Edit</button>
                            <button type="button" onClick={() => handleDelete(building.id)} className={dangerButtonClass}>Delete</button>
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

export default Buildings;

