const express = require('express');
const router = express.Router();
// Placeholder battery controller can be implemented later

/**
 * @openapi
 * /energy/battery:
 *   get:
 *     summary: Battery endpoints placeholder
 *     tags:
 *       - Energy
 *     responses:
 *       '200':
 *         description: Battery endpoints info
 */
router.get('/', (req, res) => {
	res.json({ message: 'Battery endpoints placeholder' });
});

module.exports = router;


