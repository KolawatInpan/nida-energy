const express = require('express');
const router = express.Router();
const TransactionController = require('./transaction.controller');

router.get('/', TransactionController.getTransactions);
router.get('/blockchain/recent', TransactionController.getRecentBlockchainTransactions);
router.get('/blockchain/tx/:txHash', TransactionController.getBlockchainTransactionByHash);
router.post('/', TransactionController.createTransaction);
router.get('/wallet/:walletId', TransactionController.getTransactionsByWallet);
router.get('/building/:buildingName', TransactionController.getTransactionsByBuilding);
router.get('/:id/verification-preview', TransactionController.getTransactionVerificationPreview);
router.post('/:id/verify', TransactionController.publishTransactionVerification);
router.get('/:id', TransactionController.getTransactionById);

module.exports = router;



