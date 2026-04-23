const express = require('express');
const router  = express.Router();
const searchController = require('../controllers/search/search.controller');
const { protect }      = require('../middlewares/auth.middleware');
const { cacheMiddleware } = require('../middlewares/cache.middleware');
const { searchLimiter }   = require('../middlewares/advancedRateLimit.middleware');

/**
 * @swagger
 * /search:
 *   get:
 *     tags: [🔍 Search]
 *     summary: Advanced property search with filters
 *     security: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Text search keyword
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [apartment, villa, house, studio, office, shop, land, commercial] }
 *       - in: query
 *         name: listingType
 *         schema: { type: string, enum: [sale, rent] }
 *       - in: query
 *         name: city
 *         schema: { type: string, example: Cairo }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number, example: 100000 }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number, example: 5000000 }
 *       - in: query
 *         name: minArea
 *         schema: { type: number }
 *       - in: query
 *         name: maxArea
 *         schema: { type: number }
 *       - in: query
 *         name: bedrooms
 *         schema: { type: integer }
 *       - in: query
 *         name: bathrooms
 *         schema: { type: integer }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [price, -price, createdAt, -createdAt, avgRating], default: -createdAt }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Search results
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
 *                         properties:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Property' }
 *       429: { $ref: '#/components/responses/429' }
 */
router.get('/', searchLimiter, cacheMiddleware(30), searchController.advancedSearch);

/**
 * @swagger
 * /search/similar/{id}:
 *   get:
 *     tags: [🔍 Search]
 *     summary: Get similar properties to a given property
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reference property ID
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6 }
 *     responses:
 *       200:
 *         description: Similar properties
 *       404: { $ref: '#/components/responses/404' }
 */
router.get('/similar/:id', cacheMiddleware(60), searchController.getSimilarProperties);

/**
 * @swagger
 * /search/saved:
 *   get:
 *     tags: [🔍 Search]
 *     summary: Get my saved searches
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Saved searches list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     savedSearches:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:     { type: string }
 *                           name:    { type: string }
 *                           filters: { type: object }
 *                           createdAt: { type: string, format: date-time }
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/saved', protect, searchController.getSavedSearches);

/**
 * @swagger
 * /search/saved:
 *   post:
 *     tags: [🔍 Search]
 *     summary: Save a search query for later
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, filters]
 *             properties:
 *               name:    { type: string, example: 'شقق القاهرة الجديدة' }
 *               filters:
 *                 type: object
 *                 properties:
 *                   city:        { type: string }
 *                   type:        { type: string }
 *                   minPrice:    { type: number }
 *                   maxPrice:    { type: number }
 *                   bedrooms:    { type: integer }
 *     responses:
 *       201:
 *         description: Search saved
 *       401: { $ref: '#/components/responses/401' }
 */
router.post('/saved', protect, searchController.saveSearch);

/**
 * @swagger
 * /search/saved/{id}:
 *   delete:
 *     tags: [🔍 Search]
 *     summary: Delete a saved search
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Saved search deleted
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.delete('/saved/:id', protect, searchController.deleteSavedSearch);

/**
 * @swagger
 * /search/analytics/{id}:
 *   get:
 *     tags: [🔍 Search]
 *     summary: Get property analytics (views, inquiries, favorites count)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Property ID
 *     responses:
 *       200:
 *         description: Property analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     views:      { type: integer }
 *                     inquiries:  { type: integer }
 *                     favorites:  { type: integer }
 *                     bookings:   { type: integer }
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.get('/analytics/:id', protect, searchController.getPropertyAnalytics);

module.exports = router;
