import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getRecentBlockchainTransactions } from '../../core/data_connecter/blockExplorer';
import { formatVerificationMethod } from '../../utils/formatters';

function shortenHash(value, start = 8, end = 6) {
  if (!value) return '-';
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(2)}%`;
}

function OverviewCard({ title, value, note }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[110px] shadow-sm flex-1 min-w-[220px]">
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="mt-2 text-4xl leading-none font-bold text-gray-900">{value}</div>
      <div className="mt-2 text-xs text-gray-600">{note}</div>
    </div>
  );
}

function buildPublisherRows(transactions) {
  const groups = new Map();

  transactions.forEach((tx) => {
    const key = tx.publisherAddress || 'unknown';
    const existing = groups.get(key) || {
      address: key,
      blocks: new Set(),
      transactions: 0,
      methods: new Set(),
      latestAt: null,
      contractAddresses: new Set(),
    };

    if (tx.blockNumber != null) existing.blocks.add(Number(tx.blockNumber));
    if (tx.verificationMethod) existing.methods.add(String(tx.verificationMethod));
    if (tx.contractAddress) existing.contractAddresses.add(String(tx.contractAddress));
    existing.transactions += 1;

    const currentTime = new Date(tx.verifiedAt || tx.timestamp).getTime();
    if (!existing.latestAt || currentTime > existing.latestAt) {
      existing.latestAt = currentTime;
    }

    groups.set(key, existing);
  });

  const maxTransactions = Math.max(
    1,
    ...Array.from(groups.values()).map((item) => item.transactions),
  );

  return Array.from(groups.values())
    .map((item, index) => {
      const activityShare = (item.transactions / maxTransactions) * 100;
      return {
        id: `${item.address}-${index}`,
        name: `Publisher ${index + 1}`,
        role: item.contractAddresses.size > 0 ? 'Contract Publisher' : 'Direct Signer',
        address: item.address,
        blocks: item.blocks.size,
        transactions: item.transactions,
        performance: activityShare,
        status: item.latestAt && (Date.now() - item.latestAt) < (7 * 24 * 60 * 60 * 1000) ? 'Active' : 'Idle',
        methods: Array.from(item.methods).map(formatVerificationMethod),
        contracts: Array.from(item.contractAddresses),
      };
    })
    .sort((a, b) => b.transactions - a.transactions || b.blocks - a.blocks);
}

export default function BlockchainValidators() {
  const history = useHistory();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getRecentBlockchainTransactions(200);
      if (!response.success) {
        throw new Error(response.error || 'Failed to load blockchain publisher activity');
      }
      setTransactions(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      console.error('loadTransactions error', err);
      setTransactions([]);
      setError(err.message || 'Failed to load blockchain publisher activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const publishers = useMemo(() => buildPublisherRows(transactions), [transactions]);

  const overviewCards = useMemo(() => {
    const totalPublishers = publishers.length;
    const totalBlocks = new Set(
      transactions
        .map((tx) => Number(tx.blockNumber))
        .filter((value) => Number.isFinite(value)),
    ).size;
    const activePublishers = publishers.filter((publisher) => publisher.status === 'Active').length;
    const contractPublishers = publishers.filter((publisher) => publisher.contracts.length > 0).length;
    const avgPerformance = publishers.length
      ? publishers.reduce((sum, publisher) => sum + publisher.performance, 0) / publishers.length
      : 0;

    return [
      { title: 'Total Publishers', value: totalPublishers.toLocaleString(), note: `${activePublishers} active now` },
      { title: 'Blocks Observed', value: totalBlocks.toLocaleString(), note: 'From verified transactions' },
      { title: 'Contract Publishers', value: contractPublishers.toLocaleString(), note: 'Using VerificationRegistry' },
      { title: 'Avg Activity Share', value: formatPercent(avgPerformance), note: 'Relative recent load' },
    ];
  }, [publishers, transactions]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => history.push('/block-explorer')}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Blockchain Publishers</h1>
                <p className="mt-1 text-sm text-gray-500">Operational view of signer accounts and contract-based verification activity</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadTransactions}
              disabled={loading}
              className="h-10 rounded-lg border border-blue-500 px-4 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-4 overflow-x-auto">
          <div className="flex flex-nowrap gap-3 w-full min-w-[920px]">
            {overviewCards.map((card) => (
              <OverviewCard key={card.title} title={card.title} value={card.value} note={card.note} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Publisher Activity</h2>
              <p className="text-xs text-gray-500">Derived from recent on-chain verifications</p>
            </div>
            <button
              type="button"
              onClick={() => history.push('/block-explorer')}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Open Explorer
            </button>
          </div>

          {loading ? (
            <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">Loading blockchain publisher activity...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-600">{error}</div>
          ) : publishers.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">No verified blockchain activity has been recorded yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="w-[16%] px-3 py-3 text-xs font-semibold text-gray-500">Publisher</th>
                      <th className="w-[18%] px-3 py-3 text-xs font-semibold text-gray-500">Address</th>
                      <th className="w-[8%] px-3 py-3 text-xs font-semibold text-gray-500">Blocks</th>
                      <th className="w-[10%] px-3 py-3 text-xs font-semibold text-gray-500">Transactions</th>
                      <th className="w-[16%] px-3 py-3 text-xs font-semibold text-gray-500">Activity Share</th>
                      <th className="w-[14%] px-3 py-3 text-xs font-semibold text-gray-500">Method</th>
                      <th className="w-[12%] px-3 py-3 text-xs font-semibold text-gray-500">Contract</th>
                      <th className="w-[6%] px-3 py-3 text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {publishers.map((publisher) => (
                      <tr key={publisher.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-4">
                          <div className="truncate font-semibold text-gray-900" title={publisher.name}>{publisher.name}</div>
                          <div className="truncate text-xs text-gray-400" title={publisher.role}>{publisher.role}</div>
                        </td>
                        <td className="px-3 py-4 font-mono text-sm text-gray-700">
                          <span className="block truncate" title={publisher.address}>{shortenHash(publisher.address, 10, 8)}</span>
                        </td>
                        <td className="px-3 py-4 text-sm font-semibold text-gray-900">{publisher.blocks.toLocaleString()}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-gray-900">{publisher.transactions.toLocaleString()}</td>
                        <td className="px-3 py-4">
                          <div className="text-sm font-semibold text-gray-900">{formatPercent(publisher.performance)}</div>
                          <div className="mt-1 h-1.5 rounded-full bg-gray-200">
                            <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.max(4, publisher.performance)}%` }}></div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-700">
                          <span className="block truncate" title={publisher.methods.join(', ') || '-'}>{publisher.methods.join(', ') || '-'}</span>
                        </td>
                        <td className="px-3 py-4 font-mono text-sm text-gray-700">
                          <span className="block truncate" title={publisher.contracts[0] || '-'}>
                            {publisher.contracts.length > 0 ? shortenHash(publisher.contracts[0], 10, 8) : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            publisher.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {publisher.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-500">
                Showing {publishers.length} blockchain publisher accounts derived from recent verified transactions
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

