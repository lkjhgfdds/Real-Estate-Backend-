const { body } = require('express-validator');

const t = (key) => (value, { req }) => req.t(key);

// ─── Create Auction ────────────────────────────────────────────────────────────
exports.createAuctionSchema = [
  body('property')
    .notEmpty().withMessage(t('VALIDATION.PROPERTY_ID_REQUIRED'))
    .isMongoId().withMessage(t('VALIDATION.PROPERTY_ID_INVALID')),

  body('startingPrice')
    .notEmpty().withMessage(t('VALIDATION.STARTING_PRICE_REQUIRED'))
    .isFloat({ min: 1 }).withMessage(t('VALIDATION.STARTING_PRICE_MIN')),

  body('bidIncrement')
    .optional()
    .isFloat({ min: 1 }).withMessage(t('VALIDATION.BID_INCREMENT_MIN')),

  body('startDate')
    .notEmpty().withMessage(t('VALIDATION.START_DATE_REQUIRED'))
    .isISO8601().withMessage(t('VALIDATION.START_DATE_INVALID')),

  body('endDate')
    .notEmpty().withMessage(t('VALIDATION.END_DATE_REQUIRED'))
    .isISO8601().withMessage(t('VALIDATION.END_DATE_INVALID'))
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error(req.t('VALIDATION.END_DATE_AFTER_START'));
      }
      return true;
    }),
];

// ─── Place Bid ─────────────────────────────────────────────────────────────────
exports.placeBidSchema = [
  body('auctionId')
    .notEmpty().withMessage(t('VALIDATION.AUCTION_ID_REQUIRED'))
    .isMongoId().withMessage(t('VALIDATION.AUCTION_ID_INVALID')),

  body('amount')
    .notEmpty().withMessage(t('VALIDATION.BID_AMOUNT_REQUIRED'))
    .isFloat({ min: 1 }).withMessage(t('VALIDATION.BID_AMOUNT_MIN')),
];
