const express = require('express');
const router = express.Router();
const SystemController = require('./system.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

router.post('/notifications', auth, requireRole('ADMIN'), SystemController.createNotification);
router.get('/notifications', auth, requireRole('ADMIN'), SystemController.listNotifications);
router.delete('/notifications/:id', auth, requireRole('ADMIN'), SystemController.deleteNotification);

router.post('/activity', auth, requireRole('ADMIN'), SystemController.logActivity);
router.post('/reset-database', auth, requireRole('ADMIN'), SystemController.resetDatabase);

module.exports = router;



