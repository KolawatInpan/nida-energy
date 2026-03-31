const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');

/**
 * @openapi
 * /wallets:
 *   get:
 *     summary: Get list of wallets
 *     tags:
 *       - Wallet
 *     responses:
 *       '200':
 *         description: Array of wallets
 */
router.get('/', walletController.getWallets);

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
 *       '404':
 *         description: Wallet not found
 */
router.get('/:id', walletController.getWalletById);

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
router.post('/register', walletController.createWallet);

router.post('/:email/add-balance', walletController.addBalance);

router.post('/by-email/:email/topup', walletController.topupByEmail);
router.get('/:walletId/transactions', walletController.getWalletTransactions);
router.post('/:walletId/recalculate-balance', walletController.recalculateWalletBalance);

module.exports = router;



