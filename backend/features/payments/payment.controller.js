const paymentService = require('./payment.service');

async function createPaymentIntent(req, res) {
  try {
    const { amount, email } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    const result = await paymentService.createPaymentIntent({ amount, email });
    res.json(result);
  } catch (err) {
    console.error('createPaymentIntent error:', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createPaymentIntent };