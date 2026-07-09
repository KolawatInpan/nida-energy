const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');
const Building = require('../building/building.model');
const Transaction = require('../transactions/transaction.model');
const Wallet = require('./wallet.model');
const transactionVerificationService = require('../blockchain/transactionVerification.service');

async function resolveWalletBalance(walletId) {
  let wallet = null;

  if (typeof walletId === 'string' && walletId.includes('@')) {
    wallet = await Wallet.getWalletByEmail(walletId);
  } else {
    wallet = await Wallet.getWalletById(walletId);
    if (!wallet && typeof walletId === 'string' && walletId.includes('%40')) {
      try {
        const decoded = decodeURIComponent(walletId);
        if (decoded.includes('@')) wallet = await Wallet.getWalletByEmail(decoded);
      } catch (error) {
        // ignore decode fallback errors
      }
    }
  }

  if (!wallet) {
    const err = new Error('Wallet not found');
    err.status = 404;
    throw err;
  }

  return { walletId: wallet.id, balance: wallet.tokenBalance };
}

async function getWallets() {
  return Wallet.getWallets();
}

async function getWalletById(id) {
  return Wallet.getWalletById(id);
}

async function createWallet(input) {
  return Wallet.createWallet(input);
}

async function getWalletByEmail(email) {
  return Wallet.getWalletByEmail(email);
}

async function addBalance(email, amount, rate) {
  return Wallet.addBalance(email, amount, rate);
}

async function getWalletTransactions(walletId) {
  return Transaction.getTransactionsByWallet(walletId);
}

async function recalculateBalance(walletId) {
  return Wallet.recalculateBalance(walletId);
}

async function topupWalletByEmail(email, amount, snid) {
  const numericAmount = Number(amount || 0);

  if (!email || !numericAmount || numericAmount <= 0) {
    const err = new Error('email and positive amount are required');
    err.status = 400;
    throw err;
  }

  const wallet = await Wallet.getWalletByEmail(email);
  if (!wallet) {
    const err = new Error('Wallet not found');
    err.status = 404;
    throw err;
  }

  // Find building name: first by email, then by wallet's user relation
  const buildings = await Building.getBuildingByEmail(email);
  let buildingName = (Array.isArray(buildings) && buildings.length && buildings[0]?.name) || null;
  if (!buildingName) {
    try {
      const userWithBuildings = await prisma.user.findUnique({
        where: { email },
        include: { buildings: { select: { name: true } } },
      });
      if (userWithBuildings?.buildings?.length) {
        buildingName = userWithBuildings.buildings[0].name;
      }
    } catch (e) { /* ignore */ }
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
        buildingName: buildingName || email,
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
  createWallet,
  getWalletByEmail,
  addBalance,
  getWalletTransactions,
  recalculateBalance,
  resolveWalletBalance,
  topupWalletByEmail,
};
