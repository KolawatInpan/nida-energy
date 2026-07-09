import React, { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import { useHistory, useParams } from 'react-router-dom';
import { formatEnergy, formatEntityId, formatToken } from '../../utils/formatters';
import { buildReceiptView } from '../../utils/invoiceReceiptMappers';
import { getApiBase } from '../../core/data_connecter/apiBase';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB');
}

export default function ReceiptDetail() {
  const history = useHistory();
  const { id } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadReceipt = async () => {
      try {
        setLoading(true);
        setError('');

        const apiBase = getApiBase();
        const res = await axios.get(`${apiBase}/receipts/${id}`);

        if (!mounted) return;
        setReceipt(res.data || null);
      } catch (err) {
        if (!mounted) return;
        setReceipt(null);
        setError(err?.response?.data?.error || err.message || 'Failed to load receipt');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadReceipt();
    return () => { mounted = false; };
  }, [id]);

  const view = useMemo(() => {
    return buildReceiptView(receipt, id);
  }, [receipt, id]);
  // inject screen-friendly compact styles for receipt view
  useEffect(() => {
    const id = 'nida-receipt-screen-style';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.innerHTML = `
        /* compact on-screen receipt styles */
        .receipt-view { max-width: 760px; margin: 0 auto; }
        .receipt-view .receipt-watermark { font-size: 48px !important; opacity: .06 !important; }
        @media (min-width: 1024px) { .receipt-view .receipt-watermark { font-size: 100px !important; } }
        .receipt-view .text-4xl { font-size: 18px !important; }
        .receipt-view .text-3xl { font-size: 16px !important; }
        .receipt-view .text-2xl { font-size: 14px !important; }
        .receipt-view .text-xl { font-size: 13px !important; }
        .receipt-view .px-6, .receipt-view .py-7, .receipt-view .lg\:px-10, .receipt-view .lg\:py-9 { padding: 6px !important; }
        .receipt-view .rounded-[28px] { border-radius: 8px !important; }
        .receipt-view table { font-size: 12px !important; }
        .receipt-view .mx-auto { max-width: 760px !important; }
      `;
      document.head.appendChild(s);
    }
  }, []);

  const receiptRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load script'));
      document.head.appendChild(s);
    });
  }

  async function generatePdf(closeAfter = false) {
    if (!receiptRef.current) return;
    setGenerating(true);
    try {
      // try primary CDN
      try {
        await loadScript('https://unpkg.com/html2pdf.js@0.9.2/dist/html2pdf.bundle.min.js');
      } catch (err) {
        // fallback CDN
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.2/html2pdf.bundle.min.js');
      }

      // inject small-print styles to reduce oversized display elements
      const styleId = 'nida-pdf-style';
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.innerHTML = `
          /* Compact PDF styles for receipt */
          .nida-pdf-small { font-size:12px !important; line-height:1.15 !important; }
          .nida-pdf-small .text-4xl { font-size:20px !important; }
          .nida-pdf-small .text-3xl { font-size:18px !important; }
          .nida-pdf-small .text-2xl { font-size:16px !important; }
          .nida-pdf-small .text-xl { font-size:14px !important; }
          .nida-pdf-small .text-[110px], .nida-pdf-small .lg\\:text-[180px] { font-size:36px !important; }
          .nida-pdf-small .rounded-[28px] { border-radius:8px !important; }
          .nida-pdf-small table { font-size:12px !important; }
          .nida-pdf-small .px-6, .nida-pdf-small .py-5, .nida-pdf-small .py-4 { padding:6px !important; }
        `;
        document.head.appendChild(styleEl);
      }

      const el = receiptRef.current;
      el.classList.add('nida-pdf-small');

      // Compute element size and convert px -> mm for jsPDF
      const pxToMm = 0.264583333; // 1px @96dpi = 0.264583333 mm
      const rect = el.getBoundingClientRect();
      const widthPx = Math.ceil(rect.width);
      // use scrollHeight to capture full content height
      const heightPx = Math.ceil(el.scrollHeight || rect.height);
      const widthMm = Math.ceil(widthPx * pxToMm);
      const heightMm = Math.ceil(heightPx * pxToMm);

      const opt = {
        margin: [5, 5, 5, 5],
        filename: `${view?.receiptNumber || id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, width: widthPx, height: heightPx },
        jsPDF: { unit: 'mm', format: [widthMm, heightMm], orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      };

      // eslint-disable-next-line no-undef
      if (!window.html2pdf) throw new Error('html2pdf not available');
      // eslint-disable-next-line no-undef
      const task = window.html2pdf().set(opt).from(el).save();
      if (task && task.then) await task;

      // cleanup
      el.classList.remove('nida-pdf-small');
      if (styleEl) styleEl.parentNode && styleEl.parentNode.removeChild(styleEl);

      if (closeAfter) {
        try { window.close(); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('PDF generation failed', err);
      try {
        alert('ไม่สามารถสร้าง PDF ได้โดยตรง — จะเปิดหน้าพิมพ์สำรองให้คุณ (ใช้ Print → Save as PDF)');
        const printWin = window.open('', '_blank', 'noopener');
        if (printWin && receiptRef.current) {
          printWin.document.write('<html><head><title>Receipt</title>');
          // inline minimal styles to keep compact
          printWin.document.write('<style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px} .nida-compact{max-width:800px;margin:0 auto;padding:10px;}</style>');
          printWin.document.write('</head><body><div class="nida-compact">');
          printWin.document.write(receiptRef.current.innerHTML);
          printWin.document.write('</div></body></html>');
          printWin.document.close();
          printWin.focus();
          // give it a moment to render
          setTimeout(() => { try { printWin.print(); } catch (e) { /* ignore */ } }, 600);
        }
      } catch (e) { /* ignore */ }
    } finally {
      setGenerating(false);
    }
  }

  async function printSaveAsPdf(closeAfter = false) {
    // inject print CSS to hide sidebar and other layout elements
    const id = 'nida-print-hide-side';
    let styleEl = document.getElementById(id);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.innerHTML = `
        @media print {
          /* hide app chrome */
          .nida-navbar, #sidebar, .sidebar, .leftMenu, .leftmenu, .left-menu, .nav-bar { display: none !important; }
          body { overflow: visible !important; }
          /* page sizing */
          @page { size: A4 portrait; margin: 10mm; }
          html, body { width: 210mm; height: 297mm; }
          /* make receipt use printable width and compact fonts */
          .receipt-view { max-width: 190mm !important; margin: 0 auto !important; padding: 0 !important; }
          .receipt-view * { -webkit-print-color-adjust: exact; }
          .receipt-view { font-size: 12px !important; line-height: 1.08 !important; }
          .receipt-view .text-4xl { font-size: 18px !important; }
          .receipt-view .text-3xl { font-size: 16px !important; }
          .receipt-view .text-2xl { font-size: 14px !important; }
          .receipt-view .text-xl { font-size: 12px !important; }
          .receipt-view .receipt-watermark { font-size: 40px !important; opacity: .06 !important; }
          .receipt-view table { font-size: 11px !important; }
          /* avoid table rows splitting across pages */
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          /* Page partitioning: Received From -> page 1, Receipt Info + Total -> page 2, rest -> page 3 */
          .received-from { page-break-after: always; break-after: page; }
          .receipt-information { page-break-inside: avoid; }
          .total-amount { page-break-inside: avoid; page-break-after: always; break-after: page; }
          .payment-breakdown { page-break-before: always; break-before: page; }
          /* footer should be on page 4 */
          .document-footer { page-break-before: always; break-before: page; }
          /* Reduce paddings that cause overflow */
          .receipt-view .px-6, .receipt-view .py-7, .receipt-view .lg\:px-10, .receipt-view .lg\:py-9 { padding: 4px !important; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    try {
      window.print();
    } finally {
      // remove style after a short delay to allow print dialog to capture styles
      setTimeout(() => {
        if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        if (closeAfter) {
          try { window.close(); } catch (e) { /* ignore */ }
        }
      }, 1000);
    }
  }

  function downloadPdfServer(closeAfter = false) {
    try {
      const apiBase = getApiBase();
      const url = `${apiBase}/receipts/${encodeURIComponent(id)}/pdf`;
      // open in new tab to trigger browser download
      const w = window.open(url, '_blank', 'noopener');
      if (closeAfter) {
        setTimeout(() => { try { window.close(); } catch (e) { /* ignore */ } }, 1200);
      }
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#f3f6f4] p-6 text-gray-600">Loading receipt...</div>;
  }

  if (!receipt) {
    return <div className="min-h-screen bg-[#f3f6f4] p-6 text-red-600">{error || 'Receipt not found'}</div>;
  }

  const isPaid = view.status === 'PAID';


  return (
    <div className="receipt-view min-h-screen bg-[#eef3f0] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => history.push('/invoice')}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Back to Invoices
          </button>
          <button
            type="button"
            onClick={() => printSaveAsPdf(false)}
            disabled={generating}
            className={`rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm ${generating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-emerald-800'}`}
          >
            {generating ? 'Preparing...' : 'Download PDF'}
          </button>
        </div>

        <div ref={receiptRef} className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="h-2 w-full bg-emerald-700" />

          <div className="relative px-6 py-7 lg:px-10 lg:py-9">
            <div className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-none select-none">
              <div className="receipt-watermark text-[110px] font-black tracking-[0.18em] text-emerald-600/10 lg:text-[180px]">
                {isPaid ? 'PAID' : 'PENDING'}
              </div>
            </div>

            <div className="relative z-10 space-y-8">
              <div className="flex flex-col gap-6 border-b border-gray-200 pb-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl text-emerald-700">
                    🍃
                  </div>
                  <div>
                    <div className="text-2xl font-extrabold tracking-tight text-slate-900 lg:text-3xl">NIDA SMART GRID</div>
                    <div className="mt-2 text-lg font-semibold text-slate-600">Energy Management Dept.</div>
                    <div className="text-base text-slate-500">Institute of Development Administration</div>
                    <div className="text-base text-slate-500">148 Seri Thai Rd, Bangkok, Thailand</div>
                  </div>
                </div>

                <div className="text-left lg:text-right">
                  <div className="text-4xl font-black tracking-tight text-emerald-800 lg:text-5xl">OFFICIAL RECEIPT</div>
                  <div className="mt-3 text-lg text-slate-500">Original Copy for Customer</div>
                  <div className="mt-5 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                    {isPaid ? 'Payment Successful' : 'Awaiting Payment'}
                  </div>
                </div>
              </div>

                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="min-w-0 w-full rounded-3xl border border-gray-200 bg-white/95 p-6 lg:basis-1/2 lg:flex-1 received-from">
                  <div className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Received From</div>
                  <div className="space-y-6">
                    <div>
                      <div className="text-sm text-slate-400">Building / Location</div>
                      <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{view.buildingName}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500">{view.location}</div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-sm text-slate-400">Smart Meter ID</div>
                        <div className="mt-2 rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700">
                          {view.smartMeterId}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-400">SNID</div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{view.snid}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-slate-400">Customer Type</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Institutional</span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{view.customerType}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 w-full rounded-3xl border border-gray-200 bg-white/95 p-6 lg:basis-1/2 lg:flex-1 receipt-information">
                  <div className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Receipt Information</div>
                  <div className="space-y-4 text-base">
                    {[
                      ['Receipt Number', view.receiptNumber],
                      ['Ref. Invoice No.', view.invoiceNumber],
                      ['Date Paid', formatDate(view.receiptTimestamp)],
                      ['Time', `${formatTime(view.receiptTimestamp)} ICT`],
                      ['Billing Period', view.billingPeriod],
                      ['Payment Method', view.paymentMethod],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                        <span className="text-slate-500">{label}</span>
                        <span className="text-right text-xl font-bold tracking-tight text-slate-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative rounded-[28px] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-emerald-50 to-white p-6 lg:p-7 total-amount">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Total Amount Received</div>
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <span className="text-4xl font-black tracking-tight text-emerald-900 lg:text-5xl">
                        {formatToken(view.totalPaidWithFee)}
                      </span>
                      <span className="pb-1 text-xl font-bold text-emerald-700">TOKENS</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      Equivalent to: {formatToken(view.equivalentThb)} THB
                    </div>
                  </div>

                  <div className="hidden h-24 w-px bg-emerald-200 lg:block lg:mx-3" />

                  <div className="lg:min-w-[320px] lg:text-right">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Payment Status</div>
                    <div className="mt-3 inline-flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-2xl font-black text-emerald-700 shadow-sm">
                      <span className="inline-flex h-4 w-4 rounded-full bg-emerald-500" />
                      <span>{isPaid ? 'SUCCESSFUL' : 'PENDING'}</span>
                      <span className="text-emerald-500">✓</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 payment-breakdown">
                <div className="flex items-center gap-3">
                  <div className="text-xl text-slate-400">☰</div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">Payment Breakdown</div>
                    <div className="text-sm text-slate-500">Detailed energy billing and marketplace adjustment</div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[26px] border border-gray-200 bg-white">
                  <table className="w-full table-fixed">
                    <thead className="bg-slate-50 text-left text-sm font-bold text-slate-600">
                      <tr>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-4 py-4 text-right">Volume</th>
                        <th className="px-4 py-4 text-right">Unit Price</th>
                        <th className="px-6 py-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-slate-700">
                      <tr>
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-slate-900">{view.energySourceLabel}</div>
                          <div className="mt-1 text-slate-500">{view.energySourceDesc}</div>
                        </td>
                        <td className="px-4 py-5 text-right font-semibold">{formatEnergy(view.consumedKwh)} kWh</td>
                        <td className="px-4 py-5 text-right font-semibold">{formatToken(view.rate)}</td>
                        <td className="px-6 py-5 text-right font-semibold">{formatToken(view.gridEnergyCost)} THB</td>
                      </tr>
                      {!view.isMarketplace && (
                      <tr>
                        <td className="px-6 py-5 align-top">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">P2P Energy Sold</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Credit</span>
                          </div>
                          <div className="mt-1 text-slate-500">Discount from surplus generation</div>
                        </td>
                        <td className="px-4 py-5 text-right font-semibold">{formatEnergy(view.marketDiscountKwh)} kWh</td>
                        <td className="px-4 py-5 text-right font-semibold">{formatToken(view.rate)}</td>
                        <td className="px-6 py-5 text-right font-semibold text-emerald-700">- {formatToken(view.discountTokenAmount)} THB</td>
                      </tr>
                      )}
                      <tr>
                        <td className="px-6 py-5 align-top">
                          <div className="font-semibold text-slate-900">P2P Market Service Fee</div>
                          <div className="mt-1 text-slate-500">Platform operational charge ({(view.adminFeeRate * 100).toFixed(1)}%)</div>
                        </td>
                        <td className="px-4 py-5 text-right font-semibold">-</td>
                        <td className="px-4 py-5 text-right font-semibold">-</td>
                        <td className="px-6 py-5 text-right font-semibold">{formatToken(view.adminFeeAmount)} THB</td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50">
                        <td colSpan="3" className="px-6 py-5 text-right text-3xl font-black tracking-tight text-slate-900">
                          Net Total Paid
                        </td>
                        <td className="px-6 py-5 text-right text-3xl font-black tracking-tight text-emerald-800">
                          {formatToken(view.totalPaidWithFee)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-sm italic text-slate-400">
                  * Amounts are inclusive of token settlement fees where applicable.
                </div>
              </div>

              <div className="document-footer">
                <div className="grid gap-6 pt-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
                <div className="space-y-6">
                  <div className="max-w-sm border-b border-gray-300 pb-3">
                    <div className="text-3xl italic text-blue-800">System Generated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">Authorized Signature</div>
                    <div className="text-slate-500">NIDA Finance Dept.</div>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-4 lg:items-end">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-slate-800 bg-white text-4xl">
                    ▦
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="text-2xl font-bold text-slate-900">Scan to Verify</div>
                    <div className="text-slate-500">blockchain.nida.ac.th</div>
                  </div>
                </div>
                </div>

                <div className="border-t border-dashed border-gray-300 pt-7 text-center">
                <div className="inline-flex items-center gap-3 rounded-full bg-emerald-50 px-5 py-2 text-lg font-bold text-emerald-700">
                  <span>🛡️</span>
                  <span>Blockchain Verified Document</span>
                </div>
                <div className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-500">
                  This receipt is auto-generated and permanently recorded on the NIDA Smart Grid Blockchain.
                  Modification of this document invalidates its authenticity.
                </div>
                <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="mr-3 font-bold text-slate-400">TxRef</span>
                  <span className="break-all font-mono">{view.transactionReference}</span>
                </div>
                <div className="mt-5 text-sm text-slate-400">
                  Generated by NIDA Smart Grid Platform
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
