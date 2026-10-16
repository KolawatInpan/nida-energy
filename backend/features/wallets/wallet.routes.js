const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');

// GET /api/wallets — list all wallets
router.get('/', walletController.getWallets);

// GET /api/wallets/:id — get wallet by wallet id
router.get('/:id', walletController.getWalletById);

// GET /api/wallets/by-building/:buildingId — get wallet by building id
router.get('/by-building/:buildingId', walletController.getWalletByBuildingId);

// GET /api/wallets/:walletId/balance — get wallet balance
router.get('/:walletId/balance', walletController.getBalance);

// POST /api/wallets/register — create a new wallet (by buildingId)
router.post('/register', walletController.createWallet);

// POST /api/wallets/:walletId/add-balance — add balance to wallet
router.post('/:walletId/add-balance', walletController.addBalance);

// POST /api/wallets/by-building/:buildingId/topup — top-up wallet by building id
router.post('/by-building/:buildingId/topup', walletController.topupByBuildingId);

// GET /api/wallets/:walletId/transactions — get wallet transactions
router.get('/:walletId/transactions', walletController.getWalletTransactions);

// POST /api/wallets/:walletId/recalculate-balance — recalculate wallet balance
router.post('/:walletId/recalculate-balance', walletController.recalculateWalletBalance);

module.exports = router;
