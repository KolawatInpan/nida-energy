import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getAllTransactions } from '../../core/data_connecter/api_caller';
import { getBlockchainTransactionByHash } from '../../core/data_connecter/blockExplorer';
import { getTransactionById, getTransactionVerificationPreview } from '../../core/data_connecter/transactionDetail';
import {
  formatEntityId,
  formatToken,
  formatVerificationMethod,
  getTransactionDisplayType,
} from '../../utils/formatters';
import { buildTransactionCompareRows, buildTransactionCompareSummary } from '../../utils/transactionMappers';

function shortenValue(value, start = 10, end = 8) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= start + end) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function CompareCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-4 py-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`text-right text-sm font-semibold text-gray-900 ${mono ? 'break-all font-mono' : ''}`}>
        {value || '-'}
      </span>
    </div>
  );
}

export default function TransactionBlockchainCompare() {
  const history = useHistory();
  const { txid: routeTxid } = useParams();

  const [transactions, setTransactions] = useState([]);
  const [selectedTxid, setSelectedTxid] = useState(routeTxid || '');
  const [searchTxid, setSearchTxid] = useState(routeTxid || '');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [preview, setPreview] = useState(null);
  const [chainTransaction, setChainTransaction] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadTransactions = async () => {
      try {
        setListLoading(true);
        const response = await getAllTransactions();
        if (!mounted) return;
        const items = Array.isArray(response?.data) ? response.data : [];
        const sorted = [...items].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        setTransactions(sorted);
      } catch (err) {
        if (!mounted) return;
        console.error('loadTransactions error', err);
        setTransactions([]);
      } finally {
        if (mounted) setListLoading(false);
      }
    };

    loadTransactions();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setSelectedTxid(routeTxid || '');
    setSearchTxid(routeTxid || '');
  }, [routeTxid]);

  useEffect(() => {
    let mounted = true;

    const loadCompareData = async () => {
      if (!selectedTxid) {
        setTransaction(null);
        setPreview(null);
        setChainTransaction(null);
        setError('');
        return;
      }

      try {
        setLoading(true);
        setError('');

        const [txResponse, previewResponse] = await Promise.all([
          getTransactionById(selectedTxid),
          getTransactionVerificationPreview(selectedTxid),
        ]);

        if (!mounted) return;

        if (!txResponse.success || !txResponse.data) {
          throw new Error(txResponse.error || 'Transaction not found');
        }

        setTransaction(txResponse.data);
        setPreview(previewResponse.success ? previewResponse.data : null);

        const txHash = txResponse.data?.txHash;
        if (txHash) {
          const chainResponse = await getBlockchainTransactionByHash(txHash);
          if (!mounted) return;
          setChainTransaction(chainResponse.success ? chainResponse.data : null);
        } else {
          setChainTransaction(null);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('loadCompareData error', err);
        setError(err.message || 'Failed to load comparison data');
        setTransaction(null);
        setPreview(null);
        setChainTransaction(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCompareData();
    return () => { mounted = false; };
  }, [selectedTxid]);

  const selectedTransactionOption = useMemo(() => {
    if (!selectedTxid) return null;
    return transactions.find((item) => item.txid === selectedTxid) || null;
  }, [selectedTxid, transactions]);

  const compareRows = useMemo(() => buildTransactionCompareRows(transaction, preview), [transaction, preview]);

  const summary = useMemo(
    () => buildTransactionCompareSummary(compareRows, transaction, preview),
    [compareRows, transaction, preview]
  );

  const handleSearch = () => {
    const nextTxid = searchTxid.trim();
    if (!nextTxid) {
      setError('Enter or select a transaction ID to compare');
      return;
    }
    history.push(`/blockchain/compare/${encodeURIComponent(nextTxid)}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">DB vs Blockchain Transaction Compare</h1>
            <p className="mt-1 text-sm text-gray-500">
              Compare the original transaction stored in the database against the payload and on-chain proof linked to blockchain verification.
            </p>
          </div>
          <Link
            to="/block-explorer"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Back to Explorer
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-gray-700">Select Transaction</label>
              <select
                value={selectedTxid}
                onChange={(e) => {
                  setSelectedTxid(e.target.value);
                  setSearchTxid(e.target.value);
                  if (e.target.value) {
                    history.push(`/blockchain/compare/${encodeURIComponent(e.target.value)}`);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">{listLoading ? 'Loading transactions...' : 'Choose transaction ID'}</option>
                {transactions.map((item) => (
                  <option key={item.txid} value={item.txid}>
                    {formatEntityId('TX', item.txid)} | {item.buildingName || 'N/A'} | {getTransactionDisplayType(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-2 block text-sm font-semibold text-gray-700">Or Search by Transaction ID</label>
              <div className="flex gap-2">
                <input
                  value={searchTxid}
                  onChange={(e) => setSearchTxid(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  placeholder="Paste transaction ID"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Compare
                </button>
              </div>
            </div>
          </div>
          {selectedTransactionOption ? (
            <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Selected: <span className="font-semibold">{selectedTransactionOption.buildingName || 'N/A'}</span> |{' '}
              <span className="font-semibold">{getTransactionDisplayType(selectedTransactionOption)}</span> |{' '}
              <span className="font-mono">{formatEntityId('TX', selectedTransactionOption.txid)}</span>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600 shadow-sm">
            Loading transaction comparison...
          </div>
        ) : transaction ? (
          <>
            <div className="mb-6 overflow-x-auto">
              <div className="flex min-w-[920px] flex-nowrap gap-4">
                <div className="min-h-[122px] min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Verification Status</div>
                  <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${summary.verification?.className || 'bg-gray-100 text-gray-700'}`}>
                    {summary.verification?.label || 'Unknown'}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">Current database verification state</div>
                </div>
                <div className="min-h-[122px] min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Matched Fields</div>
                  <div className="mt-3 text-3xl font-bold text-gray-900">{summary.matched}</div>
                  <div className="mt-2 text-xs text-gray-500">Out of {summary.comparable} comparable fields</div>
                </div>
                <div className="min-h-[122px] min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mismatched Fields</div>
                  <div className={`mt-3 text-3xl font-bold ${summary.mismatched > 0 ? 'text-red-600' : 'text-gray-900'}`}>{summary.mismatched}</div>
                  <div className="mt-2 text-xs text-gray-500">Values that need review</div>
                </div>
                <div className="min-h-[122px] min-w-[220px] flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Payload Snapshot</div>
                  <div className="mt-3 text-sm font-semibold text-gray-900">
                    {summary.payloadSource === 'stored' ? 'Stored Snapshot' : 'Not Stored'}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {summary.payloadSource === 'stored'
                      ? 'Immutable compare source available'
                      : 'Old record: original payload snapshot unavailable'}
                  </div>
                </div>
              </div>
            </div>

            {summary.payloadSource !== 'stored' ? (
              <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                This transaction does not have a stored verification payload snapshot yet. The original on-chain payload cannot be reconstructed from the current database row alone, so field-by-field comparison is unavailable for this older record.
              </div>
            ) : null}

            <div className="mb-6 flex flex-col gap-6 xl:flex-row">
              <div className="min-w-0 w-full xl:basis-1/2 xl:flex-1">
                <CompareCard title="Database Record" subtitle="Original application transaction data stored in the system">
                  <div className="space-y-3">
                    <InfoRow label="Transaction ID" value={formatEntityId('TX', transaction.txid)} mono />
                    <InfoRow label="Building" value={transaction.buildingName || '-'} />
                    <InfoRow label="SNID" value={transaction.snid || '-'} />
                    <InfoRow label="Wallet ID" value={transaction.walletId || '-'} />
                    <InfoRow label="Type" value={getTransactionDisplayType(transaction)} />
                    <InfoRow label="Token Amount" value={`${formatToken(transaction.tokenAmount)} Token`} />
                    <InfoRow label="Status" value={transaction.status || '-'} />
                    <InfoRow label="Recorded At" value={formatDateTime(transaction.timestamp)} />
                  </div>
                </CompareCard>
              </div>

              <div className="min-w-0 w-full xl:basis-1/2 xl:flex-1">
                <CompareCard title="Blockchain-Linked Record" subtitle="Payload prepared for verification and blockchain metadata">
                  <div className="space-y-3">
                    <InfoRow label="Verification Method" value={formatVerificationMethod(transaction.verificationMethod)} />
                    <InfoRow label="Payload Hash" value={transaction.payloadHash || preview?.payloadHash || '-'} mono />
                    <InfoRow label="Chain Tx Hash" value={transaction.txHash || '-'} mono />
                    <InfoRow label="Publisher Address" value={transaction.publisherAddress || chainTransaction?.publisherAddress || '-'} mono />
                    <InfoRow label="Contract Address" value={transaction.contractAddress || chainTransaction?.contractAddress || '-'} mono />
                    <InfoRow label="Block Number" value={transaction.blockNumber ?? chainTransaction?.blockNumber ?? '-'} />
                    <InfoRow label="Verified At" value={formatDateTime(transaction.verifiedAt || chainTransaction?.verifiedAt)} />
                    <InfoRow label="Preview Enabled" value={preview?.enabled ? 'Enabled' : 'Disabled'} />
                  </div>
                </CompareCard>
              </div>
            </div>

            <CompareCard title="Field-by-Field Comparison" subtitle="Check whether the core DB values match the blockchain verification payload">
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Field</th>
                      <th className="w-[32%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Database Value</th>
                      <th className="w-[32%] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Blockchain Payload Value</th>
                      <th className="w-[16%] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareRows.map((row) => (
                      <tr key={row.label} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">{row.label}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="break-all rounded-lg bg-gray-50 px-3 py-2">{String(row.db ?? '-')}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <div className="break-all rounded-lg bg-gray-50 px-3 py-2">{String(row.chain ?? '-')}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            !row.available
                              ? 'bg-gray-100 text-gray-700'
                              : row.match
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {!row.available ? 'UNAVAILABLE' : row.match ? 'MATCH' : 'MISMATCH'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CompareCard>

            <div className="mt-6 flex flex-col gap-6 xl:flex-row">
              <div className="min-w-0 w-full xl:basis-1/2 xl:flex-1">
                <CompareCard title="Verification Preview Payload" subtitle="Exact payload prepared before publishing to blockchain">
                  {preview?.payload ? (
                    <pre className="overflow-x-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(preview.payload, null, 2)}</pre>
                  ) : (
                    <div className="rounded-lg bg-gray-50 px-4 py-4 text-sm text-gray-500">No verification preview payload available.</div>
                  )}
                </CompareCard>
              </div>

              <div className="min-w-0 w-full xl:basis-1/2 xl:flex-1">
                <CompareCard title="Quick Actions" subtitle="Open related pages to inspect the same transaction from different views">
                  <div className="space-y-3">
                    <Link
                      to={`/transactions/${encodeURIComponent(transaction.txid)}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      <span>Open App Transaction Detail</span>
                      <span>{formatEntityId('TX', transaction.txid)}</span>
                    </Link>
                    {transaction.txHash ? (
                      <Link
                        to={`/block-explorer/tx/${encodeURIComponent(transaction.txHash)}`}
                        className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <span>Open Local Blockchain Detail</span>
                        <span>{shortenValue(transaction.txHash, 10, 8)}</span>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
                        This transaction has not been published on-chain yet, so there is no local blockchain detail page to open.
                      </div>
                    )}
                    <Link
                      to="/transaction"
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <span>Back to Transaction List</span>
                      <span>View all</span>
                    </Link>
                  </div>
                </CompareCard>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <div className="text-lg font-semibold text-gray-800">Choose a transaction to compare</div>
            <p className="mt-2 text-sm text-gray-500">
              Select a transaction ID from the list or paste one manually to compare the database record against its blockchain-linked data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

