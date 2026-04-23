const express = require('express');
const router  = express.Router();
const viewingController = require('../controllers/viewingRequest/viewingRequest.controller');
const { protect }       = require('../middlewares/auth.middleware');
const validate          = require('../middlewares/validation.middleware');
const { createViewingRequestSchema, updateViewingStatusSchema } = require('../validators/validators');

router.use(protect);

/**
 * @swagger
 * /viewing-requests:
 *   post:
 *     tags: [👁️ ViewingRequests]
 *     summary: Request a property viewing appointment
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [property_id, requestedDate]
 *             properties:
 *               property_id:   { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *               requestedDate: { type: string, format: date-time, example: '2025-06-15T10:00:00Z' }
 *               notes:         { type: string, example: 'Prefer morning visits' }
 *     responses:
 *       201:
 *         description: Viewing request created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     viewingRequest:
 *                       type: object
 *                       properties:
 *                         _id:           { type: string }
 *                         property_id:   { type: string }
 *                         requester_id:  { type: string }
 *                         requestedDate: { type: string, format: date-time }
 *                         status:        { type: string, enum: [pending, approved, rejected, cancelled] }
 *                         notes:         { type: string }
 *       401: { $ref: '#/components/responses/401' }
 */
router.post('/', validate(createViewingRequestSchema), viewingController.createViewingRequest);

/**
 * @swagger
 * /viewing-requests/my:
 *   get:
 *     tags: [👁️ ViewingRequests]
 *     summary: Get my viewing requests (as buyer)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, cancelled] }
 *     responses:
 *       200:
 *         description: My viewing requests
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/my', viewingController.getMyViewingRequests);

/**
 * @swagger
 * /viewing-requests/owner:
 *   get:
 *     tags: [👁️ ViewingRequests]
 *     summary: Get viewing requests for my properties (as owner/agent)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, cancelled] }
 *     responses:
 *       200:
 *         description: Viewing requests on my properties
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/owner', viewingController.getOwnerViewingRequests);

/**
 * @swagger
 * /viewing-requests/{id}/status:
 *   patch:
 *     tags: [👁️ ViewingRequests]
 *     summary: Update viewing request status (approve or reject)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [approved, rejected] }
 *     responses:
 *       200:
 *         description: Status updated
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id/status', validate(updateViewingStatusSchema), viewingController.updateStatus);

/**
 * @swagger
 * /viewing-requests/{id}/cancel:
 *   patch:
 *     tags: [👁️ ViewingRequests]
 *     summary: Cancel a viewing request
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Viewing request cancelled
 *       401: { $ref: '#/components/responses/401' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id/cancel', viewingController.cancelViewingRequest);

module.exports = router;
