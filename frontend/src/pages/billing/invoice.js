import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  generateInvoices,
  getInvoices,
  getInvoiceSummary,
} from '../../core/data_connecter/invoice';
import { getBuildings } from '../../core/data_connecter/register';
import { formatEntityId } from '../../utils/formatters';
import { normalizeRoleName as normalizeRoleNameFromSession } from '../../utils/authSession';
import { NoBuildingAssignedPage } from '../../components/shared';
import Key from '../../global/key';

const RATE_PER_KWH = 1;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatPeriod(month, year) {
  const monthIndex = Math.max(1, Math.min(12, Number(month || 1))) - 1;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function shortenValue(value, start = 8, end = 8) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= start + end) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function getStatusPill(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'paid') return 'bg-green-100 text-green-700';
  if (normalized === 'late' || normalized === 'overdue') return 'bg-red-100 text-red-700';
  return 'bg-orange-100 text-orange-700';
}

export default function Invoice() {
  const history = useHistory();
  const memberStore = useSelector((store) => store.member.all);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [yearInvoices, setYearInvoices] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [buildingsResolved, setBuildingsResolved] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const member = useMemo(() => {
    if (Array.isArray(memberStore) && memberStore.length > 0) return memberStore[0];
    if (memberStore && typeof memberStore === 'object') return memberStore;
    return null;
  }, [memberStore]);
  const roleName = useMemo(() => {
    if (member) return normalizeRoleNameFromSession(member);
    const storedRole = String(localStorage.getItem(Key.UserRole) || '').trim().toUpperCase();
    return storedRole || 'USER';
  }, [member]);
  const isUserScope = roleName === 'USER' || roleName === 'CONSUMER';
  const memberEmail = String(member?.email || localStorage.getItem(Key.UserEmail) || '').toLowerCase();
  const memberBuilding = useMemo(() => {
    return buildings.find((building) => String(building?.email || '').toLowerCase() === memberEmail) || null;
  }, [buildings, memberEmail]);
  const effectiveBuilding = isUserScope ? (memberBuilding?.name || undefined) : (selectedBuilding !== 'all' ? selectedBuilding : undefined);

  const yearOptions = useMemo(() => {
    const currentYear = today.getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, [today]);

  const loadData = async (selectedMonth = month, selectedYear = year) => {
    try {
      setLoading(true);
      setError('');

      if (isUserScope && !buildingsResolved) {
        return;
      }

      if (isUserScope && buildingsResolved && !memberBuilding?.name) {
        setError('No building assigned to this user');
        setSummary(null);
        setInvoices([]);
        setYearInvoices([]);
        return;
      }

      const buildingName = isUserScope ? (memberBuilding?.name || undefined) : (selectedBuilding !== 'all' ? selectedBuilding : undefined);

      const [summaryData, invoiceData, yearlyInvoiceData] = await Promise.all([
        getInvoiceSummary({ month: selectedMonth, year: selectedYear, buildingName }),
        getInvoices({ month: selectedMonth, year: selectedYear, buildingName }),
        getInvoices({ year: selectedYear, buildingName }),
      ]);

      setSummary(summaryData);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setYearInvoices(Array.isArray(yearlyInvoiceData) ? yearlyInvoiceData : []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load invoices');
      setSummary(null);
      setInvoices([]);
      setYearInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(month, year);
  }, [month, year, selectedBuilding, isUserScope, memberBuilding?.name]);

  useEffect(() => {
    let mounted = true;
    getBuildings()
      .then((rows) => {
        if (!mounted) return;
        setBuildings(Array.isArray(rows) ? rows : []);
        setBuildingsResolved(true);
      })
      .catch(() => {
        if (!mounted) return;
        setBuildings([]);
        setBuildingsResolved(true);
      });

    return () => { mounted = false; };
  }, []);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const invoiceStatus = (invoice.status || '').toLowerCase();
      const matchesStatus = statusFilter === 'all' || invoiceStatus === statusFilter;
      const matchesSearch = !keyword
        || String(invoice.id || '').toLowerCase().includes(keyword)
        || String(invoice.buildingName || '').toLowerCase().includes(keyword);

      return matchesStatus && matchesSearch;
    });
  }, [invoices, search, statusFilter]);

  const recentTransactions = useMemo(() => {
    return yearInvoices
      .filter((invoice) => (invoice.status || '').toLowerCase() === 'paid')
      .map((invoice) => ({
        id: invoice.receipt?.id || invoice.id,
        title: `Invoice paid - ${invoice.buildingName}`,
        detail: `Invoice ${formatEntityId('INV', invoice.id)}`,
        time: invoice.receipt?.timestamp || invoice.timestamp,
        amount: `${toNumber(invoice.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} Token`,
        receiptId: invoice.receipt?.id,
      }))
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 6);
  }, [yearInvoices]);

  const chartValues = useMemo(() => {
    const values = new Array(12).fill(0);
    yearInvoices.forEach((invoice) => {
      const idx = Math.max(0, Math.min(11, Number(invoice.month || 1) - 1));
      values[idx] += toNumber(invoice.tokenAmount);
    });
    return values;
  }, [yearInvoices]);

  const consumptionValues = useMemo(() => {
    const values = new Array(12).fill(0);
    const snapshot = Array.isArray(summary?.snapshot) ? summary.snapshot : [];
    snapshot.forEach((item) => {
      const idx = Math.max(0, Math.min(11, Number(month || 1) - 1));
      values[idx] += toNumber(item.totalKwh);
    });
    return values;
  }, [summary, month]);

  const maxChartValue = Math.max(...chartValues, 1);
  const maxConsumptionValue = Math.max(...consumptionValues, 1);

  const handleGenerateInvoices = async () => {
    try {
      setActionLoading('generate');
      setNotice('');
      setError('');
      const result = await generateInvoices({
        month,
        year,
        buildingName: effectiveBuilding,
      });
      await loadData(month, year);

      setNotice(`Created ${result.createdCount} invoice(s), existing ${result.existingCount}, skipped ${result.skippedCount}.`);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to generate invoices');
    } finally {
      setActionLoading('');
    }
  };

  if (error === 'No building assigned to this user') {
    return <NoBuildingAssignedPage />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-6 text-[0.85rem]">
      <div className="max-w-[1500px] mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-4 lg:p-5 shadow-sm mb-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Invoice & Payment History</h1>
              <p className="text-xs text-gray-500 mt-1">Aggregate total building energy usage and deduct marketplace energy purchases before calculating each invoice.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-gray-300 text-xs bg-white">
                {MONTH_NAMES.map((label, index) => (
                  <option key={label} value={index + 1}>{label}</option>
                ))}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-gray-300 text-xs bg-white">
                {yearOptions.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}</option>
                ))}
              </select>
              {!isUserScope && (
                <select value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-300 text-xs bg-white min-w-[180px]">
                  <option value="all">All Buildings</option>
                  {buildings.map((building) => (
                    <option key={building.id || building.name} value={building.name}>{building.name}</option>
                  ))}
                </select>
              )}
              {!isUserScope && (
                <button
                  type="button"
                  onClick={handleGenerateInvoices}
                  disabled={actionLoading === 'generate'}
                  className="h-9 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {actionLoading === 'generate' ? 'Creating...' : 'Create Invoice'}
                </button>
              )}
              <div className="h-9 px-3 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2 text-xs">
                <span className="text-blue-600">Rate</span>
                <span className="font-bold text-gray-900">{RATE_PER_KWH} Token/kWh</span>
              </div>
              <div className="text-right min-w-[92px]">
                <div className="text-xs text-gray-500">Billing Scope</div>
                <div className="text-xs font-semibold text-gray-800">{effectiveBuilding || formatPeriod(month, year)}</div>
              </div>
            </div>
          </div>
          {(error || notice) && (
            <div className={`mt-4 rounded-lg px-3 py-2 text-xs ${error ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
              {error || notice}
            </div>
          )}
        </div>

        <div className="flex flex-nowrap gap-4 overflow-x-auto mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-w-[250px]">
            <div className="text-xs text-gray-500">Total Invoices</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary?.summary?.totalInvoices || 0}</div>
            <div className="text-xs font-semibold text-gray-700">Billing batch for {formatPeriod(month, year)}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-w-[250px]">
            <div className="text-xs text-gray-500">Paid</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary?.summary?.paidInvoices || 0}</div>
            <div className="text-xs font-semibold text-gray-700">Completed wallet payments</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-w-[250px]">
            <div className="text-xs text-gray-500">Unpaid</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{summary?.summary?.unpaidInvoices || 0}</div>
            <div className="text-xs font-semibold text-gray-700">Waiting for wallet settlement</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-w-[250px]">
            <div className="text-xs text-gray-500">Total Energy Used</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {toNumber(summary?.summary?.totalConsumedKwh).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold text-gray-700">Actual electricity usage this month</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex-1 min-w-[250px]">
            <div className="text-xs text-gray-500">Market Energy Discount</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {toNumber(summary?.summary?.totalMarketPurchasedKwh).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs font-semibold text-gray-700">kWh offset by marketplace purchases</div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-green-800 mb-4">
          Monthly invoices are calculated from total building electricity usage minus energy that the building already purchased through the marketplace.
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-bold text-gray-900">Monthly Payment Trend</h2>
              <p className="text-xs text-gray-500">Token amount billed by month in {year}</p>
            </div>
            <div className="w-full h-64 border border-gray-100 rounded-lg p-3">
              <svg viewBox="0 0 680 230" className="w-full h-full">
                <line x1="34" y1="20" x2="34" y2="188" stroke="#d1d5db" strokeWidth="1" />
                <line x1="34" y1="188" x2="650" y2="188" stroke="#d1d5db" strokeWidth="1" />
                {[0, maxChartValue * 0.33, maxChartValue * 0.66, maxChartValue].map((v, i) => {
                  const y = 188 - (v / maxChartValue) * 160;
                  return (
                    <g key={i}>
                      <line x1="34" y1={y} x2="650" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                      <text x="8" y={y + 4} fontSize="10" fill="#9ca3af">{Math.round(v)}</text>
                    </g>
                  );
                })}
                <polyline
                  fill="rgba(59,130,246,0.12)"
                  stroke="none"
                  points={chartValues.map((v, i) => {
                    const x = 34 + i * 56;
                    const y = 188 - (v / maxChartValue) * 160;
                    return `${x},${y}`;
                  }).join(' ') + ' 650,188 34,188'}
                />
                <polyline
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  points={chartValues.map((v, i) => {
                    const x = 34 + i * 56;
                    const y = 188 - (v / maxChartValue) * 160;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                {MONTH_NAMES.map((label, i) => (
                  <text key={label} x={34 + i * 56} y="205" fontSize="10" fill="#9ca3af">{label}</text>
                ))}
              </svg>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-bold text-gray-900">Current Month Consumption</h2>
              <p className="text-xs text-gray-500">Total kWh usage snapshot for {formatPeriod(month, year)}</p>
            </div>
            <div className="w-full h-64 border border-gray-100 rounded-lg p-3">
              <svg viewBox="0 0 680 230" className="w-full h-full">
                <line x1="34" y1="20" x2="34" y2="188" stroke="#d1d5db" strokeWidth="1" />
                <line x1="34" y1="188" x2="650" y2="188" stroke="#d1d5db" strokeWidth="1" />
                {[0, maxConsumptionValue * 0.33, maxConsumptionValue * 0.66, maxConsumptionValue].map((v, i) => {
                  const y = 188 - (v / maxConsumptionValue) * 160;
                  return (
                    <g key={i}>
                      <line x1="34" y1={y} x2="650" y2={y} stroke="#f3f4f6" strokeWidth="1" />
                      <text x="8" y={y + 4} fontSize="10" fill="#9ca3af">{Math.round(v)}</text>
                    </g>
                  );
                })}
                {consumptionValues.map((v, i) => {
                  const height = (v / maxConsumptionValue) * 160;
                  const x = 48 + i * 48;
                  const y = 188 - height;
                  return <rect key={MONTH_NAMES[i]} x={x} y={y} width="26" height={height} rx="3" fill="#41a95a" />;
                })}
                {MONTH_NAMES.map((label, i) => (
                  <text key={label} x={48 + i * 48} y="205" fontSize="10" fill="#9ca3af">{label}</text>
                ))}
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-4 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Monthly Invoice List</h2>
              <p className="text-xs text-gray-500">Invoices show total usage, marketplace energy discount, and the remaining billable energy for the selected month.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 px-3 rounded-lg border border-gray-300 text-xs min-w-[220px]"
                placeholder="Search by invoice ID or building..."
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-300 text-xs bg-white">
                <option value="all">All Status</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] table-fixed">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[14%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Invoice ID</th>
                  <th className="w-[12%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Building</th>
                  <th className="w-[11%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Billing Period</th>
                  <th className="w-[9%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Total Used</th>
                  <th className="w-[10%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Market Discount</th>
                  <th className="w-[9%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Billable kWh</th>
                  <th className="w-[8%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Rate</th>
                  <th className="w-[10%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Total Amount</th>
                  <th className="w-[9%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Peak Usage</th>
                  <th className="w-[8%] text-center px-3 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="w-[10%] text-left px-3 py-3 text-xs font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {!loading && filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-sm text-gray-500">
                      {isUserScope
                        ? 'No invoices found for your building in this period.'
                        : 'No invoices found for this filter. Click `Create Invoice` to generate this month&apos;s billing.'}
                    </td>
                  </tr>
                )}
                {filteredInvoices.map((invoice) => {
                  const isPaid = (invoice.status || '').toLowerCase() === 'paid';
                  const receiptId = invoice.receipt?.id;
                  return (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm font-semibold text-blue-600">
                        <button
                          type="button"
                          onClick={() => {
                            if (isPaid && receiptId) {
                              history.push(`/receipt/${encodeURIComponent(receiptId)}`);
                              return;
                            }
                            history.push(`/invoice/${encodeURIComponent(invoice.id)}/pay`);
                          }}
                          className="block max-w-full truncate text-left text-blue-600 hover:underline"
                          title={invoice.id}
                        >
                          {formatEntityId('INV', invoice.id)}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={invoice.buildingName}>{invoice.buildingName}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={formatPeriod(invoice.month, invoice.year)}>{formatPeriod(invoice.month, invoice.year)}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={`${toNumber(invoice.consumedKwh ?? invoice.kWH).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`}>
                          {toNumber(invoice.consumedKwh ?? invoice.kWH).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-green-700 font-medium">
                        <span className="block truncate" title={`- ${toNumber(invoice.marketPurchasedKwh).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`}>
                          - {toNumber(invoice.marketPurchasedKwh).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 font-semibold">
                        <span className="block truncate" title={`${toNumber(invoice.billableKwh ?? invoice.kWH).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`}>
                          {toNumber(invoice.billableKwh ?? invoice.kWH).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={`${RATE_PER_KWH.toFixed(1)} Token/kWh`}>{RATE_PER_KWH.toFixed(1)} Token/kWh</span>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                        <span className="block truncate" title={`${toNumber(invoice.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} Token`}>
                          {toNumber(invoice.tokenAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })} Token
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <div>{toNumber(invoice.peakkWH).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh</div>
                        <div className="text-xs text-gray-400">{invoice.peakDate ? new Date(invoice.peakDate).toLocaleDateString() : '-'}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-semibold capitalize ${getStatusPill(invoice.status)}`}>
                          {invoice.status || 'unpaid'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {isPaid && receiptId ? (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                            onClick={() => history.push(`/receipt/${encodeURIComponent(receiptId)}`)}
                          >
                            View Receipt
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => history.push(`/invoice/${encodeURIComponent(invoice.id)}/pay`)}
                          >
                            Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Recent Invoice Payments</h2>
              <p className="text-xs text-gray-500">Latest receipt-linked invoice settlements</p>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {recentTransactions.length === 0 && (
              <div className="p-4 text-sm text-gray-500">No paid invoice transactions yet.</div>
            )}
            {recentTransactions.map((tx) => (
              <button
                type="button"
                key={tx.id}
                onClick={() => {
                  if (tx.receiptId) history.push(`/receipt/${encodeURIComponent(tx.receiptId)}`);
                }}
                className="w-full p-4 flex items-center justify-between gap-3 hover:bg-gray-50 text-left transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold bg-green-100 text-green-600">
                    P
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{tx.title}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{tx.detail} - {formatDateTime(tx.time)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">{tx.amount}</div>
                  </div>
                  <span className="text-lg text-gray-400">&rsaquo;</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

