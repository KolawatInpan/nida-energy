const express = require('express');
const router = express.Router();
const SystemController = require('../controllers/system.controller');

router.post('/notifications', SystemController.createNotification);
router.get('/notifications', SystemController.listNotifications);
router.delete('/notifications/:id', SystemController.deleteNotification);

router.post('/activity', SystemController.logActivity);

module.exports = router;
