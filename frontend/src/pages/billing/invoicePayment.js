import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getInvoiceById, payInvoice } from '../../core/data_connecter/invoice';
import { getWalletBalance } from '../../core/data_connecter/wallet';
import { formatEnergy, formatToken } from '../../utils/formatters';

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatPeriod(invoice) {
  if (!invoice?.month || !invoice?.year) return '-';
  const start = new Date(invoice.year, invoice.month - 1, 1);
  const end = new Date(invoice.year, invoice.month, 0);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString();
}

export default function InvoicePayment() {
  const history = useHistory();
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('detail');
  const [agreed, setAgreed] = useState(false);
  const [paymentResult, setPaymentResult] = useState(null);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getInvoiceById(id);
      setInvoice(data);

      if (data?.toWId) {
        const walletRes = await getWalletBalance(data.toWId);
        setWalletBalance(toNumber(walletRes?.data?.balance));
      } else {
        setWalletBalance(0);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load invoice payment details');
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const view = useMemo(() => {
    const tokenAmount = toNumber(invoice?.tokenAmount);
    const totalKwh = toNumber(invoice?.consumedKwh ?? invoice?.kWH);
    const marketPurchasedKwh = toNumber(invoice?.marketPurchasedKwh);
    const billableKwh = toNumber(invoice?.billableKwh ?? invoice?.kWH);
    const peakKwh = Math.min(toNumber(invoice?.peakkWH), billableKwh);
    const baseKwh = Math.max(billableKwh - peakKwh, 0);
    const rate = billableKwh > 0 ? tokenAmount / billableKwh : 1;
    const peakCost = peakKwh * rate;
    const baseCost = tokenAmount - peakCost;
    const isPaid = (invoice?.status || '').toLowerCase() === 'paid';

    return {
      invoiceId: invoice?.id || id,
      buildingName: invoice?.buildingName || '-',
      billingPeriod: formatPeriod(invoice),
      totalKwh,
      marketPurchasedKwh,
      billableKwh,
      tokenAmount,
      peakKwh,
      baseKwh,
      rate,
      peakCost,
      baseCost,
      isPaid,
      receiptId: invoice?.receipt?.id || paymentResult?.receipt?.id || '',
    };
  }, [invoice, id, paymentResult]);

  const handleProceedToConfirm = () => {
    if (!agreed) {
      setError('Please agree to the terms before proceeding.');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirmPayment = async () => {
    try {
      setPaying(true);
      setError('');
      const result = await payInvoice(id);
      setPaymentResult(result);
      setInvoice((current) => ({ ...(current || {}), ...(result?.invoice || {}) }));
      setWalletBalance(toNumber(result?.wallet?.tokenBalance));
      setStep('success');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-100 p-6 text-gray-600">Loading invoice payment details...</div>;
  }

  if (!invoice) {
    return <div className="min-h-screen bg-gray-100 p-6 text-red-600">{error || 'Invoice not found'}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 lg:p-6">
      <div className="max-w-[1300px] mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => history.push('/invoice')}
              className="px-4 h-10 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Back
            </button>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
                {step === 'success' ? 'Payment Successful' : `Payment for Invoice ${view.invoiceId}`}
              </h1>
              <p className="text-gray-500 mt-1">
                {step === 'success'
                  ? 'Your invoice has been paid successfully'
                  : `Complete payment for ${view.billingPeriod}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-3 rounded-2xl border border-blue-200 bg-blue-50 min-w-[180px]">
              <div className="text-xs text-gray-500">Building Treasury</div>
              <div className="text-xl font-bold text-gray-900">
                {formatToken(walletBalance)} <span className="text-sm font-medium text-gray-500">Token</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Today</div>
              <div className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'detail' && (
          <>
            <div className="flex flex-col xl:flex-row gap-6">
              <div className="w-full min-w-0 xl:basis-1/2 xl:flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Invoice Details</h2>
                    <p className="text-xs text-gray-500">Billing period, building usage, marketplace energy discount, and final billable energy</p>
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-xs font-semibold ${view.isPaid ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                    {view.isPaid ? 'Paid' : 'Unpaid'}
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-gray-400">Invoice ID</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{view.invoiceId}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Billing Period</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{view.billingPeriod}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Total Energy Used</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{formatEnergy(view.totalKwh)} kWh</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Market Energy Discount</div>
                      <div className="text-2xl font-bold text-green-600 mt-1">- {formatEnergy(view.marketPurchasedKwh)} kWh</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Billable Energy</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{formatEnergy(view.billableKwh)} kWh</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Rate (Token/kWh)</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{formatToken(view.rate)} Token</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Energy Consumption Breakdown</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-2xl bg-blue-50 px-4 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">Net Energy Charged</div>
                          <div className="text-sm text-gray-500">Energy remaining after marketplace discount</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">{formatEnergy(view.baseKwh)} kWh</div>
                          <div className="text-xs text-gray-500">{formatToken(view.baseCost)} Token</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-green-50 px-4 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">Marketplace Energy Discount</div>
                          <div className="text-sm text-gray-500">Energy already purchased from the marketplace and deducted from the utility bill</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-700">- {formatEnergy(view.marketPurchasedKwh)} kWh</div>
                          <div className="text-xs text-gray-500">Discount applied before billing</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl bg-orange-50 px-4 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">Peak Daily Usage</div>
                          <div className="text-sm text-gray-500">Highest single-day energy usage in this month</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">{formatEnergy(view.peakKwh)} kWh</div>
                          <div className="text-xs text-gray-500">{formatToken(view.peakCost)} Token</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6 space-y-3">
                    <div className="flex items-center justify-between text-base text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatToken(view.tokenAmount)} Token</span>
                    </div>
                    <div className="flex items-center justify-between text-base text-gray-600">
                      <span>Service Fee</span>
                      <span>0 Token</span>
                    </div>
                    <div className="flex items-center justify-between text-base text-blue-600">
                      <span>Late Payment Fee (5%)</span>
                      <span>0 Token</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                      <span className="text-2xl font-bold text-gray-900">Total Amount Due</span>
                      <span className="text-3xl font-bold text-blue-600">{formatToken(view.tokenAmount)} Token</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full min-w-0 xl:basis-1/2 xl:flex-1 space-y-6">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Payment Summary</h2>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className={`rounded-2xl px-4 py-4 border text-sm ${view.isPaid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                      <div className="font-semibold">{view.isPaid ? 'Payment Completed' : 'Payment Unpaid'}</div>
                      <div className="text-sm opacity-80 mt-1">
                        {view.isPaid ? 'This invoice has already been paid.' : 'Use the building wallet balance to complete this payment.'}
                      </div>
                    </div>
                    <div className="space-y-3 text-base">
                      <div className="flex items-center justify-between"><span className="text-gray-500">Invoice Amount</span><span className="font-semibold">{formatToken(view.tokenAmount)} Token</span></div>
                      <div className="flex items-center justify-between"><span className="text-gray-500">Late Fee (5%)</span><span className="font-semibold text-blue-600">+0 Token</span></div>
                      <div className="flex items-center justify-between border-t border-gray-200 pt-4"><span className="text-xl font-bold text-gray-900">Total to Pay</span><span className="text-2xl font-bold text-blue-600">{formatToken(view.tokenAmount)} Token</span></div>
                    </div>

                    {view.isPaid ? (
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-gray-100 text-gray-700 font-semibold py-4 hover:bg-gray-200"
                        onClick={() => history.push(`/receipt/${encodeURIComponent(view.receiptId)}`)}
                      >
                        View Receipt
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="w-full rounded-2xl bg-blue-600 text-white font-semibold py-4 hover:bg-blue-700 disabled:opacity-60"
                        onClick={handleProceedToConfirm}
                        disabled={walletBalance < view.tokenAmount}
                      >
                        Pay {formatToken(view.tokenAmount)} Token Now
                      </button>
                    )}

                    {walletBalance < view.tokenAmount && !view.isPaid && (
                      <div className="text-sm text-red-600">Insufficient wallet balance for this payment.</div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
                    <p className="text-sm text-gray-500">Select how you want to pay</p>
                  </div>
                  <div className="p-6">
                    <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 px-5 py-4">
                      <div className="font-semibold text-lg text-gray-900">Digital Wallet</div>
                      <div className="text-sm text-gray-500 mt-1">Current Balance: {formatToken(walletBalance)} Token</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {!view.isPaid && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-5 h-5" />
                  <div>
                    <div className="text-lg font-semibold text-gray-900">I agree to the Terms and Conditions</div>
                    <div className="text-sm text-gray-500 mt-1">
                      By checking this box and proceeding with the payment, you acknowledge that this wallet deduction will be recorded for transparency and security.
                    </div>
                  </div>
                </label>
              </div>
            )}
          </>
        )}

        {step === 'confirm' && (
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-3xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-4xl font-bold">!</div>
            <h2 className="text-2xl font-bold text-gray-900 mt-6">Confirm Invoice Payment</h2>
            <p className="text-gray-500 mt-2">Please confirm you want to pay this invoice from the building wallet.</p>

            <div className="mt-8 rounded-2xl bg-gray-50 border border-gray-200 p-6 text-left space-y-3">
              <div className="flex items-center justify-between text-base"><span className="text-gray-500">Invoice</span><span className="font-semibold">{view.invoiceId}</span></div>
              <div className="flex items-center justify-between text-base"><span className="text-gray-500">Building</span><span className="font-semibold">{view.buildingName}</span></div>
              <div className="flex items-center justify-between text-base"><span className="text-gray-500">Billing Period</span><span className="font-semibold">{view.billingPeriod}</span></div>
              <div className="flex items-center justify-between text-base"><span className="text-gray-500">Wallet Balance</span><span className="font-semibold">{formatToken(walletBalance)} Token</span></div>
              <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-xl">
                <span className="font-bold text-gray-900">Amount to Pay</span>
                <span className="font-bold text-blue-600">{formatToken(view.tokenAmount)} Token</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button type="button" className="px-6 py-3 rounded-2xl border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setStep('detail')}>
                Back
              </button>
              <button
                type="button"
                className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                onClick={handleConfirmPayment}
                disabled={paying}
              >
                {paying ? 'Processing...' : `Confirm Pay ${formatToken(view.tokenAmount)} Token`}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-10 text-center">
              <div className="w-24 h-24 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center text-3xl font-bold">OK</div>
              <h2 className="text-4xl font-bold text-gray-900 mt-6">Payment Completed!</h2>
              <p className="text-xl text-gray-500 mt-3">
                Your payment of <span className="font-bold text-gray-900">{formatToken(view.tokenAmount)} Token</span> has been processed successfully
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-sm text-gray-400">Transaction ID</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{paymentResult?.transaction?.txid || '-'}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-sm text-gray-400">Payment Date</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{paymentResult?.receipt?.timestamp ? new Date(paymentResult.receipt.timestamp).toLocaleDateString() : '-'}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <div className="text-sm text-gray-400">Payment Time</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{formatTime(paymentResult?.receipt?.timestamp)}</div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  className="px-8 py-3 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
                  onClick={() => history.push(`/receipt/${encodeURIComponent(view.receiptId)}`)}
                >
                  Download Receipt
                </button>
                <button
                  type="button"
                  className="px-8 py-3 rounded-2xl border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => history.push('/invoice')}
                >
                  Back to Invoice
                </button>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-8">
              <div className="flex items-center justify-between border-b border-gray-200 pb-6">
                <div>
                  <div className="text-4xl font-bold text-blue-600">NIDA</div>
                  <div className="text-sm text-gray-500 mt-1">Energy Management System</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">Receipt Number</div>
                  <div className="text-3xl font-bold text-gray-900">{view.receiptId || '-'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-b border-gray-200">
                <div>
                  <div className="text-sm text-gray-400 mb-2">Bill To</div>
                  <div className="text-2xl font-bold text-gray-900">{view.buildingName}</div>
                  <div className="text-gray-500 mt-2">Invoice ID: {view.invoiceId}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-2">Payment Details</div>
                  <div className="space-y-2 text-gray-700">
                    <div>Payment Method: Digital Wallet</div>
                    <div>Transaction Date: {paymentResult?.receipt?.timestamp ? new Date(paymentResult.receipt.timestamp).toLocaleDateString() : '-'}</div>
                    <div>Status: <span className="font-semibold text-green-600">Completed</span></div>
                  </div>
                </div>
              </div>

              <div className="py-8 space-y-4">
                  <div className="rounded-2xl bg-gray-50 p-6 space-y-3">
                  <div className="flex items-center justify-between"><span className="text-gray-500">Billing Period</span><span className="font-semibold">{view.billingPeriod}</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-500">Total Energy Used</span><span className="font-semibold">{formatEnergy(view.totalKwh)} kWh</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-500">Market Energy Discount</span><span className="font-semibold text-green-600">- {formatEnergy(view.marketPurchasedKwh)} kWh</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-500">Billable Energy</span><span className="font-semibold">{formatEnergy(view.billableKwh)} kWh</span></div>
                  <div className="flex items-center justify-between"><span className="text-gray-500">Rate per kWh</span><span className="font-semibold">{formatToken(view.rate)} Token/kWh</span></div>
                </div>

                <div className="flex items-center justify-between text-lg"><span className="text-gray-500">Invoice Amount</span><span>{formatToken(view.tokenAmount)} Token</span></div>
                <div className="flex items-center justify-between text-lg"><span className="text-gray-500">Processing Fee</span><span className="text-green-600">0 Token</span></div>
                <div className="flex items-center justify-between text-lg"><span className="text-gray-500">Late Fee</span><span className="text-green-600">0 Token</span></div>
                <div className="rounded-2xl bg-blue-50 px-5 py-4 flex items-center justify-between">
                  <span className="text-2xl font-bold text-gray-900">Total Amount Paid</span>
                  <span className="text-4xl font-bold text-blue-600">{formatToken(view.tokenAmount)} <span className="text-lg text-gray-500">Token</span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

