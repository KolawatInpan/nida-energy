const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');

async function getWallets() {
  return await prisma.wallet.findMany({
    include: {
      building: { select: { id: true, name: true } },
    },
  });
}

async function getWalletById(id) {
  return await prisma.wallet.findUnique({
    where: { id },
    include: {
      building: { select: { id: true, name: true } },
    },
  });
}

async function getWalletByBuildingId(buildingId) {
  return await prisma.wallet.findUnique({
    where: { buildingId: parseInt(buildingId) },
    include: {
      building: { select: { id: true, name: true } },
    },
  });
}

async function createWallet({ buildingId }) {
  if (!buildingId) {
    const e = new Error('buildingId is required');
    e.status = 400;
    throw e;
  }
  const walletId = randomUUID();
  const newWallet = await prisma.wallet.create({
    data: {
      id: walletId,
      buildingId: parseInt(buildingId),
      isCustodial: true,
      chain: 'ethereum',
      tokenBalance: 0,
      quota: 0,
    },
  });
  return newWallet;
}

async function getBalance(walletId) {
  return await prisma.wallet.findUnique({
    where: { id: String(walletId) },
    select: { tokenBalance: true },
  });
}

async function addBalanceByWalletId(walletId, amount) {
  const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) } });
  if (!wallet) {
    const e = new Error('wallet not found');
    e.status = 404;
    throw e;
  }
  return await prisma.wallet.update({
    where: { id: wallet.id },
    data: { tokenBalance: { increment: Number(amount || 0) } },
  });
}

function signedTransactionAmount(transaction) {
  const amount = Number(transaction?.tokenAmount || 0);
  if (!Number.isFinite(amount)) return 0;
  const type = String(transaction?.type || '').toUpperCase();
  const creditTypes = new Set(['CREDIT', 'MARKETPLACE_SALE']);
  return creditTypes.has(type) ? amount : -amount;
}

async function calculateBalanceFromTransactions(walletId) {
  const transactions = await prisma.transaction.findMany({
    where: {
      walletId: String(walletId),
      status: 'CONFIRMED',
    },
    select: {
      type: true,
      tokenAmount: true,
    },
  });

  const balance = transactions.reduce((sum, tx) => sum + signedTransactionAmount(tx), 0);
  return Number(balance.toFixed(8));
}

async function recalculateBalance(walletId) {
  const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) } });
  if (!wallet) {
    const e = new Error('wallet not found');
    e.status = 404;
    throw e;
  }

  const recalculatedBalance = await calculateBalanceFromTransactions(walletId);
  const updatedWallet = await prisma.wallet.update({
    where: { id: String(walletId) },
    data: { tokenBalance: recalculatedBalance },
  });

  return {
    wallet: updatedWallet,
    previousBalance: Number(wallet.tokenBalance || 0),
    recalculatedBalance,
  };
}

module.exports = {
  getWallets,
  getWalletById,
  getWalletByBuildingId,
  createWallet,
  getBalance,
  addBalanceByWalletId,
  calculateBalanceFromTransactions,
  recalculateBalance,
};
