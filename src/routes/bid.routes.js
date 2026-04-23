const express  = require('express');
const router   = express.Router();
const { placeBid, getBidsForAuction, getMyBids } = require('../controllers/bid/bid.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate    = require('../middlewares/validation.middleware');
const { placeBidSchema } = require('../validators/auction.validators');
const { bidLimiter } = require('../middlewares/advancedRateLimit.middleware');

/**
 * @swagger
 * /bids:
 *   post:
 *     tags: [💰 Bids]
 *     summary: Place a bid on an auction
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [auctionId, amount]
 *             properties:
 *               auctionId: { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *               amount:    { type: number, example: 550000 }
 *     responses:
 *       201:
 *         description: Bid placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     bid:
 *                       type: object
 *                       properties:
 *                         _id:       { type: string }
 *                         auctionId: { type: string }
 *                         userId:    { type: string }
 *                         amount:    { type: number }
 *                         createdAt: { type: string, format: date-time }
 *       400:
 *         description: Bid too low or auction not active
 *       401: { $ref: '#/components/responses/401' }
 *       429: { $ref: '#/components/responses/429' }
 */
router.post('/', protect, bidLimiter, validate(placeBidSchema), placeBid);

/**
 * @swagger
 * /bids/my:
 *   get:
 *     tags: [💰 Bids]
 *     summary: Get my bids history
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
 *         description: My bids list
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/my', protect, getMyBids);

/**
 * @swagger
 * /bids/auction/{auctionId}:
 *   get:
 *     tags: [💰 Bids]
 *     summary: Get all bids for a specific auction
 *     security: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: { type: string }
 *         description: Auction ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Bids for the auction
 *       404: { $ref: '#/components/responses/404' }
 */
router.get('/auction/:auctionId', getBidsForAuction);

module.exports = router;
