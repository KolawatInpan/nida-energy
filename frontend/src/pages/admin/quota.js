import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getQuotaWarnings } from '../../core/data_connecter/invoice';

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatToken(value) {
  return `${toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} Token`;
}

function formatDays(value) {
  if (value == null) return 'N/A';
  if (value >= 999) return '999+';
  return `${Math.max(0, Math.floor(toNumber(value))).toLocaleString()}`;
}

function getLevelStyle(level) {
  if (level === 'critical') {
    return {
      shell: 'border-red-200 bg-red-50',
      badge: 'bg-red-100 text-red-700',
      bar: 'bg-red-500',
      number: 'text-red-600',
    };
  }

  if (level === 'warning') {
    return {
      shell: 'border-orange-200 bg-orange-50',
      badge: 'bg-orange-100 text-orange-700',
      bar: 'bg-orange-500',
      number: 'text-orange-600',
    };
  }

  if (level === 'moderate') {
    return {
      shell: 'border-amber-200 bg-amber-50',
      badge: 'bg-amber-100 text-amber-700',
      bar: 'bg-amber-500',
      number: 'text-amber-600',
    };
  }

  return {
    shell: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    number: 'text-emerald-600',
  };
}

export default function QuotaWarning() {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('coverage-asc');

  useEffect(() => {
    let mounted = true;

    getQuotaWarnings({ lookbackMonths: 3 })
      .then((result) => {
        if (!mounted) return;
        setData(result);
        setError('');
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.response?.data?.error || err.message || 'Failed to load quota warnings');
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const items = useMemo(() => {
    const rows = Array.isArray(data?.items) ? [...data.items] : [];

    const filtered = rows.filter((item) => {
      if (statusFilter === 'all') return true;
      return String(item.level || '').toLowerCase() === statusFilter;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'coverage-desc') return toNumber(b.coveragePercent) - toNumber(a.coveragePercent);
      if (sortBy === 'balance-asc') return toNumber(a.walletBalance) - toNumber(b.walletBalance);
      if (sortBy === 'balance-desc') return toNumber(b.walletBalance) - toNumber(a.walletBalance);
      return toNumber(a.coveragePercent) - toNumber(b.coveragePercent);
    });

    return filtered;
  }, [data, sortBy, statusFilter]);

  const summary = data?.summary || {
    totalBuildings: 0,
    totalWarnings: 0,
    criticalCount: 0,
    warningCount: 0,
    healthyCount: 0,
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-6">
      <div className="max-w-[1500px] mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-4 lg:p-5 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => history.push('/home')}
                className="mb-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Quota Warnings</h1>
              <p className="text-sm text-gray-500 mt-1">
                Compare every building&apos;s wallet balance against expected monthly token cost.
              </p>
            </div>
            <div className="text-right text-xs text-gray-500 shrink-0">
              <div>Rule</div>
              <div className="text-sm font-semibold text-gray-800">1 Token / kWh</div>
              <div className="mt-1">Avg from last 3 months</div>
            </div>
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-4">
          <div className="w-full sm:w-[calc(50%-0.5rem)] xl:flex-1 xl:basis-0 bg-white border border-gray-200 rounded-xl p-4 shadow-sm min-w-0">
            <div className="text-xs text-gray-500">Total Buildings</div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{summary.totalBuildings}</div>
            <div className="text-xs text-gray-500 mt-1">All buildings in the system</div>
          </div>
          <div className="w-full sm:w-[calc(50%-0.5rem)] xl:flex-1 xl:basis-0 bg-white border border-red-100 rounded-xl p-4 shadow-sm min-w-0">
            <div className="text-xs text-gray-500">Buildings Below Expected</div>
            <div className="text-3xl font-bold text-red-600 mt-2">{summary.totalWarnings}</div>
            <div className="text-xs text-gray-500 mt-1">Wallet balance lower than forecast</div>
          </div>
          <div className="w-full sm:w-[calc(50%-0.5rem)] xl:flex-1 xl:basis-0 bg-white border border-orange-100 rounded-xl p-4 shadow-sm min-w-0">
            <div className="text-xs text-gray-500">Critical</div>
            <div className="text-3xl font-bold text-orange-600 mt-2">{summary.criticalCount}</div>
            <div className="text-xs text-gray-500 mt-1">Coverage below 20%</div>
          </div>
          <div className="w-full sm:w-[calc(50%-0.5rem)] xl:flex-1 xl:basis-0 bg-white border border-emerald-100 rounded-xl p-4 shadow-sm min-w-0">
            <div className="text-xs text-gray-500">Healthy</div>
            <div className="text-3xl font-bold text-emerald-600 mt-2">{summary.healthyCount}</div>
            <div className="text-xs text-gray-500 mt-1">Wallet covers expected usage</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"
              >
                <option value="all">All Buildings</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="moderate">Moderate</option>
                <option value="healthy">Healthy</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white"
              >
                <option value="coverage-asc">Coverage (Low to High)</option>
                <option value="coverage-desc">Coverage (High to Low)</option>
                <option value="balance-asc">Wallet (Low to High)</option>
                <option value="balance-desc">Wallet (High to Low)</option>
              </select>
            </div>
            <div className="text-xs text-gray-500">
              Showing {items.length} of {summary.totalBuildings} buildings
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 shadow-sm">
              Loading quota warnings...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 shadow-sm">
              No buildings matched this filter.
            </div>
          )}

          {!loading && items.map((item) => {
            const style = getLevelStyle(item.level);
            const progressWidth = Math.max(0, Math.min(100, toNumber(item.coveragePercent)));

            return (
              <div
                key={item.buildingId || item.buildingName}
                className={`rounded-xl border p-5 shadow-sm ${style.shell}`}
              >
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{item.buildingName}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${style.badge}`}>
                        {item.level}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {item.address || '-'} {item.province ? `, ${item.province}` : ''}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Contact: {item.contact || '-'}
                    </div>
                  </div>
                  <div className="text-left xl:text-right">
                    <div className="text-xs text-gray-500">Coverage</div>
                    <div className={`text-2xl font-bold ${style.number}`}>
                      {toNumber(item.coveragePercent).toFixed(0)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {item.status === 'warning' ? 'Below expected monthly cost' : 'Wallet looks healthy'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-4">
                  <div className="w-full sm:w-[calc(50%-0.5rem)] lg:flex-1 lg:basis-0 rounded-lg bg-white/80 border border-white p-4 min-w-0">
                    <div className="text-xs text-gray-500">Wallet Balance</div>
                    <div className={`mt-2 text-2xl font-bold ${item.status === 'warning' ? 'text-red-600' : 'text-gray-900'}`}>
                      {toNumber(item.walletBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400">Token</div>
                  </div>
                  <div className="w-full sm:w-[calc(50%-0.5rem)] lg:flex-1 lg:basis-0 rounded-lg bg-white/80 border border-white p-4 min-w-0">
                    <div className="text-xs text-gray-500">Avg Monthly Usage</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">
                      {toNumber(item.avgMonthlyUsage).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400">kWh</div>
                  </div>
                  <div className="w-full sm:w-[calc(50%-0.5rem)] lg:flex-1 lg:basis-0 rounded-lg bg-white/80 border border-white p-4 min-w-0">
                    <div className="text-xs text-gray-500">Last Invoice</div>
                    <div className="mt-2 text-2xl font-bold text-gray-900">
                      {toNumber(item.lastInvoice?.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.lastInvoice ? `Invoice ${item.lastInvoice.id}` : 'No invoice yet'}
                    </div>
                  </div>
                  <div className="w-full sm:w-[calc(50%-0.5rem)] lg:flex-1 lg:basis-0 rounded-lg bg-white/80 border border-white p-4 min-w-0">
                    <div className="text-xs text-gray-500">Days Until Empty</div>
                    <div className={`mt-2 text-2xl font-bold ${item.status === 'warning' ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatDays(item.daysUntilEmpty)}
                    </div>
                    <div className="text-xs text-gray-400">Estimated</div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span>Balance vs expected monthly token cost</span>
                    <span>{formatToken(item.walletBalance)} / {formatToken(item.expectedTokenCost)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/80 overflow-hidden">
                    {progressWidth > 0 ? (
                      <div
                        className={`h-full ${style.bar}`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-sm text-gray-600">
                  <div>
                    Shortfall: <span className={`font-semibold ${item.shortfallToken > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatToken(item.shortfallToken)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.contact && (
                      <button
                        type="button"
                        onClick={() => history.push(`/wallet/${encodeURIComponent(item.buildingName)}`)}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        View Wallet
                      </button>
                    )}
                    {item.lastInvoice?.id && (
                      <button
                        type="button"
                        onClick={() => history.push(`/invoice/${encodeURIComponent(item.lastInvoice.id)}/pay`)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        View Invoice Detail
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

