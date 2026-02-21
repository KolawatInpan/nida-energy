// backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { sendTransaction, listTransactions, getTransaction } = require('../controllers/transaction.controller');
const { recordTransaction } = require('../controllers/transaction.controller');

router.post('/send', sendTransaction);
// record a completed transaction without sending on-chain (dev-friendly)
router.post('/record', recordTransaction);
router.get('/history', listTransactions);
router.get('/:id', getTransaction);

module.exports = router;
