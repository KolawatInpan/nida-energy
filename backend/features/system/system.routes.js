const express = require('express');
const router = express.Router();
const SystemController = require('./system.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

/**
 * @openapi
 * /system/notifications:
 *   post:
 *     summary: Create a system notification (admin)
 *     tags:
 *       - System
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Notification created
 */
router.post('/notifications', auth, requireRole('ADMIN'), SystemController.createNotification);

/**
 * @openapi
 * /system/notifications:
 *   get:
 *     summary: List system notifications (admin)
 *     tags:
 *       - System
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Array of notifications
 */
router.get('/notifications', auth, requireRole('ADMIN'), SystemController.listNotifications);

/**
 * @openapi
 * /system/notifications/{id}:
 *   delete:
 *     summary: Delete a system notification (admin)
 *     tags:
 *       - System
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Notification deleted
 */
router.delete('/notifications/:id', auth, requireRole('ADMIN'), SystemController.deleteNotification);

/**
 * @openapi
 * /system/activity:
 *   post:
 *     summary: Log system activity (admin)
 *     tags:
 *       - System
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '201':
 *         description: Activity logged
 */
router.post('/activity', auth, requireRole('ADMIN'), SystemController.logActivity);

/**
 * @openapi
 * /system/reset-database:
 *   post:
 *     summary: Reset the database (admin)
 *     tags:
 *       - System
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Database reset
 */
router.post('/reset-database', auth, requireRole('ADMIN'), SystemController.resetDatabase);

/**
 * Example responses:
 * POST /system/activity -> { "status": "OK" }
 * POST /system/reset-database -> { "status": "OK", "msg": "reset started" }
 */

module.exports = router;



