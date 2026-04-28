const express = require('express');
const router = express.Router();
const InvoiceController = require('./invoice.controller');

/**
 * @openapi
 * /api/invoices/summary:
 *   get:
 *     summary: Get invoice summary for a given month/year
 *     tags:
 *       - Invoice
 *     responses:
 *       '200':
 *         description: Invoice summary
 *         content:
 *           application/json:
 *             example:
 *               { "month": "2026-04", "total": 1234.5 }
 */
router.get('/summary', InvoiceController.getInvoiceSummary);

/**
 * @openapi
 * /api/invoices/quota-warnings:
 *   get:
 *     summary: Get quota warning overview for all buildings
 *     tags:
 *       - Invoice
 *     responses:
 *       '200':
 *         description: Quota warnings
 *         content:
 *           application/json:
 *             example:
 *               [{ "buildingId":1, "warning": true }]
 */
router.get('/quota-warnings', InvoiceController.getQuotaWarnings);

/**
 * @openapi
 * /api/invoices/generate:
 *   post:
 *     summary: Generate monthly invoices for consuming buildings
 *     tags:
 *       - Invoice
 *     responses:
 *       '200':
 *         description: Invoices generated
 *         content:
 *           application/json:
 *             example:
 *               { "generated": 120 }
 */
router.post('/generate', InvoiceController.generateInvoices);

/**
 * @openapi
 * /api/invoices/purchase:
 *   post:
 *     summary: Purchase energy and create invoice and receipt
 *     tags:
 *       - Invoice
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               offerId:
 *                 type: integer
 *                 description: ID of the marketplace offer to purchase
 *               buyerWalletId:
 *                 type: string
 *                 description: Wallet id of the buyer
 *               targetBuildingId:
 *                 type: integer
 *                 description: Building id to receive the purchased energy
 *               amount:
 *                 type: number
 *                 description: Optional amount (kWh) to purchase; defaults to offer quantity
 *             required:
 *               - offerId
 *               - buyerWalletId
 *               - targetBuildingId
 *           example:
 *             offerId: 12
 *             buyerWalletId: "w_123"
 *             targetBuildingId: 45
 *             amount: 10
 *     responses:
 *       '201':
 *         description: Purchase processed
 *         content:
 *           application/json:
 *             example:
 *               { "invoiceId": 45, "receiptId": 77 }
 */
router.post('/purchase', InvoiceController.purchaseEnergy);

/**
 * @openapi
 * /api/invoices/{id}/pay:
 *   post:
 *     summary: Pay invoice
 *     tags:
 *       - Invoice
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Invoice paid
 *         content:
 *           application/json:
 *             example:
 *               { "status": "PAID", "invoiceId": 45 }
 */
router.post('/:id/pay', InvoiceController.payInvoice);

/**
 * @openapi
 * /api/invoices:
 *   get:
 *     summary: Get all invoices
 *     tags:
 *       - Invoice
 *     responses:
 *       '200':
 *         description: Array of invoices
 *         content:
 *           application/json:
 *             example:
 *               [{ "id":45, "amount":100 }]
 */
router.get('/', InvoiceController.getInvoices);

/**
 * @openapi
 * /api/invoices/{id}:
 *   get:
 *     summary: Get invoice by ID
 *     tags:
 *       - Invoice
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Invoice object
 *         content:
 *           application/json:
 *             example:
 *               { "id":45, "amount":100, "status":"DUE" }
 */
router.get('/:id', InvoiceController.getInvoiceById);

module.exports = router;



