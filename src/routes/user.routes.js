const express = require('express');
const router  = express.Router();
const userController = require('../controllers/user.controller');
const { protect }    = require('../middlewares/auth.middleware');
const restrictTo     = require('../middlewares/restrictTo.middleware');
const { uploadSingleImage } = require('../middlewares/upload.middleware');
const validate       = require('../middlewares/validation.middleware');
const { changePasswordSchema } = require('../validators/auth.validators');

router.use(protect);

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [👤 Users]
 *     summary: Get my profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:   { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/me', userController.getMe);

/**
 * @swagger
 * /users/me:
 *   patch:
 *     tags: [👤 Users]
 *     summary: Update my profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:   { type: string }
 *               phone:  { type: string }
 *               photo:  { type: string, format: binary }
 *               bio:    { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 *       401: { $ref: '#/components/responses/401' }
 */
router.patch('/me', uploadSingleImage, userController.updateMe);

/**
 * @swagger
 * /users/change-password:
 *   patch:
 *     tags: [👤 Users]
 *     summary: Change password
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: OldPassword123! }
 *               newPassword:     { type: string, example: NewPassword456! }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password is incorrect
 *       401: { $ref: '#/components/responses/401' }
 */
router.patch('/change-password', validate(changePasswordSchema), userController.changePassword);

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [👤 Users]
 *     summary: Get all users (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [buyer, owner, agent, admin] }
 *     responses:
 *       200:
 *         description: List of all users
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 */
router.get('/', restrictTo('admin'), userController.getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [👤 Users]
 *     summary: Get user by ID (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User data
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.get('/:id', restrictTo('admin'), userController.getUser);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     tags: [👤 Users]
 *     summary: Delete user (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: User deleted
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.delete('/:id', restrictTo('admin'), userController.deleteUser);

module.exports = router;
