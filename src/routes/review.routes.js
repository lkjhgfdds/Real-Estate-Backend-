const express = require('express');
const router  = express.Router();
const reviewController = require('../controllers/property/review.controller');
const { protect }      = require('../middlewares/auth.middleware');
const validate         = require('../middlewares/validation.middleware');
const { createReviewSchema, updateReviewSchema } = require('../validators/review.validators');

/**
 * @swagger
 * /reviews/property/{propertyId}:
 *   get:
 *     tags: [⭐ Reviews]
 *     summary: Get all reviews for a property
 *     security: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema: { type: string }
 *         description: Property ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Property reviews
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
 *                         reviews:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:     { type: string }
 *                               rating:  { type: number, minimum: 1, maximum: 5 }
 *                               comment: { type: string }
 *                               user:    { $ref: '#/components/schemas/User' }
 *                               createdAt: { type: string, format: date-time }
 *       404: { $ref: '#/components/responses/404' }
 */
router.get('/property/:propertyId', reviewController.getPropertyReviews);

/**
 * @swagger
 * /reviews:
 *   post:
 *     tags: [⭐ Reviews]
 *     summary: Create a review for a property
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [property_id, rating]
 *             properties:
 *               property_id: { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *               rating:      { type: integer, minimum: 1, maximum: 5, example: 4 }
 *               comment:     { type: string, example: 'شقة ممتازة وموقع رائع' }
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     review:
 *                       type: object
 *                       properties:
 *                         _id:        { type: string }
 *                         rating:     { type: integer }
 *                         comment:    { type: string }
 *                         createdAt:  { type: string, format: date-time }
 *       400:
 *         description: Already reviewed this property
 *       401: { $ref: '#/components/responses/401' }
 */
router.post('/', protect, validate(createReviewSchema), reviewController.createReview);

/**
 * @swagger
 * /reviews/{id}:
 *   patch:
 *     tags: [⭐ Reviews]
 *     summary: Update my review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Review ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:  { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       200:
 *         description: Review updated
 *       401: { $ref: '#/components/responses/401' }
 *       403:
 *         description: Not your review
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id', protect, validate(updateReviewSchema), reviewController.updateReview);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     tags: [⭐ Reviews]
 *     summary: Delete my review
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Review deleted
 *       401: { $ref: '#/components/responses/401' }
 *       403:
 *         description: Not your review
 *       404: { $ref: '#/components/responses/404' }
 */
router.delete('/:id', protect, reviewController.deleteReview);

module.exports = router;
