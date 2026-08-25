import { formatEntityId } from './formatters';
import { fmtDate } from './dateFormat';

export function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatBillingPeriod(invoice) {
  if (!invoice?.month || !invoice?.year) return '-';

  const start = new Date(invoice.year, invoice.month - 1, 1);
  const end = new Date(invoice.year, invoice.month, 0);

  return `${fmtDate(start)} - ${fmtDate(end)}`;
}

export function getCustomerType(owner) {
  const role = String(owner?.role || '').toUpperCase();
  if (role === 'PROSUMER') return 'Prosumer';
  if (role === 'CONSUMER' || role === 'USER') return 'Consumer';
  if (role === 'PRODUCER') return 'Producer';
  if (role === 'ADMIN') return 'Administrator';
  return 'Institutional';
}

export function buildReceiptView(receipt, id) {
  const invoice = receipt?.invoice || {};
  const building = receipt?.building || {};
  const owner = receipt?.owner || {};
  const walletTx = receipt?.walletTx || {};

  const tokenAmount = toNumber(invoice?.tokenAmount);
  const consumedKwh = toNumber(invoice?.consumedKwh ?? invoice?.kWH);
  const marketDiscountKwh = toNumber(invoice?.marketPurchasedKwh);
  const billableKwh = toNumber(invoice?.billableKwh ?? invoice?.kWH);
  const rate = billableKwh > 0 ? tokenAmount / billableKwh : 1;
  const gridEnergyCost = consumedKwh * rate;
  const discountTokenAmount = marketDiscountKwh * rate;
  const adminFeeRate = 0.005;
  const adminFeeAmount = tokenAmount * adminFeeRate;
  const totalPaidWithFee = tokenAmount + adminFeeAmount;
  const storedReceiptTime = receipt?.timestamp || invoice?.timestamp;

  const isMarketplace = String(invoice?.fromWId || '').toUpperCase() !== 'SYSTEM';

  return {
    receiptId: receipt?.id || id,
    receiptNumber: formatEntityId('REC', receipt?.id || id),
    invoiceId: invoice?.id || '-',
    invoiceNumber: formatEntityId('INV', invoice?.id),
    receiptTimestamp: storedReceiptTime,
    buildingName: invoice?.buildingName || building?.name || '-',
    location: [building?.address, building?.province, building?.postal].filter(Boolean).join(', ') || '-',
    customerName: owner?.name || building?.name || '-',
    customerEmail: owner?.email || building?.email || '-',
    customerPhone: owner?.telNum || '-',
    customerType: getCustomerType(owner),
    smartMeterId: walletTx?.id ? formatEntityId('WTX', walletTx.id) : '-',
    snid: building?.id ? formatEntityId('BLD', building.id) : '-',
    paymentMethod: 'NIDA Token Wallet',
    status: String(invoice?.status || 'paid').toUpperCase(),
    billingPeriod: formatBillingPeriod(invoice),
    consumedKwh,
    marketDiscountKwh,
    billableKwh,
    rate,
    tokenAmount,
    gridEnergyCost,
    discountTokenAmount,
    adminFeeRate,
    adminFeeAmount,
    totalPaidWithFee,
    equivalentThb: totalPaidWithFee,
    peakDate: invoice?.peakDate,
    peakKwh: toNumber(invoice?.peakkWH),
    transactionReference: receipt?.walletTxId || walletTx?.id || '-',
    verifyCode: receipt?.walletTxId || walletTx?.id || receipt?.id || '-',
    createdAt: storedReceiptTime ? new Date(storedReceiptTime).toLocaleString('en-GB') : '-',
    isMarketplace,
    // For marketplace purchases: show P2P purchase description
    energySourceLabel: isMarketplace ? 'P2P Energy Purchase' : 'Grid Energy Import',
    energySourceDesc: isMarketplace ? 'Source: Peer-to-Peer Marketplace' : 'Source: National Grid (PEA/MEA)',
  };
}
