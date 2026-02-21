const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// private key / keystore support removed for now — wallets are simple records linked to user email

async function createWallet(email, address = null) {
  // create wallet record; link to user via email. Keystore/private key storage is disabled.
  const data = { email, isCustodial: false, chain: 'ganache' };
  if (address) data.id = String(address);
  return prisma.wallet.create({ data });
}

async function getWalletByUserEmail(email) {
  const wallet = await prisma.wallet.findFirst({ where: { email } });
  return wallet || null;
}

async function listWalletsByUserEmail(email) {
  return prisma.wallet.findMany({ where: { email } });
}

async function switchWalletMode(walletId, custodial) {
  return prisma.wallet.update({ where: { id: String(walletId) }, data: { isCustodial: custodial } });
}

async function depositToWallet(walletId, amount) {
  const wallet = await prisma.wallet.findUnique({ where: { id: String(walletId) } });
  if (!wallet) throw new Error('Wallet not found');
  const newQuota = (Number(wallet.quota || 0) + Number(amount));
  return prisma.wallet.update({ where: { id: wallet.id }, data: { quota: newQuota } });
}

// create a WalletTx record
async function createWalletTx({ walletId, tokenInOut }) {
  return prisma.walletTx.create({ data: { walletId: String(walletId), tokenInOut } });
}

// Additional CRUD
async function getWalletById(id) {
  return prisma.wallet.findUnique({ where: { id: String(id) } });
}

async function getWalletByEmail(email) {
  return prisma.wallet.findFirst({ where: { email } });
}

async function listWallets(filter = {}) {
  return prisma.wallet.findMany({ where: filter });
}

async function updateWallet(id, data) {
  return prisma.wallet.update({ where: { id: String(id) }, data });
}

async function deleteWallet(id) {
  return prisma.wallet.delete({ where: { id: String(id) } });
}

async function listWalletTxs(filter = {}) {
  return prisma.walletTx.findMany({ where: filter, orderBy: { timestamp: 'desc' } });
}

module.exports = {
  createWallet,
  getWalletByUserEmail,
  listWalletsByUserEmail,
  switchWalletMode,
  depositToWallet,
  createWalletTx,
  getWalletById,
  getWalletByEmail,
  listWallets,
  updateWallet,
  deleteWallet,
  listWalletTxs,
};

// Additional helper functions expected by controllers
async function resolveUserEmail(userId) {
  // Accept either email or credId
  if (!userId) return null;
  if (String(userId).includes('@')) return userId;
  const user = await prisma.user.findUnique({ where: { credId: String(userId) } });
  return user ? user.email : null;
}

async function getWalletByUserId(userId) {
  const email = await resolveUserEmail(userId);
  if (!email) return null;
  return getWalletByEmail(email);
}

async function getWalletByAddress(addressOrId) {
  // Wallet model does not have an `address` field in Prisma schema; treat address as wallet.id
  return getWalletById(addressOrId);
}

async function listWalletsByUserId(userId) {
  const email = await resolveUserEmail(userId);
  if (!email) return [];
  return listWalletsByUserEmail(email);
}

async function importKeystore(userId, keystore) {
  throw new Error('Keystore import is disabled in this build');
}

async function exportKeystore(userId) {
  throw new Error('Keystore export is disabled in this build');
}

async function createTransactionToken({ walletId, amount, currency, kind, status }) {
  // normalize to WalletTx schema: tokenInOut
  return createWalletTx({ walletId, tokenInOut: amount });
}

async function buyToken(addressOrId, amount) {
  // Buy tokens using current RateToken: deduct cash (quota) and credit tokenBalance
  const wallet = await getWalletByAddress(addressOrId);
  if (!wallet) throw new Error('wallet not found');
  // find latest rate token (most recent begin)
  const now = new Date();
  // Prefer rates with begin <= now; fall back to the most recent if none have begin
  let rate = await prisma.rateToken.findFirst({ where: { begin: { lte: now } }, orderBy: { begin: 'desc' } });
  if (!rate) rate = await prisma.rateToken.findFirst({ orderBy: { begin: 'desc' } });
  if (!rate || !rate.bahtPerToken) throw new Error('Token rate unavailable');

  const bahtPerToken = Number(rate.bahtPerToken);
  if (!bahtPerToken || bahtPerToken <= 0) throw new Error('Invalid token rate');

  const amountBaht = Number(amount);
  if (isNaN(amountBaht) || amountBaht <= 0) throw new Error('Invalid purchase amount');

  // use quota as the stored cash balance
  const currentCash = Number(wallet.quota || 0);
  if (currentCash < amountBaht) throw new Error('Insufficient cash balance');

  const tokensToCredit = Number((amountBaht / bahtPerToken));

  const updated = await prisma.wallet.update({ where: { id: wallet.id }, data: { quota: currentCash - amountBaht, tokenBalance: Number((Number(wallet.tokenBalance || 0) + tokensToCredit).toFixed(8)) } });

  const tx = await createWalletTx({ walletId: updated.id, tokenInOut: tokensToCredit });
  return { wallet: updated, transaction: tx, rate };
}

module.exports = {
  createWallet,
  getWalletByUserEmail,
  listWalletsByUserEmail,
  switchWalletMode,
  depositToWallet,
  createWalletTx,
  getWalletById,
  getWalletByEmail,
  listWallets,
  updateWallet,
  deleteWallet,
  listWalletTxs,
  // controller-friendly aliases
  resolveUserEmail,
  getWalletByUserId,
  getWalletByAddress,
  listWalletsByUserId,
  importKeystore,
  exportKeystore,
  createTransactionToken,
  buyToken,
};
