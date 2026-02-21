const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');

// Use explicit references from the controller object to avoid destructuring errors
router.post('/register', walletController.registerWallet);
// list all wallets
router.get('/', walletController.listAllWallets);
// Export/import handlers were removed from controller; provide safe 501 placeholders
router.post('/export', (req, res) => res.status(501).json({ error: 'Export keystore not implemented' }));
router.post('/import', (req, res) => res.status(501).json({ error: 'Import keystore not implemented' }));
router.post('/transfer', walletController.transferToWallet);
router.post('/deposit', walletController.depositWallet);
router.post('/buy', walletController.buyToken);

// switch-mode not implemented in controller; expose placeholder
router.post('/switch-mode', (req, res) => res.status(501).json({ error: 'Switch mode not implemented' }));
router.get('/get-by-address/:address', walletController.getWalletByAddress);
router.get('/get-by-user/:userId', walletController.getWalletByUser);
router.get('/list-by-user/:userId', walletController.listWalletsByUser);
// wallet transactions
router.get('/:id/txs', walletController.getWalletTxs);

module.exports = router;
