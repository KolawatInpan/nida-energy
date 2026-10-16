const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');
const Building = require('../building/building.model');
const Wallet = require('./wallet.model');
const transactionVerificationService = require('../blockchain/transactionVerification.service');

async function resolveWalletBalance(walletId) {
  let wallet = null;

  // If walletId is a number or numeric string, try buildingId lookup first
  const asInt = parseInt(walletId, 10);
  if (Number.isInteger(asInt) && asInt > 0) {
    wallet = await Wallet.getWalletByBuildingId(asInt);
  }

  // Fallback: try wallet.id lookup
  if (!wallet) {
    wallet = await Wallet.getWalletById(String(walletId));
  }

  if (!wallet) {
    const err = new Error('Wallet not found');
    err.status = 404;
    throw err;
  }

  return { walletId: wallet.id, balance: wallet.tokenBalance, buildingId: wallet.buildingId };
}

async function getWallets() {
  return Wallet.getWallets();
}

async function getWalletById(id) {
  return Wallet.getWalletById(id);
}

async function getWalletByBuildingId(buildingId) {
  return Wallet.getWalletByBuildingId(buildingId);
}

async function createWallet(input) {
  return Wallet.createWallet(input);
}

async function addBalanceByWalletId(walletId, amount) {
  return Wallet.addBalanceByWalletId(walletId, amount);
}

async function getWalletTransactions(walletId) {
  const { getTransactionsByWallet } = require('../transactions/transaction.model');
  return getTransactionsByWallet(walletId);
}

async function recalculateBalance(walletId) {
  return Wallet.recalculateBalance(walletId);
}

/**
 * Top-up wallet by buildingId (replaces topupWalletByEmail).
 * @param {number} buildingId - Building ID
 * @param {number} amount - Token amount to add
 * @param {string} snid - Meter serial number (optional)
 */
async function topupWalletByBuildingId(buildingId, amount, snid) {
  const numericAmount = Number(amount || 0);

  if (!buildingId || !numericAmount || numericAmount <= 0) {
    const err = new Error('buildingId and positive amount are required');
    err.status = 400;
    throw err;
  }

  const wallet = await Wallet.getWalletByBuildingId(buildingId);
  if (!wallet) {
    const err = new Error('Wallet not found for this building');
    err.status = 404;
    throw err;
  }

  // Get building name
  let buildingName = wallet.building?.name || null;
  if (!buildingName) {
    const building = await prisma.building.findUnique({
      where: { id: parseInt(buildingId) },
      select: { name: true },
    });
    buildingName = building?.name || `Building-${buildingId}`;
  }

  // Use a transaction to create WalletTx + Invoice + Receipt atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update wallet balance
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { tokenBalance: { increment: numericAmount } },
    });

    // 2. Create WalletTx record
    const walletTxId = randomUUID();
    await tx.walletTx.create({
      data: {
        id: walletTxId,
        walletId: String(wallet.id),
        timestamp: new Date(),
        tokenInOut: numericAmount,
      },
    });

    // 3. Create Invoice (top-up type)
    const now = new Date();
    const invoice = await tx.invoice.create({
      data: {
        id: randomUUID(),
        buildingName: buildingName,
        fromWId: 'SYSTEM',
        toWId: String(wallet.id),
        timestamp: now,
        kWH: 0,
        tokenAmount: numericAmount,
        status: 'paid',
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        dailyAvg: 0,
        peakDate: now,
        peakkWH: 0,
      },
    });

    // 4. Create Receipt (linked to Invoice + WalletTx)
    const receipt = await tx.receipt.create({
      data: {
        id: randomUUID(),
        invoiceId: String(invoice.id),
        timestamp: new Date(),
        walletTxId: String(walletTxId),
      },
    });

    // 5. Create Transaction record
    const txRecord = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        buildingName,
        snid,
        type: 'CREDIT',
        tokenAmount: numericAmount,
        status: 'CONFIRMED',
      },
    });

    return { updatedWallet, invoice, receipt, transaction: txRecord };
  });

  // Pass kWh=0 for top-up transactions (no energy exchanged)
  const txForVerify = { ...result.transaction, kwh: 0 };
  const { verification, transaction: persistedTransaction } = await transactionVerificationService.verifyTransaction(txForVerify);

  return {
    wallet: result.updatedWallet,
    invoice: result.invoice,
    receipt: result.receipt,
    transaction: persistedTransaction,
    verification,
    rate: 1,
    equivalentBaht: numericAmount,
  };
}

module.exports = {
  getWallets,
  getWalletById,
  getWalletByBuildingId,
  createWallet,
  addBalanceByWalletId,
  getWalletTransactions,
  recalculateBalance,
  resolveWalletBalance,
  topupWalletByBuildingId,
};
