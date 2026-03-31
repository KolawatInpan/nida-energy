import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { formatToken, formatVerificationMethod, getTransactionDisplayType } from '../../utils/formatters';
import { getBlockchainTransactionByHash, getRecentBlockchainTransactions } from '../../core/data_connecter/blockExplorer';

function shortenHash(value, start = 10, end = 8) {
  if (!value) return '-';
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatRelativeTime(value) {
  if (!value) return '-';

  const now = Date.now();
  const time = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((now - time) / 1000));

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatGasFeeEth(gasUsed, effectiveGasPrice) {
  const gas = Number(gasUsed || 0);
  const price = Number(effectiveGasPrice || 0);

  if (!Number.isFinite(gas) || !Number.isFinite(price) || gas <= 0 || price <= 0) {
    return '-';
  }

  const eth = (gas * price) / 1e18;
  return eth.toFixed(6);
}

function exportRowsAsCsv(rows) {
  const headers = ['txHash', 'blockNumber', 'from', 'to', 'type', 'verificationMethod', 'contractAddress', 'valueToken', 'gasFeeEth', 'status', 'time'];
  const lines = [
    headers.join(','),
    ...rows.map((row) => ([
      row.txHash,
      row.blockNumber ?? '',
      row.from,
      row.to,
      row.type,
      row.verificationMethod,
      row.contractAddress || '',
      row.value,
      row.gasFee,
      row.status,
      row.timestamp,
    ].map((item) => `"${String(item ?? '').replace(/"/g, '""')}"`).join(','))),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `blockchain-transactions-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function OverviewCard({ title, value, subtitle }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[110px] shadow-sm flex-1 min-w-[220px]">
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="mt-2 text-4xl leading-none font-bold text-gray-900">{value}</div>
      <div className="mt-2 text-xs text-gray-600">{subtitle}</div>
    </div>
  );
}

export default function BlockExplorer() {
  const history = useHistory();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getRecentBlockchainTransactions(100);
      if (!response.success) {
        throw new Error(response.error || 'Failed to load blockchain transactions');
      }
      setTransactions(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      console.error('loadTransactions error', err);
      setError(err.message || 'Failed to load blockchain transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleSearch = async () => {
    const query = txSearch.trim();
    if (!query) {
      setSearchError('Enter a txHash to search');
      return;
    }

    try {
      setSearching(true);
      setSearchError('');
      const response = await getBlockchainTransactionByHash(query);

      const item = response.data?.item || response.data || null;
      if (!response.success || !item?.txHash) {
        setSearchError(response.error || 'Transaction not found on the local blockchain');
        return;
      }

      history.push(`/block-explorer/tx/${encodeURIComponent(item.txHash)}`);
    } catch (err) {
      setSearchError(err.message || 'Transaction not found on the local blockchain');
    } finally {
      setSearching(false);
    }
  };

  const rows = useMemo(() => {
    return transactions.map((tx) => ({
      id: tx.txid,
      txHash: tx.txHash || '',
      blockNumber: tx.blockNumber ?? '-',
      from: tx.publisherAddress || '-',
      to: tx.publisherAddress || '-',
      type: getTransactionDisplayType(tx),
      verificationMethod: formatVerificationMethod(tx.verificationMethod),
      value: formatToken(tx.tokenAmount),
      gasFee: formatGasFeeEth(tx.gasUsed, tx.effectiveGasPrice),
      status: String(tx.verificationStatus || (tx.txHash ? 'VERIFIED' : 'UNVERIFIED')).toUpperCase(),
      timestamp: tx.verifiedAt || tx.timestamp,
      timestampLabel: formatRelativeTime(tx.verifiedAt || tx.timestamp),
      explorerUrl: tx.explorerUrl || null,
      contractAddress: tx.contractAddress || null,
    }));
  }, [transactions]);

  const filteredRows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      [
        row.txHash,
        row.from,
        row.to,
        row.type,
        row.verificationMethod,
        String(row.blockNumber),
        row.status,
      ].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [rows, filter]);

  const networkStats = useMemo(() => {
    const blockNumbers = rows
      .map((row) => Number(row.blockNumber))
      .filter((value) => Number.isFinite(value));

    const currentBlock = blockNumbers.length ? Math.max(...blockNumbers) : '-';
    const uniqueBlocks = new Set(blockNumbers).size;
    const uniquePublishers = new Set(rows.map((row) => row.from).filter(Boolean)).size;
    const contractTransactions = rows.filter((row) => row.contractAddress).length;
    const avgGas = rows.length
      ? rows.reduce((sum, row) => sum + Number(row.gasFee === '-' ? 0 : row.gasFee), 0) / rows.length
      : 0;

    return [
      { title: 'Current Block', value: currentBlock === '-' ? '-' : currentBlock.toLocaleString(), subtitle: `${uniqueBlocks} recent blocks` },
      { title: 'Verified TX', value: rows.length.toLocaleString(), subtitle: 'Recorded on-chain' },
      { title: 'Publishers', value: uniquePublishers.toLocaleString(), subtitle: `${contractTransactions} contract-based verifications` },
      { title: 'Avg Gas Fee', value: avgGas > 0 ? `${avgGas.toFixed(6)} ETH` : '-', subtitle: 'From recent verified tx' },
    ];
  }, [rows]);

  const latestBlocks = useMemo(() => {
    const grouped = new Map();

    rows.forEach((row) => {
      const key = String(row.blockNumber);
      if (key === '-' || grouped.has(key)) return;

      grouped.set(key, {
        block: row.blockNumber,
        time: row.timestampLabel,
        validator: shortenHash(row.from, 8, 6),
        txs: rows.filter((item) => String(item.blockNumber) === key).length,
        status: 'Confirmed',
      });
    });

    return Array.from(grouped.values())
      .sort((a, b) => Number(b.block) - Number(a.block))
      .slice(0, 5);
  }, [rows]);

  return (
    <div className="max-w-[1400px] mx-auto p-5 bg-gray-50">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Blockchain Explorer</h1>
          <p className="text-sm text-gray-500">Verified transaction activity recorded on the blockchain</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-[360px]">
            <div className="flex gap-2">
              <input
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  if (searchError) setSearchError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="Search by txHash"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {searchError ? (
              <div className="mt-2 text-xs text-red-600">{searchError}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={loadTransactions}
            disabled={loading}
            className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-5 overflow-x-auto">
        <div className="flex flex-nowrap gap-3 w-full min-w-[920px]">
          {networkStats.map((stat) => (
            <OverviewCard key={stat.title} title={stat.title} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Latest Blocks</h2>
            <p className="text-xs text-gray-500">Blocks inferred from recent verified transactions</p>
          </div>
        </div>

        {latestBlocks.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">No verified blockchain data yet.</div>
        ) : (
          <div className="space-y-3">
            {latestBlocks.map((block) => (
              <div key={block.block} className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <div>
                  <div className="font-bold text-gray-900">Block #{block.block}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {block.time} | Publisher {block.validator}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-800">{block.txs} TXs</div>
                  <div className="text-xs text-green-600">{block.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Recent Transactions</h2>
            <p className="text-xs text-gray-500">Latest verified transactions on the blockchain</p>
          </div>
          <div className="flex gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter hash / address / block"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => exportRowsAsCsv(filteredRows)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">Loading blockchain transactions...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] table-fixed">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="w-[16%] px-3 py-3 text-left text-xs font-semibold text-gray-600">TX Hash</th>
                    <th className="w-[7%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Block</th>
                    <th className="w-[14%] px-3 py-3 text-left text-xs font-semibold text-gray-600">From</th>
                    <th className="w-[14%] px-3 py-3 text-left text-xs font-semibold text-gray-600">To</th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Method</th>
                    <th className="w-[9%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Value</th>
                    <th className="w-[8%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Gas Fee</th>
                    <th className="w-[9%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                    <th className="w-[8%] px-3 py-3 text-left text-xs font-semibold text-gray-600">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm">
                        <Link
                          to={`/block-explorer/tx/${encodeURIComponent(tx.txHash)}`}
                          className="block truncate font-mono text-blue-600 hover:underline"
                          title={tx.txHash}
                        >
                          {shortenHash(tx.txHash)}
                        </Link>
                      </td>
                      <td className="truncate px-3 py-3 text-sm text-gray-700" title={String(tx.blockNumber)}>{tx.blockNumber}</td>
                      <td className="px-3 py-3 text-sm font-mono text-gray-700">
                        <span className="block truncate" title={tx.from}>{shortenHash(tx.from)}</span>
                      </td>
                      <td className="px-3 py-3 text-sm font-mono text-gray-700">
                        <span className="block truncate" title={tx.contractAddress || tx.to}>{shortenHash(tx.contractAddress || tx.to)}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-800">
                        <span className="block truncate" title={tx.type}>{tx.type}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={tx.verificationMethod}>{tx.verificationMethod}</span>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-gray-900">
                        <span className="block truncate" title={`${tx.value} Token`}>{tx.value} Token</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span className="block truncate" title={tx.gasFee === '-' ? '-' : `${tx.gasFee} ETH`}>
                          {tx.gasFee === '-' ? '-' : `${tx.gasFee} ETH`}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span
                          className="inline-block max-w-full truncate rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 align-middle"
                          title={tx.status}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        <span className="block truncate" title={String(tx.timestamp)}>{tx.timestampLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 border-t border-gray-200 pt-4 text-sm text-gray-600">
              Showing {filteredRows.length} of {rows.length} verified blockchain transactions
            </div>
          </>
        )}
      </div>
    </div>
  );
}

