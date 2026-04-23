const express    = require('express');
const router     = express.Router();
const { protect }  = require('../middlewares/auth.middleware');
const restrictTo   = require('../middlewares/restrictTo.middleware');
const validate     = require('../middlewares/validation.middleware');
const { createAuctionSchema } = require('../validators/auction.validators');
const {
  createAuction, getAllAuctions, getAuction,
  updateAuction, deleteAuction, closeAuction,
  getMyAuctions, approveAuction,
} = require('../controllers/auction/auction.controller');

/**
 * @swagger
 * /auctions:
 *   get:
 *     tags: [🏆 Auctions]
 *     summary: Get all auctions
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [upcoming, active, closed, cancelled] }
 *     responses:
 *       200:
 *         description: List of auctions
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
 *                         auctions:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Auction' }
 */
router.get('/', getAllAuctions);

/**
 * @swagger
 * /auctions:
 *   post:
 *     tags: [🏆 Auctions]
 *     summary: Create a new auction
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [property_id, startingPrice, startDate, endDate]
 *             properties:
 *               property_id:    { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *               startingPrice:  { type: number, example: 500000 }
 *               bidIncrement:   { type: number, example: 10000 }
 *               startDate:      { type: string, format: date-time }
 *               endDate:        { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Auction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:   { type: object, properties: { auction: { $ref: '#/components/schemas/Auction' } } }
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 */
router.post('/', protect, restrictTo('owner','agent','admin'), validate(createAuctionSchema), createAuction);

/**
 * @swagger
 * /auctions/my:
 *   get:
 *     tags: [🏆 Auctions]
 *     summary: Get my auctions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: My auctions list
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/my', protect, getMyAuctions);

/**
 * @swagger
 * /auctions/{id}:
 *   get:
 *     tags: [🏆 Auctions]
 *     summary: Get auction details
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Auction ID
 *     responses:
 *       200:
 *         description: Auction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:   { type: object, properties: { auction: { $ref: '#/components/schemas/Auction' } } }
 *       404: { $ref: '#/components/responses/404' }
 */

/**
 * @swagger
 * /auctions/{id}:
 *   patch:
 *     tags: [🏆 Auctions]
 *     summary: Update auction
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startingPrice: { type: number }
 *               bidIncrement:  { type: number }
 *               startDate:     { type: string, format: date-time }
 *               endDate:       { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Auction updated
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */

/**
 * @swagger
 * /auctions/{id}:
 *   delete:
 *     tags: [🏆 Auctions]
 *     summary: Delete auction
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Auction deleted
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id/close', protect, restrictTo('admin'), closeAuction);

/**
 * @swagger
 * /auctions/{id}/close:
 *   patch:
 *     tags: [🏆 Auctions]
 *     summary: Close auction (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Auction closed successfully
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */

/**
 * @swagger
 * /auctions/{id}/approve:
 *   patch:
 *     tags: [🏆 Auctions]
 *     summary: Approve auction (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Auction approved successfully
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id/approve', protect, restrictTo('admin'), approveAuction);

router.route('/:id')
  .get(getAuction)
  .patch(protect, updateAuction)
  .delete(protect, deleteAuction);

module.exports = router;
