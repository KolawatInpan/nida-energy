const { randomUUID } = require('crypto');
const { prisma } = require('../../utils/prisma');
const Wallet = require('../wallets/wallet.model');
const Offer = require('../trading/offer.model');
const Invoice = require('./invoice.model');
const transactionVerificationService = require('../blockchain/transactionVerification.service');
const {
  toNumber,
  resolvePeriod,
  resolveBuildingFilter,
  getBangkokDateParts,
  buildUniquePeriodsFromLogs,
  getPreviousMonthPeriodIfDue,
} = require('./invoice.helpers');

async function syncInvoicesForPeriods(periods = [], options = {}) {
  const uniquePeriods = [...new Map(
    (Array.isArray(periods) ? periods : [])
      .map((period) => ({
        year: Number(period?.year),
        month: Number(period?.month),
      }))
      .filter((period) => period.year && period.month)
      .map((period) => [`${period.year}-${period.month}`, period])
  ).values()];

  const summary = {
    created: [],
    updated: [],
    existing: [],
    skipped: [],
  };

  for (const period of uniquePeriods) {
    const result = await Invoice.createMonthlyInvoices({
      year: period.year,
      month: period.month,
      buildingName: options?.buildingName || null,
    });

    summary.created.push(...(result.created || []));
    summary.updated.push(...(result.updated || []));
    summary.existing.push(...(result.existing || []));
    summary.skipped.push(...(result.skipped || []));
  }

  return {
    periods: uniquePeriods,
    created: summary.created,
    updated: summary.updated,
    existing: summary.existing,
    skipped: summary.skipped,
    createdCount: summary.created.length,
    updatedCount: summary.updated.length,
    existingCount: summary.existing.length,
    skippedCount: summary.skipped.length,
  };
}

async function syncInvoicesForEnergyLogs(logs = []) {
  const periods = buildUniquePeriodsFromLogs(logs);

  if (!periods.length) {
    return {
      periods: [],
      created: [],
      updated: [],
      existing: [],
      skipped: [],
      createdCount: 0,
      updatedCount: 0,
      existingCount: 0,
      skippedCount: 0,
    };
  }

  return syncInvoicesForPeriods(periods);
}

async function ensurePreviousMonthInvoiceIfDue(referenceDate = new Date()) {
  const previousPeriod = getPreviousMonthPeriodIfDue(referenceDate);
  if (!previousPeriod) {
    return {
      periods: [],
      created: [],
      updated: [],
      existing: [],
      skipped: [],
      createdCount: 0,
      updatedCount: 0,
      existingCount: 0,
      skippedCount: 0,
      skippedBySchedule: true,
    };
  }

  return syncInvoicesForPeriods([previousPeriod]);
}

