import React, { useEffect, useMemo, useState } from 'react';
import { createEnergyRate, createTokenRate, getEnergyRates, getTokenRates } from '../../core/data_connecter/rate';

const RATE_TYPES = {
  energy: [
    'Grid Import Rate',
    'P2P Market Price',
    'Platform Service Fee',
    'Feed-in Tariff',
  ],
  token: [
    'Token Exchange Rate',
    'Treasury Buyback Rate',
    'Admin Settlement Rate',
  ],
};

function formatDate(value) {
  if (!value) return 'Ongoing';
  return new Date(value).toLocaleDateString();
}

function getStatusPill(status) {
  if (status === 'active') return 'bg-green-50 text-green-700 border border-green-200';
  if (status === 'archived') return 'bg-gray-100 text-gray-600 border border-gray-200';
  return 'bg-blue-50 text-blue-700 border border-blue-200';
}

export default function RateManagement() {
  const [energyRates, setEnergyRates] = useState([]);
  const [tokenRates, setTokenRates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    scope: 'energy',
    rateType: '',
    price: '',
    effectiveStart: '',
    effectiveEnd: '',
  });

  const loadRates = async () => {
    try {
      setLoading(true);
      setError('');
      const [energyRows, tokenRows] = await Promise.all([
        getEnergyRates().catch(() => []),
        getTokenRates().catch(() => []),
      ]);
      setEnergyRates(Array.isArray(energyRows) ? energyRows : []);
      setTokenRates(Array.isArray(tokenRows) ? tokenRows : []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load electricity rates');
      setEnergyRates([]);
      setTokenRates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const activeRates = form.scope === 'token' ? tokenRates : energyRates;

  const filteredRates = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activeRates;

    return activeRates.filter((rate) =>
      String(rate.rateId || '').toLowerCase().includes(keyword)
      || String(rate.rateType || '').toLowerCase().includes(keyword)
    );
  }, [activeRates, search]);

  const latestEnergyRate = energyRates[0] || null;
  const latestTokenRate = tokenRates[0] || null;

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setForm((prev) => {
      if (field === 'scope') {
        return {
          ...prev,
          scope: nextValue,
          rateType: '',
        };
      }

      return { ...prev, [field]: nextValue };
    });
  };

  const handleReset = () => {
    setForm({
      scope: 'energy',
      rateType: '',
      price: '',
      effectiveStart: '',
      effectiveEnd: '',
    });
    setError('');
    setNotice('');
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError('');
      setNotice('');
      const payload = {
        rateType: form.rateType,
        price: form.price,
        effectiveStart: form.effectiveStart,
        effectiveEnd: form.effectiveEnd,
      };
      const created = form.scope === 'token'
        ? await createTokenRate(payload)
        : await createEnergyRate(payload);
      setNotice(`Saved ${created.rateId} successfully.`);
      handleReset();
      await loadRates();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save rate data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Electricity Rate Management</h1>
            <p className="text-slate-500 mt-2">Configure and store electricity pricing rules with active date ranges.</p>
          </div>
          <button type="button" className="px-5 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700">
            Connect Wallet
          </button>
        </div>

        {(error || notice) && (
          <div className={`rounded-2xl px-4 py-3 text-sm ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {error || notice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-500">Current Rate Energy</div>
            <div className="mt-2 text-sm text-slate-400">Latest energy rate</div>
            <div className="mt-3 text-4xl font-bold text-slate-900">
              {latestEnergyRate ? Number(latestEnergyRate.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
            </div>
            <div className="mt-2 text-sm text-emerald-600 font-medium">Token per kWh</div>
          </div>

          <div className="rounded-3xl border border-blue-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-500">Current Rate Token</div>
            <div className="mt-2 text-sm text-slate-400">Latest token rate</div>
            <div className="mt-3 text-4xl font-bold text-slate-900">
              {latestTokenRate ? Number(latestTokenRate.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
            </div>
            <div className="mt-2 text-sm text-blue-600 font-medium">THB per Token</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-slate-900">Add New Rate Rule</h2>
          </div>

          <div className="p-6">
            <div className="overflow-x-auto">
              <div className="flex min-w-[980px] flex-nowrap gap-4 items-start">
              <div className="flex min-w-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Rate Category</label>
                <select value={form.scope} onChange={handleChange('scope')} className="w-full h-12 rounded-2xl border border-gray-300 px-4 bg-white">
                  <option value="energy">Energy Rate</option>
                  <option value="token">Token Rate</option>
                </select>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Rate Type</label>
                <select value={form.rateType} onChange={handleChange('rateType')} className="w-full h-12 rounded-2xl border border-gray-300 px-4 bg-white">
                  <option value="">Select rate type</option>
                  {(RATE_TYPES[form.scope] || []).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Price per Unit</label>
                <div className="flex items-center h-12 rounded-2xl border border-gray-300 bg-white overflow-hidden">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={handleChange('price')}
                    placeholder="e.g. 3.85"
                    className="flex-1 h-full px-4 outline-none"
                  />
                  <span className="px-4 text-slate-500 text-sm">{form.scope === 'token' ? 'THB' : 'Token'}</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Effective Start Date</label>
                <input type="date" value={form.effectiveStart} onChange={handleChange('effectiveStart')} className="w-full h-12 rounded-2xl border border-gray-300 px-4 bg-white" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Effective End Date</label>
                <input type="date" value={form.effectiveEnd} onChange={handleChange('effectiveEnd')} className="w-full h-12 rounded-2xl border border-gray-300 px-4 bg-white" />
                <div className="text-xs text-slate-400 mt-2">Leave blank if ongoing</div>
              </div>
            </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button type="button" onClick={handleReset} className="px-5 py-3 rounded-2xl border border-gray-300 text-slate-700 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={saving} className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Rate Data'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Stored Rates Database</h2>
              <p className="mt-1 text-sm text-slate-500">
                Showing {form.scope === 'token' ? 'token' : 'energy'} rate rules
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={form.scope}
                onChange={handleChange('scope')}
                className="h-11 rounded-2xl border border-gray-300 px-4 bg-white"
              >
                <option value="energy">Energy Rates</option>
                <option value="token">Token Rates</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rates..."
                className="w-full lg:w-72 h-11 rounded-2xl border border-gray-300 px-4"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Rate ID</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Rate Type</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Price</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Effective Start</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Effective End</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredRates.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No rates found</td>
                  </tr>
                )}
                {filteredRates.map((rate) => (
                  <tr key={rate.rateId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-5 text-base font-semibold text-slate-900">{rate.rateId}</td>
                    <td className="px-6 py-5 text-base text-slate-700">{rate.rateType}</td>
                    <td className="px-6 py-5 text-base font-semibold text-blue-600">{Number(rate.price).toLocaleString(undefined, { maximumFractionDigits: 2 })} THB</td>
                    <td className="px-6 py-5 text-base text-slate-600">{formatDate(rate.effectiveStart)}</td>
                    <td className="px-6 py-5 text-base text-slate-600">{formatDate(rate.effectiveEnd)}</td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusPill(rate.status)}`}>
                        {rate.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 text-sm text-slate-500 border-t border-gray-200">
            Showing {filteredRates.length} result(s)
          </div>
        </div>
      </div>
    </div>
  );
}

