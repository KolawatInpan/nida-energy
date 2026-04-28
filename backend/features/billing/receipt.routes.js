const express = require('express');
const router = express.Router();
const ReceiptController = require('./receipt.controller');

/**
 * @openapi
 * /api/receipts:
 *   get:
 *     summary: List receipts
 *     tags:
 *       - Receipt
 *     responses:
 *       '200':
 *         description: Array of receipts
 *         content:
 *           application/json:
 *             example:
 *               [{ "id":77, "invoiceId":12 }]
 */
router.get('/', ReceiptController.listReceipts);

/**
 * @openapi
 * /api/receipts/{id}:
 *   get:
 *     summary: Get receipt by id
 *     tags:
 *       - Receipt
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Receipt object
 *         content:
 *           application/json:
 *             example:
 *               { "id":77, "invoiceId":12, "amount":100.5 }
 */
router.get('/:id', ReceiptController.getReceipt);

/**
 * @openapi
 * /api/receipts:
 *   post:
 *     summary: Create receipt
 *     tags:
 *       - Receipt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       '201':
 *         description: Receipt created
 *         content:
 *           application/json:
 *             example:
 *               { "id":77, "invoiceId":12, "amount":100.5 }
 */
router.post('/', ReceiptController.createReceipt);

/**
 * Example request:
 *   {
 *     "invoiceId": 12,
 *     "amount": 100.5,
 *     "payer": "user@example.com"
 *   }
 * Example response:
 *   { "id": 77, "invoiceId": 12, "amount": 100.5 }
 */

/**
 * @openapi
 * /api/receipts/{id}:
 *   delete:
 *     summary: Delete a receipt
 *     tags:
 *       - Receipt
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Receipt deleted
 *         content:
 *           application/json:
 *             example:
 *               { "status": "deleted", "id": "77" }
 */
router.delete('/:id', ReceiptController.deleteReceipt);

module.exports = router;



