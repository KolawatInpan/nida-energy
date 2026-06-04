const generatePayload = require('promptpay-qr');
const qrcode = require('qrcode');
const paymentModel = require('./payment.model');

const PROMPTPAY_ID = process.env.PROMPTPAY_ID || '0960853055';

async function createPaymentIntent({ amount, email }) {
    if (!amount || amount <= 0) {
        throw new Error('Invalid amount');
    }

    const payload = generatePayload(PROMPTPAY_ID, { amount });
    const qrImageUrl = await qrcode.toDataURL(payload);

    // Record the payment intent
    try {
        await paymentModel.createPaymentRecord({ email, amount, status: 'pending' });
    } catch (e) {
        console.warn('Failed to record payment intent:', e.message);
    }

    return {
        clientSecret: 'promptpay',
        qrUrl: qrImageUrl,
        isMock: !process.env.PROMPTPAY_ID,
    };
}

module.exports = { createPaymentIntent };
