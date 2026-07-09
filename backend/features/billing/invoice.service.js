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
const { matchesSourceType, isBatteryMeter } = require('../trading/market.utils');

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

async function getInvoices(filter = {}) {
  return Invoice.getInvoices(filter);
}

async function getInvoiceById(id) {
  return Invoice.getInvoiceById(id);
}

async function getInvoiceConsumptionSnapshot(filter = {}) {
  return Invoice.getInvoiceConsumptionSnapshot(filter);
}

async function attachInvoiceEnergyBreakdown(invoices = []) {
  return Invoice.attachInvoiceEnergyBreakdown(invoices);
}

async function getQuotaWarnings(filter = {}) {
  return Invoice.getQuotaWarnings(filter);
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

  // Look up seller building name from wallet
  const sellerBuilding = await prisma.building.findFirst({ where: { email: sellerWallet.email }, select: { name: true } }).catch(() => null);
  // Get actual sourceType from marketOrder metadata (EnergyOffer doesn't have this field)
  let offerSourceType = 'produce';
  try {
    const mo = await prisma.marketOrder.findFirst({
      where: { side: 'OFFER', walletId: String(offer.sellerWalletId), status: { in: ['OPEN', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
      select: { metadata: true, sourceType: true },
    });
    offerSourceType = mo?.sourceType || mo?.metadata?.sourceType || 'produce';
  } catch (e) { /* keep default */ }

  const sellerBuildingName = sellerBuilding?.name || offer.buildingName || sellerWallet.email || String(sellerWallet.id).slice(0, 8);

  const building = await prisma.building.findUnique({
    where: { id: parseInt(targetBuildingId, 10) },
  });
  const buyerBuildingName = building?.name || `Building-${targetBuildingId}`;

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

  // Fallback: if no battery, energy goes to consumer meter (increases consumption)
  const destinationMeter = destinationBatteryMeter || (building?.name ? await prisma.meterInfo.findFirst({
    where: {
      buildingName: building.name,
      type: {
        contains: 'consume',
        mode: 'insensitive',
      },
    },
  }) : null);

  if (!destinationMeter) {
    const err = new Error('Target building must have a battery or consumer meter to receive purchased energy');
    err.status = 400;
    throw err;
  }
  const isBatteryTarget = !!destinationBatteryMeter;

  let sellerSourceMeterSnid = null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: String(buyerWalletId) },
      data: { tokenBalance: { decrement: totalPrice } },
    });

    await tx.wallet.update({
      where: { id: String(offer.sellerWalletId) },
      data: { tokenBalance: { increment: totalPrice } },
    });

    const nextValue = toNumber(destinationMeter.value) + purchaseAmount;
    const nextKwh = toNumber(destinationMeter.kwh || destinationMeter.kWH) + purchaseAmount;

    const updatedMeter = await tx.meterInfo.update({
      where: { snid: destinationMeter.snid },
      data: {
        value: nextValue,
        kWH: nextKwh,
        timestamp: new Date(),
      },
    });

    const meterResult = {
      snid: updatedMeter.snid,
      value: toNumber(updatedMeter.value),
      kWH: toNumber(updatedMeter.kWH),
      capacity: toNumber(updatedMeter.capacity),
      type: isBatteryTarget ? 'battery' : 'consumer',
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
        buildingName: buyerBuildingName,
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
        buildingName: sellerBuildingName,
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
        buildingName: String(buyerBuildingName),
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

    // Decrease seller's source meter when purchased
    try {
      const sellerBuilding = await prisma.building.findFirst({ where: { email: sellerWallet.email }, select: { name: true } });
      if (sellerBuilding?.name) {
        const sellerMeters = await prisma.meterInfo.findMany({ where: { buildingName: sellerBuilding.name }, select: { snid: true, type: true, value: true, kWH: true } });
        // Try matching sourceType first, then fallback to battery, then any meter with value
        let sourceMeter = sellerMeters.find((m) => matchesSourceType(m.type, offerSourceType));
        if (!sourceMeter) sourceMeter = sellerMeters.find((m) => isBatteryMeter(m.type));
        if (!sourceMeter) sourceMeter = sellerMeters.find((m) => Number(m.value || m.kWH || 0) >= purchaseAmount);
        if (sourceMeter) {
          sellerSourceMeterSnid = sourceMeter.snid;
          const sv = Number(sourceMeter.value || 0);
          const sk = Number(sourceMeter.kWH || 0);
          const newValue = Math.max(0, sv - purchaseAmount);
          const newKwh = Math.max(0, sk - purchaseAmount);
          await tx.meterInfo.update({
            where: { snid: sourceMeter.snid },
            data: { value: newValue, kWH: newKwh, timestamp: new Date() },
          });
        }
      }
    } catch (meterErr) { console.warn('purchaseMarketplaceEnergy: seller meter decrease failed', meterErr.message || meterErr); }

    const newKwhSold = toNumber(offer.kwhSold || offer.kWHSold) + purchaseAmount;
    const totalKwh = toNumber(offer.kwh || offer.kWH);
    const newStatus = newKwhSold >= totalKwh ? 'CANCELLED' : 'AVAILABLE';

    // Update energyOffer — use offer.id from getOfferById (may differ from API offerId if cross-referenced from MarketOrder)
    const eoId = String(offer.id);
    const eoIsInt = !eoId.includes('-');
    if (eoIsInt) {
      await tx.energyOffer.update({
        where: { id: parseInt(eoId, 10) },
        data: { kWHSold: newKwhSold, status: newStatus, buyerWalletId: String(buyerWalletId) },
      });
    } else {
      await tx.$executeRawUnsafe(
        `UPDATE "EnergyOffer" SET "kWHSold" = $1, "status" = $2::text::"EnergyOfferStatus", "buyerWalletId" = $3 WHERE "id"::text = $4`,
        newKwhSold, newStatus, String(buyerWalletId), eoId
      );
    }

    // Also update the MarketOrder (the original offerId passed to this function)
    const moId = String(offerId);
    try {
      const moStatus = newKwhSold >= totalKwh ? 'FILLED' : 'PARTIAL';
      await tx.marketOrder.update({
        where: { id: moId },
        data: { filled: newKwhSold, status: moStatus },
      });
    } catch {
      const mo = await tx.marketOrder.findFirst({
        where: { walletId: String(offer.sellerWalletId), side: 'OFFER', status: { in: ['OPEN', 'PARTIAL'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (mo) {
        const moStatus = newKwhSold >= totalKwh ? 'FILLED' : 'PARTIAL';
        await tx.marketOrder.update({
          where: { id: mo.id },
          data: { filled: newKwhSold, status: moStatus },
        });
      }
    }

    return { invoice, receipt, destinationMeter: meterResult, buyerTransaction, sellerTransaction };
  });

  if (sellerSourceMeterSnid) {
    try {
      const { insertRunningMeter } = require('../energy/energyAggregation');
      const sellerMeter = await prisma.meterInfo.findUnique({ where: { snid: sellerSourceMeterSnid }, select: { kWH: true } });
      const newKwh = Math.max(0, Number(sellerMeter?.kWH || 0));
      await insertRunningMeter({ snid: sellerSourceMeterSnid, timestamp: new Date(), kW: -purchaseAmount, kWH: newKwh, source: 'SOLD' });
    } catch (e) { console.warn('[purchaseMarketplaceEnergy] Seller RunningMeter log failed:', e.message); }
  }

  // Log energy receipt to destination (buyer) meter
  try {
    const { insertRunningMeter } = require('../energy/energyAggregation');
    const destKwh = Number(result.destinationMeter?.kWH || destinationMeter?.kWH || 0);
    await insertRunningMeter({ snid: result.destinationMeter?.snid || destinationMeter?.snid, timestamp: new Date(), kW: purchaseAmount, kWH: destKwh, source: 'MARKET' });
  } catch (e) { console.warn('[purchaseMarketplaceEnergy] Destination RunningMeter log failed:', e.message); }

  const buyerVerification = await transactionVerificationService.verifyTransaction({ ...result.buyerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: buyerBuildingName });
  const sellerVerification = await transactionVerificationService.verifyTransaction({ ...result.sellerTransaction, kwh: purchaseAmount, fromBuilding: sellerBuildingName, toBuilding: buyerBuildingName, buildingName: sellerBuildingName });

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
  getInvoices,
  getInvoiceById,
  getInvoiceConsumptionSnapshot,
  attachInvoiceEnergyBreakdown,
  getQuotaWarnings,
  purchaseMarketplaceEnergy,
  generateMonthlyInvoices,
  payInvoiceById,
  syncInvoicesForPeriods,
  syncInvoicesForEnergyLogs,
  ensurePreviousMonthInvoiceIfDue,
  TOKEN_RATE_PER_KWH: Invoice.TOKEN_RATE_PER_KWH,
};
