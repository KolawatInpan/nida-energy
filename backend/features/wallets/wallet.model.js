const { prisma } = require('../../utils/prisma');
const { randomUUID } = require('crypto');
// private key / keystore support removed for now — wallets are simple records linked to user email

async function getWallets () {
  return await prisma.wallet.findMany();
}

async function getWalletById (id) {
  return await prisma.wallet.findUnique({
    where: { id },
  });
}

async function createWallet ({ buildingId, email }) {
  if (!email || !String(email).includes('@')) {
    const e = new Error('owner email not resolved or missing');
    e.status = 400;
    throw e;
  }
  // If a buildingId is provided, use it (stringified) as the wallet id so wallet.id matches building id.
  // Otherwise fall back to a generated UUID.
  const walletId = buildingId ? String(buildingId) : randomUUID();
  const newWallet = await prisma.wallet.create({
    data: {
      id: walletId,
      email,
      isCustodial: true,
      chain: 'ethereum',
      tokenBalance: 0,
      quota: 0,
    },
  });
  return newWallet;
}

async function getBalance (walletId) {
  // walletId is stored as string (may be buildingId string or UUID). Query by id directly.
  return await prisma.wallet.findUnique({ where: { id: String(walletId) }, select: { tokenBalance: true } });
}

async function getWalletByEmail(email) {
  return await prisma.wallet.findFirst({ where: { email } });
}

async function addBalance (email, amount, rate) {
  const wallet = await prisma.wallet.findFirst({ where: { email } });
  if (!wallet) {
    const e = new Error('wallet not found');
    e.status = 404;
    throw e;
  }
  const updatedWallet = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      tokenBalance: {
        increment: Number(amount || 0),
      },
    },
  });
  return updatedWallet;
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
    data: {
      tokenBalance: recalculatedBalance,
    },
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
  createWallet,
  getBalance,
  getWalletByEmail,
  addBalance,
  calculateBalanceFromTransactions,
  recalculateBalance,
};


