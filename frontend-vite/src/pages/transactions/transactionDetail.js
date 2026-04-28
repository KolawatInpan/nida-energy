import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useHistory, Link } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CopyOutlined,
  FilePdfOutlined,
  LinkOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import {
  getTransactionById,
  getTransactionVerificationPreview,
  verifyTransaction,
} from '../../core/data_connecter/transactionDetail';
import {
  formatEntityId,
  formatToken,
} from '../../utils/formatters';
import { buildTransactionDetailView, buildTransactionTimeline } from '../../utils/transactionMappers';

function InfoRow({ label, value, mono = false, tone = 'default' }) {
  const toneClass = tone === 'success'
    ? 'text-emerald-600'
    : tone === 'danger'
    ? 'text-rose-600'
    : 'text-slate-900';

  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-right text-sm font-semibold ${mono ? 'font-mono' : ''} ${toneClass}`}>
        {value || '-'}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon, accent = 'blue' }) {
  const accentClass = accent === 'green'
    ? 'bg-emerald-50 text-emerald-600'
    : accent === 'violet'
    ? 'bg-violet-50 text-violet-600'
    : 'bg-blue-50 text-blue-600';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentClass}`}>
          {icon}
        </div>
        <div className="text-sm font-semibold text-slate-600">{label}</div>
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      {subtitle ? <div className="mt-2 text-xs text-slate-500">{subtitle}</div> : null}
    </div>
  );
}