async function purchaseMarketplaceEnergy({ offerId, buyerWalletId, targetBuildingId, amount }) {
  if (!offerId || !buyerWalletId || !targetBuildingId) {
    const err = new Error('offerId, buyerWalletId, and targetBuildingId are required');
    err.status = 400;
    throw err;
  }

  const offer = await Offer.getOfferById(offerId);
  if (!offer) {
    const err = new Error('Offer not found');
    err.status = 404;
    throw err;
  }

  if (offer.status !== 'AVAILABLE') {
    const err = new Error('Offer is no longer available');
    err.status = 400;
    throw err;
  }

  const purchaseAmount = amount ? toNumber(amount) : toNumber(offer.kwh || offer.kWH);
  const totalPrice = purchaseAmount * toNumber(offer.ratePerKwh || offer.ratePerkWH || offer.ratePerkwh);

  const buyerWallet = await Wallet.getWalletById(buyerWalletId);
  if (!buyerWallet) {
    const err = new Error('Buyer wallet not found');
    err.status = 404;
    throw err;
  }

  if (toNumber(buyerWallet.tokenBalance) < totalPrice) {
    const err = new Error('Insufficient balance');
    err.status = 400;
    err.required = totalPrice;
    err.available = toNumber(buyerWallet.tokenBalance);
    throw err;
  }

  const sellerWallet = await Wallet.getWalletById(offer.sellerWalletId);
  if (!sellerWallet) {
    const err = new Error('Seller wallet not found');
    err.status = 404;
    throw err;
  }

  const building = await prisma.building.findUnique({
    where: { id: parseInt(targetBuildingId, 10) },
  });
  const buildingName = building ? building.name : `Building-${targetBuildingId}`;

  const destinationBatteryMeter = building?.name
    ? await prisma.meterInfo.findFirst({
        where: {
          buildingName: building.name,
          type: {
            contains: 'battery',
            mode: 'insensitive',
          },
        },
      })
    : null;

  if (!destinationBatteryMeter) {
    const err = new Error('Target building must have a battery meter to receive purchased energy');
    err.status = 400;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: String(buyerWalletId) },
      data: { tokenBalance: { decrement: totalPrice } },
    });

    await tx.wallet.update({
      where: { id: String(offer.sellerWalletId) },
      data: { tokenBalance: { increment: totalPrice } },
    });

    const nextValue = toNumber(destinationBatteryMeter.value) + purchaseAmount;
    const nextKwh = toNumber(destinationBatteryMeter.kwh || destinationBatteryMeter.kWH) + purchaseAmount;

    const updatedBattery = await tx.meterInfo.update({
      where: { snid: destinationBatteryMeter.snid },
      data: {
        value: nextValue,
        kWH: nextKwh,
        timestamp: new Date(),
      },
    });

    const batteryStorage = {
      snid: updatedBattery.snid,
      value: toNumber(updatedBattery.value),
      kWH: toNumber(updatedBattery.kWH),
      capacity: toNumber(updatedBattery.capacity),
    };

    const buyerWalletTxId = randomUUID();
    await tx.walletTx.create({
      data: {
        id: buyerWalletTxId,
        walletId: String(buyerWalletId),
        timestamp: new Date(),
        tokenInOut: -totalPrice,
      },
    });

    await tx.walletTx.create({
      data: {
        id: randomUUID(),
        walletId: String(offer.sellerWalletId),
        timestamp: new Date(),
        tokenInOut: totalPrice,
      },
    });

    const buyerTransaction = await tx.transaction.create({
      data: {
        txid: randomUUID(),
        timestamp: new Date(),
        buildingName: building?.name || null,
        walletId: String(buyerWalletId),
        type: 'MARKETPLACE_PURCHASE',
        tokenAmount: totalPrice,
        status: 'CONFIRMED',
      },
    });

    const sellerTransaction = await tx.transaction.create({
      data: {
        txid: randomUUID(),
        timestamp: new Date(),
        buildingName: offer.buildingName || null,
        walletId: String(offer.sellerWalletId),
        type: 'MARKETPLACE_SALE',
        tokenAmount: totalPrice,
        status: 'CONFIRMED',
      },
    });

    const now = new Date();
    const invoice = await tx.invoice.create({
      data: {
        id: randomUUID(),
        buildingName: String(buildingName),
        fromWId: String(offer.sellerWalletId),
        toWId: String(buyerWalletId),
        timestamp: now,
        kWH: purchaseAmount,
        tokenAmount: totalPrice,
        status: 'paid',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        dailyAvg: purchaseAmount,
        peakDate: now,
        peakkWH: purchaseAmount,
      },
    });

    const receipt = await tx.receipt.create({
      data: {
        id: randomUUID(),
        invoiceId: String(invoice.id),
        timestamp: new Date(),
        walletTxId: String(buyerWalletTxId),
      },
    });

    const newKwhSold = toNumber(offer.kwhSold || offer.kWHSold) + purchaseAmount;
    const totalKwh = toNumber(offer.kwh || offer.kWH);
    const newStatus = newKwhSold >= totalKwh ? 'CANCELLED' : 'AVAILABLE';

    await tx.energyOffer.update({
      where: { id: parseInt(offerId, 10) },
      data: {
        kWHSold: newKwhSold,
        status: newStatus,
        buyerWalletId: String(buyerWalletId),
      },
    });

    return { invoice, receipt, batteryStorage, buyerTransaction, sellerTransaction };
  });

  const buyerVerification = await transactionVerificationService.verifyTransaction(result.buyerTransaction);
  const sellerVerification = await transactionVerificationService.verifyTransaction(result.sellerTransaction);

  return {
    message: 'Purchase successful',
    ...result,
    transaction: {
      from: offer.sellerWalletId,
      to: buyerWalletId,
      amount: totalPrice,
      kWH: purchaseAmount,
    },
    blockchain: {
      buyer: {
        transaction: buyerVerification.transaction,
        verification: buyerVerification.verification,
      },
      seller: {
        transaction: sellerVerification.transaction,
        verification: sellerVerification.verification,
      },
    },
  };
}

