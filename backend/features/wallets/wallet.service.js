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

  const updatedWallet = await Wallet.addBalance(email, numericAmount, 1);
  const buildings = await Building.getBuildingByEmail(email);
  const buildingName = Array.isArray(buildings) && buildings.length ? buildings[0].name : null;

  const tx = await Transaction.createTransaction({
    walletId: wallet.id,
    buildingName,
    snid,
    type: 'CREDIT',
    tokenAmount: numericAmount,
    status: 'CONFIRMED',
  });

  const { verification, transaction: persistedTransaction } = await transactionVerificationService.verifyTransaction(tx);

  return {
    wallet: updatedWallet,
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
