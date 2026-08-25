const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const settings = require('./settings.controller');

/**
 * @openapi
 * /api/settings/notification:
 *   get:
 *     summary: Get current user's notification preferences
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: Notification preferences payload
 *   put:
 *     summary: Update current user's notification preferences
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               telegramChatId: { type: string, nullable: true }
 *               notifyEmail: { type: boolean }
 *               notifyTelegram: { type: boolean }
 *     responses:
 *       '200':
 *         description: Updated notification preferences
 */
router.get('/notification', auth, settings.getNotificationSettings);
router.put('/notification', auth, settings.updateNotificationSettings);

module.exports = router;
