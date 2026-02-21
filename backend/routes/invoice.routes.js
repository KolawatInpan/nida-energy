const express = require('express');
const router = express.Router();
const InvoiceController = require('../controllers/invoice.controller');

router.get('/', InvoiceController.listInvoices);
router.get('/:id', InvoiceController.getInvoice);
router.post('/', InvoiceController.createInvoice);
// force/generate yearly invoices: body { year: 2024 }
router.post('/generate-yearly', InvoiceController.generateYearlyInvoices);
// generate invoices for a single building/month -> body { buildingId, year, month }
router.post('/generate-building-month', InvoiceController.generateBuildingMonthInvoices);
// pay invoice: POST /api/invoices/:id/pay { payerWalletId, method }
router.post('/:id/pay', InvoiceController.payInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);

module.exports = router;
