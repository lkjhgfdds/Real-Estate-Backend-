const { body } = require('express-validator');
exports.sendInquirySchema = [
  body('propertyId').notEmpty().withMessage('Property ID is required').isMongoId().withMessage('Invalid property ID'),
  body('message').notEmpty().withMessage('Message is required').isLength({ min: 5, max: 1000 }).withMessage('Message must be between 5 and 1000 characters'),
];
