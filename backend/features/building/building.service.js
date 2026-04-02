const BuildingModel = require('./building.model');
const WalletModel = require('../wallets/wallet.model');

async function createBuilding(name, mapURL, address, province, postalCode, email) {
  const newBuilding = await BuildingModel.createBuilding(name, mapURL, address, province, postalCode, email);

  try {
    await WalletModel.createWallet({ buildingId: newBuilding.id, email });
  } catch (err) {
    console.warn('Auto-create wallet failed for building:', newBuilding.id, err);
  }

  return newBuilding;
}

module.exports = {
  ...BuildingModel,
  createBuilding,
};