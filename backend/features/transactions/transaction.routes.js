const express = require('express');
const router = express.Router();
const TransactionController = require('./transaction.controller');

/**
 * @openapi
 * /api/transactions:
 *   get:
 *     summary: List transactions
 *     tags:
 *       - Transactions
 *     responses:
 *       '200':
 *         description: Array of transactions
 *         content:
 *           application/json:
 *             example:
 *               transactions: [{ "id": 1, "amount": 12.5 }]
 */
router.get('/', TransactionController.getTransactions);

/**
 * @openapi
 * /api/transactions/blockchain/recent:
 *   get:
 *     summary: Get recent blockchain transactions
 *     tags:
 *       - Transactions
 *     responses:
 *       '200':
 *         description: Recent blockchain transactions
 *         content:
 *           application/json:
 *             example:
 *               [{ "txHash": "0xabc", "status": "confirmed" }]
 */
router.get('/blockchain/recent', TransactionController.getRecentBlockchainTransactions);

/**
 * @openapi
 * /api/transactions/blockchain/tx/{txHash}:
 *   get:
 *     summary: Get blockchain transaction by hash
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: txHash
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Blockchain transaction
 *         content:
 *           application/json:
 *             example:
 *               { "txHash": "0xabc", "blockNumber": 12345 }
 */
router.get('/blockchain/tx/:txHash', TransactionController.getBlockchainTransactionByHash);

/**
 * @openapi
 * /api/transactions:
 *   post:
 *     summary: Create transaction
 *     tags:
 *       - Transactions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionCreate'
 *     responses:
 *       '201':
 *         description: Transaction created
 *         content:
 *           application/json:
 *             example:
 *               { "id": 123, "status": "created" }
 */
router.post('/', TransactionController.createTransaction);

/**
 * @openapi
 * /api/transactions/wallet/{walletId}:
 *   get:
 *     summary: Get transactions by wallet
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Array of transactions
 *         content:
 *           application/json:
 *             example:
 *               [{ "id":1, "amount":10 }]
 */
router.get('/wallet/:walletId', TransactionController.getTransactionsByWallet);

/**
 * @openapi
 * /api/transactions/building/{buildingName}:
 *   get:
 *     summary: Get transactions by building
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: buildingName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Array of transactions
 *         content:
 *           application/json:
 *             example:
 *               [{ "id":2, "amount":20 }]
 */
router.get('/building/:buildingName', TransactionController.getTransactionsByBuilding);

/**
 * @openapi
 * /api/transactions/{id}/verification-preview:
 *   get:
 *     summary: Get transaction verification preview
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Verification preview
 *         content:
 *           application/json:
 *             example:
 *               { "id": 123, "preview": "..." }
 */
router.get('/:id/verification-preview', TransactionController.getTransactionVerificationPreview);

/**
 * @openapi
 * /api/transactions/{id}/verify:
 *   post:
 *     summary: Publish transaction verification
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Verification published
 *         content:
 *           application/json:
 *             example:
 *               { "status": "published", "id": 123 }
 */
router.post('/:id/verify', TransactionController.publishTransactionVerification);

/**
 * @openapi
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction by id
 *     tags:
 *       - Transactions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Transaction object
 *         content:
 *           application/json:
 *             example:
 *               { "id":123, "amount":12.5 }
 */
router.get('/:id', TransactionController.getTransactionById);

module.exports = router;
