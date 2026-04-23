const { body } = require('express-validator');

exports.createPaymentSchema = [
  body('bookingId')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID'),
  // FIX — Standardize values with model: remove 'online', add 'debit_card' and 'paypal'
  body('method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'credit_card', 'debit_card', 'bank_transfer', 'paypal'])
    .withMessage('Payment method is not supported'),
];

exports.updatePaymentStatusSchema = [
  body('status')
    .notEmpty().withMessage('Payment status is required')
    // FIX — 'paid' instead of 'completed'
    .isIn(['pending', 'paid', 'failed', 'refunded'])
    .withMessage('Invalid payment status'),
];
