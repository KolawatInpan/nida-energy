const BuildingModel = require('./building.model');
const WalletModel = require('../wallets/wallet.model');

async function createBuilding(name, mapURL, address, province, postalCode, assignedContactEmail) {
  const newBuilding = await BuildingModel.createBuilding(name, mapURL, address, province, postalCode, assignedContactEmail);

  // Every building owns exactly one wallet (Wallet.buildingId is 1:1), so it is created
  // unconditionally. This used to be gated on `email`, which Building no longer has after
  // the email-unification refactor — so a building created without a contact email silently
  // ended up with no wallet at all, and /wallet/<building> answered 404.
  try {
    await WalletModel.createWallet({ buildingId: newBuilding.id });
  } catch (err) {
    // P2002 = a wallet already exists for this building (1:1), which is fine.
    if (err?.code !== 'P2002') {
      console.warn('Auto-create wallet failed for building:', newBuilding.id, err?.message || err);
    }
  }

  return newBuilding;
}

module.exports = {
  ...BuildingModel,
  createBuilding,
};