import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ReloadOutlined, HistoryOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';
import { getAllTransactions } from '../../core/data_connecter/api_caller';
import {
  formatEntityId,
  formatToken,
  formatVerificationStatus,
  getTransactionDisplayType,
} from '../../utils/formatters';

const TRADE_LABELS = {
  MARKETPLACE_PURCHASE: 'Buy from Pool',
  MARKETPLACE_SALE: 'Sell to Pool',
};

function normalizeTradingRows(rows) {
  return rows
    .filter((item) => ['MARKETPLACE_PURCHASE', 'MARKETPLACE_SALE'].includes(String(item?.type || '').toUpperCase()))
    .map((item) => {
      const rawType = String(item?.type || '').toUpperCase();
      const timestamp = item?.timestamp ? new Date(item.timestamp) : null;
      const verification = formatVerificationStatus(item);

      return {
        id: String(item?.txid || ''),
        timestamp,
        timestampLabel: timestamp
          ? timestamp.toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-',
        tradeType: TRADE_LABELS[rawType] || getTransactionDisplayType(item),
        tokenAmount: Number(item?.tokenAmount || 0),
        buildingName: item?.buildingName || 'N/A',
        snid: item?.snid || '-',
        hash: item?.txHash || '',
        explorerUrl: item?.explorerUrl || '',
        verification,
      };
    })
    .sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
}

export default function TradingHistory() {
  const history = useHistory();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadTradingTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAllTransactions();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setTransactions(normalizeTradingRows(rows));
    } catch (err) {
      console.error('Error loading trading history:', err);
      setTransactions([]);
      setError('Failed to load trading history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTradingTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return transactions.filter((item) => {
      const haystack = `${item.id} ${item.tradeType} ${item.buildingName} ${item.snid} ${item.hash}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (start && (!item.timestamp || item.timestamp < start)) return false;
      if (end && (!item.timestamp || item.timestamp > end)) return false;
      return true;
    });
  }, [transactions, search, startDate, endDate]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trading History</h1>
          <p className="mt-1 text-sm text-slate-600">Audit historical marketplace trades with blockchain verification details.</p>
        </div>
        <button
          type="button"
          onClick={loadTradingTransactions}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <ReloadOutlined />
          Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
              <HistoryOutlined />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Trading History</h2>
              <p className="text-sm text-slate-500">Marketplace purchase and sale transactions only</p>
            </div>
          </div>

          <div className="flex flex-nowrap gap-4 overflow-x-auto">
            <label className="block min-w-[240px] flex-1">
              <div className="mb-2 text-sm font-semibold text-slate-700">Start Date</div>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block min-w-[240px] flex-1">
              <div className="mb-2 text-sm font-semibold text-slate-700">End Date</div>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block min-w-[280px] flex-[1.2]">
              <div className="mb-2 text-sm font-semibold text-slate-700">Search Transaction</div>
              <div className="relative">
                <SearchOutlined className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search TXN ID or hash..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">TXN ID</th>
                <th className="px-6 py-4">Execution Date</th>
                <th className="px-6 py-4">Trade Type</th>
                <th className="px-6 py-4">Building</th>
                <th className="px-6 py-4">Token Amount</th>
                <th className="px-6 py-4">Blockchain Verified</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">Loading trading history...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm text-red-600">{error}</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-500">No marketplace trading transactions found</td>
                </tr>
              ) : (
                filteredTransactions.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 text-sm text-slate-700 transition hover:bg-blue-50/50">
                    <td className="px-6 py-4 font-semibold text-slate-900">{formatEntityId('TXN', item.id)}</td>
                    <td className="px-6 py-4">{item.timestampLabel}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        item.tradeType === 'Buy from Pool'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {item.tradeType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{item.buildingName}</div>
                      <div className="mt-1 text-xs text-slate-500">SNID: {item.snid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${item.tradeType === 'Buy from Pool' ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {formatToken(item.tokenAmount)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Token transferred</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.verification.className}`}>
                        {item.verification.label}
                      </div>
                      <div className="mt-2 text-xs text-blue-600">
                        {item.hash ? (item.hash.length > 14 ? `${item.hash.slice(0, 8)}...${item.hash.slice(-4)}` : item.hash) : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => history.push(`/transactions/${encodeURIComponent(item.id)}`)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-600"
                      >
                        <LinkOutlined />
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-sm text-slate-500">
          <div>Showing {filteredTransactions.length} of {transactions.length} marketplace transactions</div>
          <div className="text-slate-400">Historical marketplace purchase and sale records</div>
        </div>
      </section>
    </div>
  );
}
