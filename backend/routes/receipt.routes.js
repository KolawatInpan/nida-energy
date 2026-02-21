const express = require('express');
const router = express.Router();
const ReceiptController = require('../controllers/receipt.controller');

router.get('/', ReceiptController.listReceipts);
router.get('/:id', ReceiptController.getReceipt);
router.post('/', ReceiptController.createReceipt);
router.delete('/:id', ReceiptController.deleteReceipt);

module.exports = router;
