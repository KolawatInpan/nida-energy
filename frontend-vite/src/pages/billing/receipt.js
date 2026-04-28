import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useHistory, useParams } from 'react-router-dom';
import { formatEnergy, formatEntityId, formatToken } from '../../utils/formatters';
import { buildReceiptView } from '../../utils/invoiceReceiptMappers';

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

        const apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';
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

  if (loading) {
    return <div className="min-h-screen bg-[#f3f6f4] p-6 text-gray-600">Loading receipt...</div>;
  }

  if (!receipt) {
    return <div className="min-h-screen bg-[#f3f6f4] p-6 text-red-600">{error || 'Receipt not found'}</div>;
  }

  const isPaid = view.status === 'PAID';

  return (
    <div className="min-h-screen bg-[#eef3f0] px-4 py-6 lg:px-8">
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
            onClick={() => window.print()}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            Print Receipt
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
          <div className="h-2 w-full bg-emerald-700" />

          <div className="relative px-6 py-7 lg:px-10 lg:py-9">
            <div className="absolute inset-x-0 top-[38%] flex justify-center pointer-events-none select-none">
              <div className="text-[110px] font-black tracking-[0.18em] text-emerald-600/10 lg:text-[180px]">
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
                    <div className="text-base text-slate-500">118 Seri Thai Rd, Bangkok, Thailand</div>
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
                <div className="min-w-0 w-full rounded-3xl border border-gray-200 bg-white/95 p-6 lg:basis-1/2 lg:flex-1">
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

                <div className="min-w-0 w-full rounded-3xl border border-gray-200 bg-white/95 p-6 lg:basis-1/2 lg:flex-1">
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

              <div className="relative rounded-[28px] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-emerald-50 to-white p-6 lg:p-7">
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

              <div className="space-y-4">
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
                          <div className="font-semibold text-slate-900">Grid Energy Import</div>
                          <div className="mt-1 text-slate-500">Source: National Grid (PEA/MEA)</div>
                        </td>
                        <td className="px-4 py-5 text-right font-semibold">{formatEnergy(view.consumedKwh)} kWh</td>
                        <td className="px-4 py-5 text-right font-semibold">{formatToken(view.rate)}</td>
                        <td className="px-6 py-5 text-right font-semibold">{formatToken(view.gridEnergyCost)} THB</td>
                      </tr>
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
  );
}
