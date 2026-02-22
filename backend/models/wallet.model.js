const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// private key / keystore support removed for now — wallets are simple records linked to user email

async function getWallets () {
  return await prisma.wallet.findMany({ include: { owner: { select: { email: true } } } });
}

async function getWalletById (id) {
  return await prisma.wallet.findUnique({
    where: { id: Number(id) },
    include: { owner: { select: { email: true } } }
  });
}

async function createWallet ({ name, ownerEmail }) {
  if (!ownerEmail || !String(ownerEmail).includes('@')) {
    const e = new Error('owner email not resolved or missing');
    e.status = 400;
    throw e;
  }
}

async function getBalance (walletId) {
  return await prisma.wallet.findUnique(
    { where: { id: Number(walletId) }, select: { tokenBalance: true } }
  );
}

module.exports = {
  getWallets,
  getWalletById,
  createWallet,
  getBalance
};
