const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');

/**
 * @openapi
 * /api/wallets:
 *   get:
 *     summary: Get list of wallets
 *     tags:
 *       - Wallet
 *     responses:
 *       '200':
 *         description: Array of wallets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wallets:
 *                   type: array
 *                   items:
 *                     type: object
 *             example:
 *               wallets: [{ "walletId": "w_123", "ownerEmail": "owner@example.com" }]
 */
router.get('/', walletController.getWallets);

/**
 * @openapi
 * /api/wallets/{id}:
 *   get:
 *     summary: Get wallet by id
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Wallet object
 *       '404':
 *         description: Wallet not found
 */
/**
 * @openapi
 * /wallets/{id}:
 *   get:
 *     summary: Get wallet by id
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Wallet object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletBalance'
 *             examples:
 *               success:
 *                 value:
 *                   walletId: w_123
 *                   balance: 123.45
 *       '404':
 *         description: Wallet not found
 */
router.get('/:id', walletController.getWalletById);

/**
 * @openapi
 * /wallets/by-email/{email}:
 *   get:
 *     summary: Get wallet by owner email
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Wallet object
 */
router.get('/by-email/:email', walletController.getWalletByEmail);

/**
 * @openapi
 * /wallets/{walletId}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: { walletId, balance }
 *       '404':
 *         description: Wallet not found
 */
/**
 * @openapi
 * /wallets/{walletId}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: { walletId, balance }
 *       '404':
 *         description: Wallet not found
 */
router.get('/:walletId/balance', walletController.getBalance);

/**
 * @openapi
 * /wallets:
 *   post:
 *     summary: Create a new wallet
 *     tags:
 *       - Wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               ownerEmail:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Wallet created
 */
/**
 * @openapi
 * /api/wallets/register:
 *   post:
 *     summary: Create a new wallet
 *     tags:
 *       - Wallet
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WalletCreate'
 *     responses:
 *       '201':
 *         description: Wallet created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 walletId:
 *                   type: string
 *                   example: w_123
 */
router.post('/register', walletController.createWallet);

/**
 * @openapi
 * /wallets/{email}/add-balance:
 *   post:
 *     summary: Add balance to wallet (internal)
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Balance updated
 */
/**
 * @openapi
 * /wallets/{email}/add-balance:
 *   post:
 *     summary: Add balance to wallet (internal)
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopupRequest'
 *     responses:
 *       '200':
 *         description: Balance updated
 */
router.post('/:email/add-balance', walletController.addBalance);

/**
 * @openapi
 * /wallets/by-email/{email}/topup:
 *   post:
 *     summary: Top-up wallet by email
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Top-up processed
 */
/**
 * @openapi
 * /wallets/by-email/{email}/topup:
 *   post:
 *     summary: Top-up wallet by email
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: email
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TopupRequest'
 *     responses:
 *       '200':
 *         description: Top-up processed
 */
router.post('/by-email/:email/topup', walletController.topupByEmail);
/**
 * @openapi
 * /wallets/{walletId}/transactions:
 *   get:
 *     summary: Get wallet transactions
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Array of transactions
 */
/**
 * @openapi
 * /wallets/{walletId}/transactions:
 *   get:
 *     summary: Get wallet transactions
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Array of transactions
 */
router.get('/:walletId/transactions', walletController.getWalletTransactions);
/**
 * @openapi
 * /wallets/{walletId/recalculate-balance}:
 *   post:
 *     summary: Recalculate wallet balance
 *     tags:
 *       - Wallet
 *     parameters:
 *       - name: walletId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Recalculation triggered
 */
router.post('/:walletId/recalculate-balance', walletController.recalculateWalletBalance);

module.exports = router;



