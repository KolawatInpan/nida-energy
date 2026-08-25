const express = require('express');
const router = express.Router();
const policy = require('./policy.controller');

router.get('', policy.getPolicy);
router.put('', policy.updatePolicy);

module.exports = router;
