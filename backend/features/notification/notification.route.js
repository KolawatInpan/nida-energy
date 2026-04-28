const express = require('express');
const router = express.Router();
const { getNotifications } = require('./notification.service');

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
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const notifications = await getNotifications(userId);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
