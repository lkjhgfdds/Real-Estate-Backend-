const { body } = require('express-validator');

exports.createReviewSchema = [
  body('propertyId').notEmpty().withMessage('Property ID is required').isMongoId().withMessage('Invalid property ID'),
  body('rating').notEmpty().withMessage('Rating is required').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters'),
];
exports.updateReviewSchema = [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters'),
];
