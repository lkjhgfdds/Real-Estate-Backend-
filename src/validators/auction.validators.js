const { body } = require('express-validator');

// ─── Create Auction ────────────────────────────────────────────────────────────
exports.createAuctionSchema = [
  body('property')
    .notEmpty().withMessage('Property is required')
    .isMongoId().withMessage('Invalid property ID'),

  body('startingPrice')
    .notEmpty().withMessage('Starting price is required')
    .isFloat({ min: 1 }).withMessage('Starting price must be greater than 0'),

  body('bidIncrement')
    .optional()
    .isFloat({ min: 1 }).withMessage('Minimum bid increment must be greater than 0'),

  body('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date'),

  body('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
];

// ─── Place Bid ─────────────────────────────────────────────────────────────────
exports.placeBidSchema = [
  body('auctionId')
    .notEmpty().withMessage('Auction ID is required')
    .isMongoId().withMessage('Invalid auction ID'),

  body('amount')
    .notEmpty().withMessage('Bid amount is required')
    .isFloat({ min: 1 }).withMessage('Bid amount must be greater than 0'),
];
