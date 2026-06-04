const express = require('express');
const router = express.Router();
const PaymentController = require('./payment.controller');

router.post('/create-payment-intent', PaymentController.createPaymentIntent);

module.exports = router;