async function generateMonthlyInvoices(input = {}) {
  const { month, year } = resolvePeriod(input);
  const buildingName = resolveBuildingFilter(input);
  const result = await syncInvoicesForPeriods([{ month, year }], { buildingName });

  return {
    month,
    year,
    buildingName,
    ratePerKwh: Invoice.TOKEN_RATE_PER_KWH,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    existingCount: result.existingCount,
    skippedCount: result.skippedCount,
    ...result,
  };
}

async function payInvoiceById(invoiceId) {
  const invoice = await Invoice.getInvoiceById(invoiceId);
  if (!invoice) {
    const err = new Error('Invoice not found');
    err.status = 404;
    throw err;
  }

  if ((invoice.status || '').toLowerCase() === 'paid') {
    const err = new Error('Invoice already paid');
    err.status = 400;
    err.invoice = invoice;
    throw err;
  }

  const payerWallet = await Wallet.getWalletById(invoice.toWId);
  if (!payerWallet) {
    const err = new Error('Payer wallet not found');
    err.status = 404;
    throw err;
  }

  const tokenAmount = toNumber(invoice.tokenAmount);
  const availableBalance = toNumber(payerWallet.tokenBalance);

  if (availableBalance < tokenAmount) {
    const err = new Error('Insufficient wallet balance');
    err.status = 400;
    err.required = tokenAmount;
    err.available = availableBalance;
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: String(invoice.toWId) },
      data: {
        tokenBalance: {
          decrement: tokenAmount,
        },
      },
    });

    const walletTx = await tx.walletTx.create({
      data: {
        id: randomUUID(),
        walletId: String(invoice.toWId),
        timestamp: new Date(),
        tokenInOut: -tokenAmount,
      },
    });

    const txRecord = await tx.transaction.create({
      data: {
        txid: randomUUID(),
        timestamp: new Date(),
        buildingName: invoice.buildingName,
        walletId: String(invoice.toWId),
        type: 'INVOICE_PAYMENT',
        tokenAmount,
        status: 'CONFIRMED',
      },
    });

    const paidInvoice = await tx.invoice.update({
      where: { id: String(invoice.id) },
      data: { status: 'paid' },
      include: { receipt: true },
    });

    const receipt = paidInvoice.receipt || await tx.receipt.create({
      data: {
        id: randomUUID(),
        invoiceId: String(invoice.id),
        timestamp: new Date(),
        walletTxId: String(walletTx.id),
      },
    });

    return {
      invoice: {
        ...paidInvoice,
        kWH: toNumber(paidInvoice.kWH),
        tokenAmount: toNumber(paidInvoice.tokenAmount),
        dailyAvg: toNumber(paidInvoice.dailyAvg),
        peakkWH: toNumber(paidInvoice.peakkWH),
        receipt,
      },
      receipt,
      wallet: updatedWallet,
      transaction: txRecord,
    };
  });

  const verificationResult = await transactionVerificationService.verifyTransaction(result.transaction);
  const [enrichedInvoice] = await Invoice.attachInvoiceEnergyBreakdown([result.invoice]);

  return {
    ...result,
    invoice: enrichedInvoice || result.invoice,
    transaction: verificationResult.transaction,
    verification: verificationResult.verification,
  };
}

module.exports = {
  purchaseMarketplaceEnergy,
  generateMonthlyInvoices,
  payInvoiceById,
  syncInvoicesForPeriods,
  syncInvoicesForEnergyLogs,
  ensurePreviousMonthInvoiceIfDue,
};
