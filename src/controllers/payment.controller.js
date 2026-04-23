const paymentService = require('../services/PaymentService');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Payment Controller
// ─────────────────────────────────────────────────────────────────
// Handles payment endpoints, validates input, delegates to service
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/payments/checkout
 * Initiate payment after booking is approved
 * 
 * Body:
 * {
 *   bookingId: ObjectId,
 *   paymentMethod: 'paymob' | 'paypal' | 'bank_transfer' | 'cash'
 * }
 */
exports.initiatePayment = async (req, res, next) => {
  try {
    const { bookingId, paymentMethod } = req.body;

    // Validate input
    if (!bookingId) {
      return res.status(400).json({
        status: 'fail',
        message: 'bookingId is required',
      });
    }

    const validMethods = ['cash', 'bank_transfer', 'paypal', 'paymob'];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`,
      });
    }

    // Call service
    const result = await paymentService.initiatePayment(
      bookingId,
      paymentMethod,
      req.user._id,
      req.ip,
      req.headers['user-agent']
    );

    res.status(200).json({
      status: 'success',
      message: 'Payment initiated',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/payments/:id
 * Get payment status
 */
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentStatus(req.params.id, req.user._id);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/payments
 * List user payment history
 */
exports.listPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await paymentService.listPayments(req.user._id, page, limit);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/payments/:id/refund
 * Refund payment (admin only)
 */
exports.refundPayment = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const result = await paymentService.refundPayment(req.params.id, reason, req.user._id);

    res.status(200).json({
      status: 'success',
      message: 'Payment refunded',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/payments/verify
 * Verify payment via provider (polling)
 */
exports.verifyPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({
        status: 'fail',
        message: 'paymentId is required',
      });
    }

    const result = await paymentService.verifyPayment(paymentId);

    res.status(200).json({
      status: 'success',
      message: 'Payment verified',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
