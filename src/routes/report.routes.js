const express = require('express');
const router  = express.Router();
const reportController = require('../controllers/admin/report.controller');
const { protect }  = require('../middlewares/auth.middleware');
const restrictTo   = require('../middlewares/restrictTo.middleware');
const { body }     = require('express-validator');
const validate     = require('../middlewares/validation.middleware');

const t = (key) => (value, { req }) => req.t(key);

const reportSchema = [
  body('targetType').isIn(['property','user','review','inquiry']).withMessage(t('VALIDATION.REPORT_TARGET_TYPE_INVALID')),
  body('targetId').isMongoId().withMessage(t('VALIDATION.REPORT_TARGET_ID_INVALID')),
  body('reason').isIn(['spam','fraud','inappropriate','wrong_info','duplicate','other']).withMessage(t('VALIDATION.REPORT_REASON_INVALID')),
  body('description').optional().isLength({ max: 1000 }),
];

router.use(protect);

/**
 * @swagger
 * /reports:
 *   post:
 *     tags: [🚨 Reports]
 *     summary: Submit a report against content or a user
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId, reason]
 *             properties:
 *               targetType:  { type: string, enum: [property, user, review, inquiry] }
 *               targetId:    { type: string, example: 64f1a2b3c4d5e6f7a8b9c0d1 }
 *               reason:      { type: string, enum: [spam, fraud, inappropriate, wrong_info, duplicate, other] }
 *               description: { type: string, maxLength: 1000, example: 'This listing has false information.' }
 *     responses:
 *       201:
 *         description: Report submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string, example: success }
 *                 message: { type: string, example: Report submitted successfully }
 *       401: { $ref: '#/components/responses/401' }
 */
router.post('/', validate(reportSchema), reportController.submitReport);

/**
 * @swagger
 * /reports/my:
 *   get:
 *     tags: [🚨 Reports]
 *     summary: Get reports I have submitted
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
 *         description: My submitted reports
 *       401: { $ref: '#/components/responses/401' }
 */
router.get('/my', reportController.getMyReports);

/**
 * @swagger
 * /reports:
 *   get:
 *     tags: [🚨 Reports]
 *     summary: Get all reports (admin only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, reviewed, dismissed] }
 *       - in: query
 *         name: targetType
 *         schema: { type: string, enum: [property, user, review, inquiry] }
 *     responses:
 *       200:
 *         description: All reports list
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 */
router.get('/', restrictTo('admin'), reportController.getAllReports);

/**
 * @swagger
 * /reports/{id}/review:
 *   patch:
 *     tags: [🚨 Reports]
 *     summary: Review and resolve a report (admin only)
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
 *               status:     { type: string, enum: [reviewed, dismissed] }
 *               adminNotes: { type: string, example: 'Action taken - listing removed' }
 *     responses:
 *       200:
 *         description: Report reviewed
 *       401: { $ref: '#/components/responses/401' }
 *       403: { $ref: '#/components/responses/403' }
 *       404: { $ref: '#/components/responses/404' }
 */
router.patch('/:id/review', restrictTo('admin'), reportController.reviewReport);

module.exports = router;