function TimelineItem({ title, description, time, complete, tags = [] }) {
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
        {complete ? <CheckCircleFilled /> : <ClockCircleOutlined />}
      </div>
      <div className="absolute left-6 top-12 h-full w-px bg-slate-200 last:hidden" />
      <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-bold text-slate-900">{title}</div>
            <div className="mt-1 text-sm text-slate-600">{description}</div>
          </div>
          <div className="text-sm font-medium text-slate-400">{time || '-'}</div>
        </div>
        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function copyText(value) {
  if (!value) return;
  navigator.clipboard?.writeText(String(value)).catch(() => {});
}

export default function TransactionDetail() {
  const { txid } = useParams();
  const history = useHistory();
  const [transaction, setTransaction] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchTransaction = async () => {
    try {
      setLoading(true);
      setError(null);

      const [response, previewResponse] = await Promise.all([
        getTransactionById(txid),
        getTransactionVerificationPreview(txid),
      ]);

      if (response.success && response.data) {
        setTransaction(response.data);
      } else {
        setError(response.error || 'Transaction not found');
      }

      if (previewResponse.success && previewResponse.data) {
        setPreview(previewResponse.data);
      } else {
        setPreview(null);
      }
    } catch (err) {
      console.error('Error loading transaction:', err);
      setError('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (txid) {
      fetchTransaction();
    }
  }, [txid]);

  const view = useMemo(() => buildTransactionDetailView(transaction, txid), [transaction, txid]);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      setVerifyResult(null);
      const response = await verifyTransaction(txid, { force: true });
      if (!response.success) {
        throw new Error(response.error || 'Failed to verify transaction');
      }
      setVerifyResult(response.data || null);
      await fetchTransaction();
    } catch (err) {
      console.error('handleVerify error', err);
      setError(err.message || 'Failed to verify transaction');
    } finally {
      setVerifying(false);
    }
  };

  const timeline = useMemo(() => buildTransactionTimeline(view, preview), [preview, view]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="mt-4 font-medium text-slate-600">Loading transaction details...</p>
        </div>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => history.push('/transaction')}
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeftOutlined />
            Back to Transactions
          </button>
          <div className="rounded-3xl border border-red-200 bg-white p-10 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-900">Unable to load transaction</div>
            <div className="mt-2 text-slate-600">{error || 'Transaction data is unavailable'}</div>
          </div>
        </div>
      </div>
    );
  }

  const isSuccess = view.verification.label === 'Verified' || Boolean(view.txHash);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start gap-4">
            <button
              onClick={() => history.push('/transaction')}
              className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeftOutlined />
            </button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Transaction Details & Receipt Confirmation</h1>
              <p className="mt-1 text-sm text-slate-500">Verification of token transaction ID: {formatEntityId('TXN', txid)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FilePdfOutlined />
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <PrinterOutlined />
              Print
            </button>
          </div>
        </div>

        <div className={`mb-6 rounded-3xl px-6 py-6 text-white shadow-sm ${isSuccess ? 'bg-emerald-600' : 'bg-amber-500'}`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-2xl">
                <CheckCircleFilled />
              </div>
              <div>
                <div className="text-sm font-semibold text-white/80">Transaction Status</div>
                <div className="text-4xl font-bold">{isSuccess ? 'Success' : 'Pending'}</div>
                <div className="mt-1 text-sm text-white/85">
                  {isSuccess ? 'Blockchain verification completed successfully' : 'Waiting for blockchain verification'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-white/80">Confirmation Time</div>
              <div className="text-3xl font-bold">{view.confirmationSeconds != null ? `${view.confirmationSeconds} seconds` : 'Pending'}</div>
              <div className="mt-1 text-sm text-white/85">{view.verifiedAtLabel}</div>
            </div>
          </div>
        </div>

        {verifyResult ? (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${verifyResult.verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {verifyResult.verified
              ? `Verification successful${verifyResult.txHash ? `: ${verifyResult.txHash}` : '.'}`
              : (verifyResult.reason || 'Verification has not been published yet.')}
          </div>
        ) : null}

        <div className="flex flex-col gap-6 xl:flex-row">
          <section className="min-w-0 w-full xl:basis-1/2 xl:flex-1 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <WalletOutlined />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Financial Summary</h2>
                  <p className="text-sm text-slate-500">Transaction amount and financial record summary</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="text-sm text-slate-500">Building Name</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{view.buildingName}</div>
                <div className="mt-1 text-sm text-slate-500">SNID: {view.snid}</div>
              </div>

              <InfoRow label="Transaction Type" value={view.type} />
              <InfoRow label="Wallet ID" value={view.walletId} mono />

              <div className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm text-slate-500">Token Amount</div>
                <div className={`mt-2 text-5xl font-bold ${view.signedAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {view.signedAmount >= 0 ? '+' : '-'}{formatToken(view.amount)}
                </div>
                <div className="mt-2 text-sm text-slate-500">Token</div>
              </div>

              <InfoRow label="Transaction Date" value={view.createdDateLabel} />
              <InfoRow label="Transaction Time" value={view.createdTimeLabel} />
              <InfoRow label="Confirmation Time" value={view.confirmationSeconds != null ? `${view.confirmationSeconds} seconds` : 'Pending'} tone={isSuccess ? 'success' : 'default'} />
              <InfoRow label="Status" value={view.verification.label} tone={isSuccess ? 'success' : 'default'} />

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <FilePdfOutlined />
                  Download Official Receipt (PDF)
                </button>
                {view.canVerify ? (
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={verifying}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {verifying ? 'Verifying...' : 'Verify on Chain'}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="min-w-0 w-full xl:basis-1/2 xl:flex-1 rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <SafetyCertificateOutlined />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Blockchain Proof of Record</h2>
                  <p className="text-sm text-slate-500">Immutable proof and on-chain verification metadata</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="font-semibold text-slate-900">Data Integrity Confirmation</div>
                <div className="mt-1 text-sm text-slate-600">
                  {view.payloadHash
                    ? 'The receipt hash is stored for blockchain verification. This helps prove the transaction record has not been altered.'
                    : 'A payload hash will appear here once verification metadata is available.'}
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">Receipt Hash (Data Hash)</div>
                  {view.payloadHash ? (
                    <button type="button" onClick={() => copyText(view.payloadHash)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                      <CopyOutlined />
                      Copy
                    </button>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700 break-all">
                  {view.payloadHash || '-'}
                </div>
              </div>

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">Transaction Hash (TxHash)</div>
                  {view.txHash ? (
                    <button type="button" onClick={() => copyText(view.txHash)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                      <CopyOutlined />
                      Copy
                    </button>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700 break-all">
                  {view.txHash || '-'}
                </div>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <StatCard label="Block Number" value={view.blockNumber} subtitle="Confirmed block" icon={<SafetyCertificateOutlined />} accent="violet" />
                <StatCard label="Verification" value={view.verification.label} subtitle={view.verificationMethod} icon={<CheckCircleFilled />} accent="green" />
              </div>

              <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-sm text-slate-500">Confirmation Time</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{view.verifiedAtLabel}</div>
                <div className="mt-1 text-sm text-emerald-700">
                  {view.confirmationSeconds != null ? `${view.confirmationSeconds} seconds after transaction` : 'Awaiting confirmation'}
                </div>
              </div>

              <div className="mb-5 grid gap-4 md:grid-cols-2">
                <InfoRow label="Gas Used" value={view.gasUsed} />
                <InfoRow label="Gas Price" value={view.effectiveGasPrice} />
              </div>

              <InfoRow label="Publisher Address" value={view.publisherAddress || '-'} mono />
              <InfoRow label="Contract Address" value={view.contractAddress || '-'} mono />
              <InfoRow label="Chain ID" value={preview?.chainId || '-'} />

              {view.txHash ? (
                <div className="mt-6">
                  <Link
                    to={`/blockchain/compare/${encodeURIComponent(txid)}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                  >
                    <LinkOutlined />
                    View on Local Blockchain Comparison
                  </Link>
                  {view.explorerUrl ? (
                    <a
                      href={view.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <LinkOutlined />
                      Open External Explorer
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ClockCircleOutlined />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Transaction Timeline</h2>
              <p className="text-sm text-slate-500">Step-by-step verification process</p>
            </div>
          </div>

          <div>
            {timeline.map((item) => (
              <TimelineItem key={`${item.title}-${item.time}`} {...item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
