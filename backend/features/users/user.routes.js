const express = require('express');
const router = express.Router();
const UserController = require('./user.controller');
const auth = require('../../middleware/auth');
const requireRole = require('../../middleware/requireRole');

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Get user list
 *     tags:
 *       - User
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Successful response with user list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 */
router.get('/', auth, requireRole('ADMIN'), UserController.getUsers);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get a single user by credId or email
 *     tags:
 *       - User
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: credId or email (if contains @)
 *     responses:
 *       '200':
 *         description: User object
 *       '404':
 *         description: User not found
 */
router.get('/:id', UserController.getUser);

/**
 * @openapi
 * /users/building/{buildingName}:
 *   get:
 *     summary: Get user by building name
 *     tags:
 *       - User
 *     parameters:
 *       - name: buildingName
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User object for building owner
 *       '404':
 *         description: User not found
 */
router.get('/building/:buildingName', UserController.getUserByBuildingName);

/**
 * @openapi
 * /users/building/id/{buildingId}:
 *   get:
 *     summary: Get user by building id
 *     tags:
 *       - User
 *     parameters:
 *       - name: buildingId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: User object for building owner
 *       '404':
 *         description: User not found
 */
router.get('/building/id/:buildingId', UserController.getUserByBuildingId);

/**
 * @openapi
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '201':
 *         description: User created
 *       '400':
 *         description: Bad request / validation error
 */
router.post('/register', UserController.register);

/**
 * @openapi
 * /users/login:
 *   post:
 *     summary: Login with email and password
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Login successful with JWT token
 *       '401':
 *         description: Invalid credentials
 */
router.post('/login', UserController.login);
router.put('/:id', auth, requireRole('ADMIN'), UserController.updateUser);
router.delete('/:id', auth, requireRole('ADMIN'), UserController.deleteUser);

module.exports = router;



