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
    <div className="min-w-0 flex items-start justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`min-w-0 text-right text-sm font-semibold ${mono ? 'font-mono' : ''} ${toneClass} break-words`}> 
        {value || '-'}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon, accent = 'blue', compact = false }) {
  const accentClass = accent === 'green'
    ? 'bg-emerald-50 text-emerald-600'
    : accent === 'violet'
    ? 'bg-violet-50 text-violet-600'
    : 'bg-blue-50 text-blue-600';

  return (
    <div className="min-w-0 w-full h-full flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentClass}`}>
          {icon}
        </div>
        <div className="text-sm font-semibold text-slate-600">{label}</div>
      </div>
      <div className="flex-1 flex items-center overflow-hidden">
        <div className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-slate-900 break-words max-w-full`}>{value}</div>
      </div>
      {subtitle ? <div className="mt-2 text-xs text-slate-500 truncate">{subtitle}</div> : null}
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

  // inject compact screen and print styles for transaction detail
  useEffect(() => {
    const id = 'nida-transaction-screen-print-style';
    if (document.getElementById(id)) return;
    const s = document.createElement('style');
    s.id = id;
    s.innerHTML = `
      /* compact on-screen adjustments for transaction detail */
      .transaction-detail-view { width: 100%; }
      .transaction-detail-view .max-w-7xl { max-width: 1100px !important; }
      .transaction-detail-view .max-w-5xl { max-width: 900px !important; }
      .transaction-detail-view .mx-auto { margin-left: auto !important; margin-right: auto !important; }
      .transaction-detail-view .text-4xl { font-size: 22px !important; }
      .transaction-detail-view .text-3xl { font-size: 18px !important; }
      .transaction-detail-view .text-2xl { font-size: 16px !important; }
      .transaction-detail-view .text-sm { font-size: 12px !important; }
      .transaction-detail-view .text-5xl, .transaction-detail-view .text-6xl { font-size: 26px !important; }
      .transaction-detail-view .px-6, .transaction-detail-view .py-6, .transaction-detail-view .p-6 { padding: 8px !important; }

      /* narrow main content so it doesn't stretch full width */
      .transaction-detail-view > .mx-auto { max-width: 1100px !important; }

      @media print {
        /* hide left menu and app chrome */
        .nida-navbar, #sidebar, .sidebar, .leftMenu, .leftmenu, .left-menu, .nav-bar { display: none !important; }
        body { overflow: visible !important; }
        /* page sizing */
        @page { size: A4 portrait; margin: 10mm; }
        html, body { width: 210mm; height: 297mm; }
        .transaction-detail-view { max-width: 190mm !important; margin: 0 auto !important; }
        .transaction-detail-view .text-4xl { font-size: 20px !important; }
        .transaction-detail-view .text-3xl { font-size: 16px !important; }
        .transaction-detail-view .text-2xl { font-size: 14px !important; }
        .transaction-detail-view .text-sm { font-size: 11px !important; }
      }
    `;
    document.head.appendChild(s);
    return () => { if (s && s.parentNode) s.parentNode.removeChild(s); };
  }, []);

    // add print page break rules separately to ensure page grouping
    useEffect(() => {
      const id = 'nida-transaction-print-pages';
      if (document.getElementById(id)) return;
      const s = document.createElement('style');
      s.id = id;
      s.innerHTML = `
        @media print {
          .transaction-detail-view .nida-page { page-break-inside: avoid; }
          .transaction-detail-view .nida-page.page-1 { page-break-after: always; }
          .transaction-detail-view .nida-page.page-2 { page-break-after: always; }
          /* ensure timeline starts on its own page */
          .transaction-detail-view .nida-page.page-3 { page-break-before: always; }

          /* Tighter typography/padding for page-2 to keep action links on same page */
          .transaction-detail-view .nida-page.page-2 { font-size: 12px !important; }
          .transaction-detail-view .nida-page.page-2 .text-2xl { font-size: 16px !important; }
          .transaction-detail-view .nida-page.page-2 .text-sm { font-size: 10px !important; }
          .transaction-detail-view .nida-page.page-2 .text-lg { font-size: 13px !important; }
          .transaction-detail-view .nida-page.page-2 .px-6 { padding-left: 6px !important; padding-right: 6px !important; }
          .transaction-detail-view .nida-page.page-2 .py-5 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .transaction-detail-view .nida-page.page-2 .rounded-2xl { padding: 6px !important; }
          .transaction-detail-view .nida-page.page-2 .mb-5 { margin-bottom: 6px !important; }
          .transaction-detail-view .nida-page.page-2 .inline-flex { padding: 6px !important; font-size: 11px !important; }

          /* Slightly tighter typography/padding for page-1 to avoid spilling into page-2 */
          .transaction-detail-view .nida-page.page-1 { font-size: 13px !important; }
          .transaction-detail-view .nida-page.page-1 .text-4xl { font-size: 20px !important; }
          .transaction-detail-view .nida-page.page-1 .text-3xl { font-size: 16px !important; }
          .transaction-detail-view .nida-page.page-1 .text-2xl { font-size: 14px !important; }
          .transaction-detail-view .nida-page.page-1 .text-sm { font-size: 11px !important; }
          .transaction-detail-view .nida-page.page-1 .text-5xl { font-size: 30px !important; }
          .transaction-detail-view .nida-page.page-1 .px-6 { padding-left: 6px !important; padding-right: 6px !important; }
          .transaction-detail-view .nida-page.page-1 .py-5 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .transaction-detail-view .nida-page.page-1 .mb-6 { margin-bottom: 8px !important; }
          .transaction-detail-view .nida-page.page-1 .rounded-3xl { padding: 8px !important; }
          .transaction-detail-view .nida-page.page-1 .my-5 { margin-top: 6px !important; margin-bottom: 6px !important; }
          .transaction-detail-view .nida-page.page-1 .inline-flex { font-size: 12px !important; padding: 6px !important; }
        }
      `;
      document.head.appendChild(s);
      return () => { if (s && s.parentNode) s.parentNode.removeChild(s); };
    }, []);

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
    <div className="transaction-detail-view min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="nida-page page-1">
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

          <section className="min-w-0 w-full rounded-3xl border border-slate-200 bg-white shadow-sm">
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
        </div>

        <div className="nida-page page-2">
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <SafetyCertificateOutlined />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Blockchain Proof of Record</h2>
                <p className="text-sm text-slate-500">Immutable proof and on-chain verification metadata</p>
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

              <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch auto-rows-fr">
                <div className="flex-1 w-full h-full overflow-hidden">
                  <StatCard compact label="Block Number" value={view.blockNumber} subtitle="Confirmed block" icon={<SafetyCertificateOutlined />} accent="violet" />
                </div>
                <div className="flex-1 w-full h-full overflow-hidden">
                  <StatCard compact label="Verification" value={view.verification.label} subtitle={view.verificationMethod} icon={<CheckCircleFilled />} accent="green" />
                </div>
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

        <div className="nida-page page-3">
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
    </div>
  );
}
