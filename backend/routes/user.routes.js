const express = require('express');
const router = express.Router();
const { register, login, getUsers, getUser, me } = require('../controllers/user.controller');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/', getUsers);
router.get('/me', auth, me);
router.get('/:id', getUser);
router.patch('/:id', auth, require('../controllers/user.controller').updateUser);
router.delete('/:id', auth, require('../controllers/user.controller').deleteUser);

module.exports = router;
