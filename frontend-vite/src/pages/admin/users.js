import React, { useEffect, useMemo, useState } from 'react';
import { deleteUser, getUsers, getBuildingsFromEmail, updateUser } from '../../core/data_connecter/user';
import { formatEntityId } from '../../utils/formatters';

const getSortIndicator = (key, sortConfig) => {
  if (sortConfig.key !== key) return '↕';
  return sortConfig.direction === 'asc' ? '↑' : '↓';
};

const shellClass = 'min-h-screen bg-slate-50 px-6 py-8';
const panelClass = 'overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm';
const tableHeadButtonClass = 'inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:text-slate-700';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100';
const primaryButtonClass = 'rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 whitespace-nowrap';
const secondaryButtonClass = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 whitespace-nowrap';
const dangerButtonClass = 'rounded-lg bg-rose-500 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-rose-600 whitespace-nowrap';

const roleBadgeClass = (role) => {
  const normalized = String(role || '').trim().toUpperCase();
  if (normalized === 'ADMIN') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
  if (normalized === 'PRODUCER') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
  if (normalized === 'BATTERY') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
  if (normalized === 'CONSUMER') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const raw = await getUsers();
        const userData = Array.isArray(raw) ? raw : [];

        const enriched = await Promise.all(userData.map(async (user) => {
          if (user.building) return user;
          const email = (user.email || user.credEmail || user.username || user.mail || user.emailAddress || '').toString();
          if (!email) return { ...user, building: '' };

          try {
            const buildings = await getBuildingsFromEmail(email);
            let buildingName = '';

            if (Array.isArray(buildings)) {
              const match = buildings.find((item) => {
                if (!item) return false;
                const candidates = [];
                if (item.email) candidates.push(item.email);
                if (item.credEmail) candidates.push(item.credEmail);
                if (item.contactEmail) candidates.push(item.contactEmail);
                if (Array.isArray(item.emails)) candidates.push(...item.emails);
                return candidates.some((candidate) => candidate && candidate.toLowerCase() === email.toLowerCase());
              });
              if (match) {
                buildingName = match.name || match.building || '';
              } else {
                const names = buildings
                  .map((item) => (item && (item.name || item.building)) ? (item.name || item.building) : null)
                  .filter(Boolean);
                buildingName = names.join(', ');
              }
            } else if (buildings && typeof buildings === 'object') {
              buildingName = buildings.name || buildings.building || '';
            } else {
              buildingName = String(buildings || '');
            }

            return { ...user, building: buildingName };
          } catch (error) {
            console.error('Error fetching building for user', email, error);
            return { ...user, building: '' };
          }
        }));

        if (mounted) {
          setUsers(enriched);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
        if (mounted) setUsers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUsers();
    return () => {
      mounted = false;
    };
  }, []);

  const handleEdit = (credId) => {
    const target = users.find((item) => item.credId === credId);
    if (!target) return;
    setEditingRow(credId);
    setEditData({ ...target });
  };

  const handleSave = async (credId) => {
    try {
      const updated = await updateUser(credId, {
        name: editData.name,
        telNum: editData.telNum,
        role: editData.role,
      });

      setUsers((prev) => prev.map((item) => (
        item.credId === credId
          ? { ...item, ...updated, building: item.building }
          : item
      )));
      setEditingRow(null);
      setEditData({});
    } catch (error) {
      console.error('Failed to update user:', error);
      window.alert(error?.response?.data?.error || 'Failed to update user');
    }
  };

  const handleCancel = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDelete = async (credId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(credId);
        setUsers((prev) => prev.filter((item) => item.credId !== credId));
      } catch (error) {
        console.error('Failed to delete user:', error);
        window.alert(error?.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedUsers = useMemo(() => {
    const rows = [...users];
    rows.sort((a, b) => {
      const left = a?.[sortConfig.key];
      const right = b?.[sortConfig.key];
      const leftText = String(left || '').toLowerCase();
      const rightText = String(right || '').toLowerCase();
      const result = leftText.localeCompare(rightText);
      return sortConfig.direction === 'asc' ? result : -result;
    });
    return rows;
  }, [users, sortConfig]);

  const adminCount = users.filter((user) => String(user.role || '').trim().toUpperCase() === 'ADMIN').length;
  const memberCount = users.length - adminCount;
  const buildingLinkedCount = users.filter((user) => String(user.building || '').trim()).length;

  return (
    <div className={shellClass}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-700">
              Management
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Users</h1>
              <p className="mt-1 text-sm text-slate-500">Monitor member accounts, building assignments, and role distribution across the platform.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] flex-nowrap gap-3">
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-950 px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Total</div>
              <div className="mt-2 text-2xl font-semibold">{users.length}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-blue-50 px-5 py-4 text-blue-800 ring-1 ring-blue-100">
              <div className="text-xs uppercase tracking-[0.2em] text-blue-600">Admin</div>
              <div className="mt-2 text-2xl font-semibold">{adminCount}</div>
              </div>
              <div className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-5 py-4 text-slate-700 ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Assigned</div>
              <div className="mt-2 text-2xl font-semibold">{buildingLinkedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
              <p className="text-sm text-slate-500">Keep identities readable and roles aligned with operational access controls.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-500">
              {memberCount} non-admin account{memberCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-[18%] px-4 py-4 text-center">
                    <button type="button" onClick={() => handleSort('credId')} className={tableHeadButtonClass}>
                      <span>User ID</span>
                      <span>{getSortIndicator('credId', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[20%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('name')} className={tableHeadButtonClass}>
                      <span>Name</span>
                      <span>{getSortIndicator('name', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[20%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('building')} className={tableHeadButtonClass}>
                      <span>Building</span>
                      <span>{getSortIndicator('building', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[16%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('telNum')} className={tableHeadButtonClass}>
                      <span>Contact</span>
                      <span>{getSortIndicator('telNum', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[12%] px-6 py-4 text-center">
                    <button type="button" onClick={() => handleSort('role')} className={tableHeadButtonClass}>
                      <span>Role</span>
                      <span>{getSortIndicator('role', sortConfig)}</span>
                    </button>
                  </th>
                  <th className="w-[14%] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">Loading user data...</td>
                  </tr>
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-16 text-center text-sm text-slate-500">No users available.</td>
                  </tr>
                ) : sortedUsers.map((user) => (
                  <tr key={user.credId} className="transition hover:bg-slate-50/80">
                    {editingRow === user.credId ? (
                      <>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            {formatEntityId('USR', editData.credId)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} className={inputClass} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.building || ''} readOnly className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-400`} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="text" value={editData.telNum || ''} onChange={(e) => handleInputChange('telNum', e.target.value)} className={inputClass} />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <select value={editData.role || 'USER'} onChange={(e) => handleInputChange('role', e.target.value)} className={inputClass}>
                            <option value="ADMIN">ADMIN</option>
                            <option value="USER">USER</option>
                            <option value="CONSUMER">CONSUMER</option>
                            <option value="PRODUCER">PRODUCER</option>
                            <option value="BATTERY">BATTERY</option>
                          </select>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <button type="button" onClick={() => handleSave(user.credId)} className={primaryButtonClass}>Save</button>
                            <button type="button" onClick={handleCancel} className={secondaryButtonClass}>Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            {formatEntityId('USR', user.credId)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-medium text-slate-800">{user.name || '-'}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">{user.building || '-'}</td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">{user.telNum || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${roleBadgeClass(user.role)}`}>
                            {String(user.role || 'USER').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <button type="button" onClick={() => handleEdit(user.credId)} className={secondaryButtonClass}>Edit</button>
                            <button type="button" onClick={() => handleDelete(user.credId)} className={dangerButtonClass}>Delete</button>
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

export default Users;

