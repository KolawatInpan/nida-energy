const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user.controller');
const auth = require('../middleware/auth');


router.get('/', UserController.getUsers);
router.get('/:id', UserController.getUser);
router.get('/building/:buildingName', UserController.getUserByBuildingName);


module.exports = router;
