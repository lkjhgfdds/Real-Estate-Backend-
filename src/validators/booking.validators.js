const { body } = require('express-validator');

exports.createBookingSchema = [
  body('propertyId').notEmpty().withMessage('Property ID is required')
    .isMongoId().withMessage('Invalid property ID'),
  body('start_date').notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date')
    .custom((val) => {
      if (new Date(val) < new Date()) throw new Error('Start date cannot be in the past');
      return true;
    }),
  body('end_date').notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date')
    .custom((end, { req }) => {
      if (new Date(end) <= new Date(req.body.start_date)) throw new Error('End date must be after start date');
      return true;
    }),
  body('amount').notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount cannot be negative'),
];
