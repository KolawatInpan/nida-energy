const express = require('express');
const router = express.Router();
const InvoiceController = require('./invoice.controller');

/**
 * @route GET /api/invoices/summary
 * @desc Get invoice summary for a given month/year
 */
router.get('/summary', InvoiceController.getInvoiceSummary);

/**
 * @route GET /api/invoices/quota-warnings
 * @desc Get quota warning overview for all buildings
 */
router.get('/quota-warnings', InvoiceController.getQuotaWarnings);

/**
 * @route POST /api/invoices/generate
 * @desc Generate monthly invoices for all consuming buildings
 */
router.post('/generate', InvoiceController.generateInvoices);

/**
 * @route POST /api/invoices/purchase
 * @desc Purchase energy and create invoice + receipt
 */
router.post('/purchase', InvoiceController.purchaseEnergy);

/**
 * @route POST /api/invoices/:id/pay
 * @desc Pay invoice from linked wallet if balance is sufficient
 */
router.post('/:id/pay', InvoiceController.payInvoice);

/**
 * @route GET /api/invoices
 * @desc Get all invoices
 */
router.get('/', InvoiceController.getInvoices);

/**
 * @route GET /api/invoices/:id
 * @desc Get invoice by ID
 */
router.get('/:id', InvoiceController.getInvoiceById);

module.exports = router;



