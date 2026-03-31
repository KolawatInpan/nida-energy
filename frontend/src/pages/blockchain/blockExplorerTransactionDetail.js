import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getBlockchainTransactionByHash } from '../../core/data_connecter/blockExplorer';
import { formatEntityId, formatToken, formatVerificationMethod, getTransactionDisplayType, toSafeNumber } from '../../utils/formatters';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function formatGasFeeEth(gasUsed, effectiveGasPrice) {
  const gas = Number(gasUsed || 0);
  const price = Number(effectiveGasPrice || 0);

  if (!Number.isFinite(gas) || !Number.isFinite(price) || gas <= 0 || price <= 0) {
    return '-';
  }

  return ((gas * price) / 1e18).toFixed(6);
}

export default function BlockExplorerTransactionDetail() {
  const history = useHistory();
  const { txHash } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await getBlockchainTransactionByHash(txHash);
        if (!mounted) return;

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Blockchain transaction not found');
        }

        setTransaction(response.data);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || 'Failed to load blockchain transaction');
        setTransaction(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [txHash]);

  const view = useMemo(() => {
    if (!transaction) return null;

    return {
      txHash: transaction.txHash || txHash,
      appTxId: transaction.txid,
      buildingName: transaction.buildingName || '-',
      walletId: transaction.walletId || '-',
      snid: transaction.snid || '-',
      type: getTransactionDisplayType(transaction),
      value: formatToken(transaction.tokenAmount),
      verificationMethod: formatVerificationMethod(transaction.verificationMethod),
      verificationStatus: String(transaction.verificationStatus || (transaction.txHash ? 'VERIFIED' : 'UNVERIFIED')).toUpperCase(),
      blockNumber: transaction.blockNumber ?? '-',
      publisherAddress: transaction.publisherAddress || '-',
      contractAddress: transaction.contractAddress || '-',
      payloadHash: transaction.payloadHash || '-',
      explorerUrl: transaction.explorerUrl || null,
      verifiedAt: formatDateTime(transaction.verifiedAt),
      timestamp: formatDateTime(transaction.timestamp),
      gasUsed: transaction.gasUsed || '-',
      gasFeeEth: formatGasFeeEth(transaction.gasUsed, transaction.effectiveGasPrice),
      chainId: transaction.chainId ?? '-',
      effectiveGasPrice: transaction.effectiveGasPrice || '-',
      tokenAmount: toSafeNumber(transaction.tokenAmount),
    };
  }, [transaction, txHash]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6 text-gray-600">Loading blockchain transaction...</div>;
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <button
          type="button"
          onClick={() => history.push('/block-explorer')}
          className="mb-4 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          Back to Explorer
        </button>
        <div className="rounded-xl border border-red-200 bg-white p-6 text-red-600">
          {error || 'Blockchain transaction not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Local Blockchain Transaction</h1>
            <p className="mt-1 text-sm text-gray-500">Detailed on-chain record from your local explorer</p>
          </div>
          <button
            type="button"
            onClick={() => history.push('/block-explorer')}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Back to Explorer
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Transaction Hash</div>
            <div className="mt-2 break-all font-mono text-lg font-bold text-gray-900">{view.txHash}</div>
          </div>
          <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</div>
              <div className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">{view.verificationStatus}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Block Number</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{view.blockNumber}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Value</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{view.value} Token</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Chain Record</h2>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-gray-500">From / Publisher</div>
                <div className="mt-1 break-all font-mono text-gray-900">{view.publisherAddress}</div>
              </div>
              <div>
                <div className="text-gray-500">To / Contract</div>
                <div className="mt-1 break-all font-mono text-gray-900">{view.contractAddress}</div>
              </div>
              <div>
                <div className="text-gray-500">Verification Method</div>
                <div className="mt-1 font-semibold text-gray-900">{view.verificationMethod}</div>
              </div>
              <div>
                <div className="text-gray-500">Chain ID</div>
                <div className="mt-1 font-semibold text-gray-900">{view.chainId}</div>
              </div>
              <div>
                <div className="text-gray-500">Gas Used</div>
                <div className="mt-1 font-semibold text-gray-900">{view.gasUsed}</div>
              </div>
              <div>
                <div className="text-gray-500">Gas Fee</div>
                <div className="mt-1 font-semibold text-gray-900">{view.gasFeeEth === '-' ? '-' : `${view.gasFeeEth} ETH`}</div>
              </div>
              <div>
                <div className="text-gray-500">Effective Gas Price</div>
                <div className="mt-1 break-all font-mono text-gray-900">{view.effectiveGasPrice}</div>
              </div>
              <div>
                <div className="text-gray-500">Verified At</div>
                <div className="mt-1 font-semibold text-gray-900">{view.verifiedAt}</div>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0 lg:basis-1/2 lg:flex-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Application Record</h2>
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-gray-500">App Transaction ID</div>
                <div className="mt-1 break-all font-mono text-gray-900">{formatEntityId('TX', view.appTxId)}</div>
              </div>
              <div>
                <div className="text-gray-500">Building</div>
                <div className="mt-1 font-semibold text-gray-900">{view.buildingName}</div>
              </div>
              <div>
                <div className="text-gray-500">Wallet ID</div>
                <div className="mt-1 font-semibold text-gray-900">{view.walletId}</div>
              </div>
              <div>
                <div className="text-gray-500">SNID</div>
                <div className="mt-1 font-semibold text-gray-900">{view.snid}</div>
              </div>
              <div>
                <div className="text-gray-500">Type</div>
                <div className="mt-1 font-semibold text-gray-900">{view.type}</div>
              </div>
              <div>
                <div className="text-gray-500">Recorded At</div>
                <div className="mt-1 font-semibold text-gray-900">{view.timestamp}</div>
              </div>
              <div>
                <div className="text-gray-500">Payload Hash</div>
                <div className="mt-1 break-all font-mono text-gray-900">{view.payloadHash}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/blockchain/compare/${encodeURIComponent(view.appTxId)}`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Compare DB vs Blockchain
              </Link>
              <Link
                to={`/transactions/${encodeURIComponent(view.appTxId)}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Open App Transaction
              </Link>
              <Link
                to="/block-explorer"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to Explorer
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

