const paymentService = require('../services/PaymentService');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Payment Controller
// ─────────────────────────────────────────────────────────────────
// Handles payment endpoints, validates input, delegates to service
// ─────────────────────────────────────────────────────────────────

exports.checkout = async (req, res, next) => {
  try {
    const { bookingId, provider } = req.body;

    if (!bookingId || !provider) {
      return res.status(400).json({
        status: 'fail',
        message: 'Booking ID and provider (paymob/paypal) are required',
      });
    }

    if (!['paymob', 'paypal'].includes(provider)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid provider. Must be paymob or paypal',
      });
    }

    const Booking = require('../models/booking.model');
    const Property = require('../models/property.model');
    const Payment = require('../models/payment.model');

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ status: 'fail', message: 'Booking not found' });
    }

    if (booking.status !== 'approved') {
      return res.status(400).json({ status: 'fail', message: 'Booking must be approved before payment' });
    }
    
    if (booking.paymentStatus && booking.paymentStatus !== 'not_initiated' && booking.paymentStatus !== 'failed') {
      return res.status(400).json({ status: 'fail', message: 'Payment already initiated or completed for this booking' });
    }

    // Double payment prevention
    const existingPayment = await Payment.findOne({
      booking: booking._id,
      status: 'pending'
    });
    if (existingPayment) {
      return res.status(400).json({ status: 'fail', message: 'There is already a pending payment for this booking' });
    }

    // Amount MUST be calculated server-side
    const property = await Property.findById(booking.property_id);
    let amountToPay = 0;
    
    if (booking.bookingType === 'sale') {
      amountToPay = booking.offerPrice || property.price;
    } else {
      // rent
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const nights = Math.ceil((new Date(booking.end_date) - new Date(booking.start_date)) / MS_PER_DAY);
      amountToPay = (property.price * nights); // Simplified logic
    }
    
    // Add 2.5% platform fee
    const platformFee = Math.round(amountToPay * 0.025 * 100) / 100;
    const finalAmount = amountToPay + platformFee;

    // We generate a local ID first to send to provider if needed
    const tempPaymentId = new require('mongoose').Types.ObjectId();

    // In a real provider logic, we call ProviderAPI here:
    // const providerResult = await providerApi.createOrder({ amount: finalAmount });
    // For now, mocking provider URL:
    const providerOrderId = require('crypto').randomUUID();
    const checkoutUrl = provider === 'paymob' 
      ? `https://paymob.com/iframe/${providerOrderId}` 
      : `https://paypal.com/checkout/${providerOrderId}`;

    // Create Payment (Pending)
    const payment = new Payment({
      _id: tempPaymentId,
      user: req.user._id,
      booking: booking._id,
      property: property._id,
      amount: finalAmount,
      currency: 'EGP',
      provider: provider,
      status: 'pending',
      providerOrderId: providerOrderId,
      idempotencyKey: `idemp_${tempPaymentId}`,
      metadata: {
        bookingType: booking.bookingType,
        offerPrice: booking.offerPrice,
        nights: booking.bookingType === 'rent' ? Math.ceil((new Date(booking.end_date) - new Date(booking.start_date)) / (1000 * 60 * 60 * 24)) : undefined
      }
    });
    await payment.save();
    
    // Update booking status to pending_payment
    booking.paymentStatus = 'pending';
    await booking.save();

    res.status(200).json({
      status: 'success',
      data: {
        checkoutUrl
      }
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
      message: req.t('PAYMENT.REFUNDED'),
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
        message: req.t('PAYMENT.PAYMENT_ID_REQUIRED'),
      });
    }

    const result = await paymentService.verifyPayment(paymentId);

    res.status(200).json({
      status: 'success',
      message: req.t('PAYMENT.VERIFIED'),
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
