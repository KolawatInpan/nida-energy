const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');

router.get('/', walletController.getWallets);
router.get('/:walletId/balance', walletController.getBalance);


module.exports = router;
