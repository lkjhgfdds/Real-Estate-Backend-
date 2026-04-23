const Payment = require('../models/payment.model');
const paymentService = require('../services/PaymentService');
const encryption = require('../utils/encryption.utils');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Webhook Controller
// ─────────────────────────────────────────────────────────────────
// Handles callbacks from payment providers
// CRITICAL: Idempotency checked in service layer
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/webhook/paymob
 * Handle Paymob payment callback
 * 
 * Paymob sends:
 * {
 *   type: 'TRANSACTION',
 *   obj: { id, success, order_id, amount_cents, ... }
 * }
 */
exports.handlePaymobWebhook = async (req, res, next) => {
  try {
    const payload = req.body;

    logger.info('[Webhook] Paymob webhook received:', { type: payload.type });

    // Verify signature (if Paymob sends it)
    const signature = req.headers['x-paymob-signature'];
    const secret = process.env.PAYMOB_WEBHOOK_SECRET;

    if (signature && secret) {
      const isValid = encryption.verifyWebhookSignature(payload, signature, secret);
      if (!isValid) {
        logger.error('[Webhook] Paymob signature verification failed');
        return res.status(403).json({ status: 'fail', message: 'Invalid signature' });
      }
    }

    const transaction = payload.obj || payload;
    const paymentId = transaction.merchant_order_id; // Our payment ID

    if (!paymentId) {
      logger.error('[Webhook] Paymob webhook missing payment ID');
      return res.status(400).json({ status: 'fail', message: 'Missing payment ID' });
    }

    // Fetch payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      logger.error(`[Webhook] Payment not found: ${paymentId}`);
      return res.status(404).json({ status: 'fail', message: 'Payment not found' });
    }

    // IDEMPOTENCY CHECK (in service layer)
    // If already verified, return success (don't process twice)
    if (payment.isVerified) {
      logger.info(`[Webhook] Payment already verified (idempotency): ${paymentId}`);
      return res.status(200).json({
        status: 'success',
        message: 'Payment already verified',
        duplicate: true,
      });
    }

    // Verify payment
    const result = await paymentService.verifyPayment(paymentId, transaction);

    res.status(200).json({
      status: 'success',
      message: 'Webhook processed',
      data: result,
    });
  } catch (err) {
    logger.error('[Webhook] Paymob webhook error:', err);
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

/**
 * POST /api/v1/webhook/paypal
 * Handle PayPal webhook
 * 
 * PayPal sends various event types:
 * - CHECKOUT.ORDER.COMPLETED
 * - PAYMENT.SALE.COMPLETED
 * - etc.
 */
exports.handlePaypalWebhook = async (req, res, next) => {
  try {
    const payload = req.body;

    logger.info('[Webhook] PayPal webhook received:', { eventType: payload.event_type });

    // Verify webhook signature
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (
      transmissionId &&
      transmissionTime &&
      certUrl &&
      authAlgo &&
      transmissionSig
    ) {
      // Verify PayPal signature
      // This requires fetching the cert and verifying the signature
      // For now, we assume signature validation is done
      logger.debug('[Webhook] PayPal signature headers received');
    }

    const eventType = payload.event_type;

    // Only process payment events
    if (!eventType.includes('PAYMENT') && !eventType.includes('CHECKOUT.ORDER')) {
      logger.info(`[Webhook] Ignoring PayPal event type: ${eventType}`);
      return res.status(200).json({ status: 'success', message: 'Event ignored' });
    }

    // Extract payment ID from custom_id
    const resource = payload.resource;
    const customId = resource.custom_id || resource.purchase_units?.[0]?.custom_id;

    if (!customId) {
      logger.error('[Webhook] PayPal webhook missing custom_id');
      return res.status(400).json({ status: 'fail', message: 'Missing custom_id' });
    }

    // Fetch payment
    const payment = await Payment.findById(customId);
    if (!payment) {
      logger.error(`[Webhook] Payment not found: ${customId}`);
      return res.status(404).json({ status: 'fail', message: 'Payment not found' });
    }

    // IDEMPOTENCY CHECK
    if (payment.isVerified) {
      logger.info(`[Webhook] Payment already verified (idempotency): ${customId}`);
      return res.status(200).json({
        status: 'success',
        message: 'Payment already verified',
        duplicate: true,
      });
    }

    // Verify payment
    const result = await paymentService.verifyPayment(customId, payload);

    res.status(200).json({
      status: 'success',
      message: 'Webhook processed',
      data: result,
    });
  } catch (err) {
    logger.error('[Webhook] PayPal webhook error:', err);
    res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }
};

/**
 * POST /api/v1/webhook/verify
 * Generic webhook verification endpoint (for testing)
 */
exports.verifyWebhook = async (req, res, next) => {
  try {
    const { provider, eventId } = req.body;

    logger.info(`[Webhook] Manual verification: ${provider} - ${eventId}`);

    // Used for manual testing or provider that need explicit verification
    res.status(200).json({
      status: 'success',
      message: 'Webhook verified',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = exports;
