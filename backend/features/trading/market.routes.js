const express = require('express');
const router = express.Router();
const MarketController = require('./market.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

// POST /api/market/orders  { side: 'BID'|'OFFER', walletId, kwh, price }
router.post('/orders', MarketController.createOrder);
// POST /api/market/sell-to-bid  { orderId, sellerWalletId, kwh, price }
router.post('/sell-to-bid', MarketController.sellToBid);

// GET /api/market/orders
router.get('/orders', MarketController.listOrders);

// PUT /api/market/orders/:id/cancel?side=BID|OFFER
router.put('/orders/:id/cancel', MarketController.cancelOrder);

// GET /api/market/matches
router.get('/matches', MarketController.listMatches);

// POST /api/market/trigger-clearing — ⚡ Force Day-Ahead Clearing (matching + force distribution)
router.post('/trigger-clearing', MarketController.triggerClearing);

// POST /api/market/trigger-matching — ⚡ 00:00 Matching only (no battery required, highest bid wins)
router.post('/trigger-matching', MarketController.triggerMatching);

module.exports = router;
