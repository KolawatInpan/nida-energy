const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead } = require('./notification.service');

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Get notifications (optionally for a user)
 *     tags:
 *       - Notification
 *     parameters:
 *       - name: userId
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Notifications payload
 *         content:
 *           application/json:
 *             example:
 *               { "notifications": [{ "id":1, "message":"hello" }] }
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId ? req.query.userId : null;
    const notifications = await getNotifications(userId);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const updated = await markAsRead(req.params.id);
    res.json({ success: true, notification: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
