const express = require('express');
const router  = express.Router();
const favoriteController = require('../controllers/property/favorite.controller');
const { protect }        = require('../middlewares/auth.middleware');
const validate           = require('../middlewares/validation.middleware');
const { addFavoriteSchema } = require('../validators/validators');

router.use(protect);

/**
 * @swagger
 * /favorites:
 *   post:
 *     tags: [❤️ Favorites]
 *     summary: Add a property to favorites
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [property_id]
 *             properties:
 *               property_id: { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *     responses:
 *       201:
 *         description: Property added to favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string, example: success }
 *                 message: { type: string, example: Added to favorites }
 *       400:
 *         description: Already in favorites
 *       401: { $ref: '#/components/responses/401' }
 */
router.post('/', validate(addFavoriteSchema), favoriteController.addFavorite);

/**
 * @swagger
 * /favorites:
 *   get:
 *     tags: [❤️ Favorites]
 *     summary: Get my favorite properties
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: My favorites list
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         favorites:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Property' }
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/', favoriteController.getFavorites);

/**
 * @swagger
 * /favorites/{propertyId}:
 *   delete:
 *     tags: [❤️ Favorites]
 *     summary: Remove a property from favorites
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema: { type: string }
 *         description: Property ID to remove from favorites
 *     responses:
 *       204:
 *         description: Removed from favorites
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.delete('/:propertyId', favoriteController.removeFavorite);

module.exports = router;
