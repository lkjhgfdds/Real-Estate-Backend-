const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const Property = require('../models/property.model');
const User = require('../models/user.model');
const ProviderFactory = require('./providers/factory');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const AuditLog = require('../models/auditLog.model');
const Transaction = require('../models/transaction.model');

// ─────────────────────────────────────────────────────────────────
// Payment Service Layer
// ─────────────────────────────────────────────────────────────────
// Orchestrates payment flow: validation → creation → verification
// 3-layer architecture: Controller → Service → Provider
// ─────────────────────────────────────────────────────────────────

class PaymentService {
  /**
   * PHASE 1: Initiate Payment
   * Called after booking is APPROVED by owner/admin
   * 
   * Security checks:
   * 1. Amount validated on SERVER (never trust frontend)
   * 2. Property price verified
   * 3. Double-payment check (booking can't have 2 payments)
   * 4. KYC verified (already protected by middleware)
   */
  async initiatePayment(bookingId, paymentMethod, userId, ipAddress, userAgent) {
    try {
      logger.info(`[Payment] Initiating payment for booking ${bookingId}, method: ${paymentMethod}`);

      // 1. Fetch booking and related data
      const booking = await Booking.findById(bookingId).populate('property_id');
      if (!booking) {
        throw new Error('Booking not found');
      }

      const property = booking.property_id;
      if (!property) {
        throw new Error('Property not found');
      }

      // 2. CRITICAL: Calculate amount on SERVER (never trust frontend)
      const propertyPrice = property.price;
      if (!propertyPrice || propertyPrice <= 0) {
        throw new Error('Invalid property price');
      }

      // Platform fee: 2.5% of property price
      const platformFee = Math.round(propertyPrice * 0.025 * 100) / 100;
      const totalAmount = propertyPrice + platformFee;
      const netAmount = propertyPrice; // Owner receives only property price (no fee)

      logger.info(`[Payment] Amount breakdown - Price: ${propertyPrice}, Fee: ${platformFee}, Total: ${totalAmount}`);

      // 3. CRITICAL: Double-payment prevention
      // Check if booking already has a non-failed payment
      const existingPayment = await Payment.findOne({
        booking: bookingId,
        status: { $nin: ['failed', 'expired'] },
      });

      if (existingPayment) {
        throw new Error(
          `Payment already initiated for this booking. Status: ${existingPayment.status}. ` +
          `Cannot create another payment until this one is resolved.`
        );
      }

      // 4. Create payment record (status: pending)
      const payment = new Payment({
        user: userId,
        property: property._id,
        booking: bookingId,
        propertyPrice,
        platformFee,
        netAmount,
        totalAmount,
        paymentMethod,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        ipAddress,
        userAgent,
      });

      await payment.save();

      logger.info(`[Payment] Payment record created: ${payment._id}, status: PENDING`);

      // 5. Route to provider
      const provider = ProviderFactory.getProvider(paymentMethod);
      let providerResult;

      try {
        providerResult = await provider.createPayment({
          amount: totalAmount,
          paymentId: payment._id.toString(),
          userId: userId,
          propertyId: property._id.toString(),
          bookingId: bookingId,
          propertyName: property.name || 'Property',
          currency: payment.currency,
        });
      } catch (providerErr) {
        // Provider creation failed, mark payment as failed
        payment.status = 'failed';
        await payment.save();
        logger.error(`[Payment] Provider error for ${paymentMethod}:`, providerErr);
        throw new Error(`Payment provider error: ${providerErr.message}`);
      }

      // 6. Update payment with provider response
      payment.paymentKey = providerResult.paymentKey || null;
      payment.provider = paymentMethod;
      payment.metadata = providerResult.metadata || {};
      await payment.save();

      logger.info(`[Payment] Provider integration complete, paymentKey: ${payment.paymentKey}`);

      return {
        paymentId: payment._id,
        status: 'pending',
        propertyPrice,
        platformFee,
        totalAmount,
        netAmount,
        paymentMethod,
        expiresAt: payment.expiresAt,
        // Return provider-specific data
        paymentUrl: providerResult.paymentUrl || providerResult.iframeKey || null,
        paymentKey: providerResult.paymentKey || null,
      };
    } catch (err) {
      logger.error('[Payment] initiatePayment error:', err);
      throw err;
    }
  }

  /**
   * PHASE 2: Verify Payment
   * Called either by:
   * A) Webhook from provider (Paymob, PayPal)
   * B) Polling query to provider API
   * 
   * CRITICAL: Idempotency guard prevents webhook from processing twice
   * CRITICAL: Handles both booking AND subscription payment types
   */
  async verifyPayment(paymentId, webhookData = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`[Payment] Verifying payment: ${paymentId}`);

      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) {
        throw new AppError(`Payment ${paymentId} not found`, 404);
      }

      // CRITICAL: Idempotency guard
      if (payment.isVerified) {
        logger.warn(`[Payment] Payment already verified (idempotency check): ${paymentId}`);
        await session.abortTransaction();
        return { status: 'already_verified', payment };
      }

      // Check expiry
      if (payment.expiresAt < new Date()) {
        payment.status = 'expired';
        await payment.save({ session });
        await session.commitTransaction();
        logger.warn(`[Payment] Payment expired: ${paymentId}`);
        throw new Error('Payment expired');
      }

      // Get provider
      const provider = ProviderFactory.getProvider(payment.paymentMethod);

      // Verify with provider
      let verified;
      if (webhookData) {
        verified = await provider.handleWebhook(webhookData, payment);
      } else {
        verified = await provider.verifyPayment(payment.paymentKey);
      }

      if (!verified.success) {
        payment.status = 'failed';
        await payment.save({ session });
        await session.commitTransaction();
        logger.error(`[Payment] Verification failed for payment: ${paymentId}`);
        throw new Error('Payment verification failed');
      }

      // ──────────────────────────────────────────────────────────────
      // SUCCESS: Update payment atomically
      // ──────────────────────────────────────────────────────────────
      payment.isVerified    = true; // ← IDEMPOTENCY FLAG
      payment.status        = 'paid';
      payment.transactionId = verified.transactionId;
      payment.verifiedAt    = new Date();
      payment.metadata      = { ...payment.metadata, ...verified.metadata };
      await payment.save({ session });

      logger.info(`[Payment] Payment verified and marked PAID: ${paymentId} (type: ${payment.paymentType})`);

      let result = { success: true, payment };

      // ── Route to correct post-payment handler based on type ────────
      if (payment.paymentType === 'subscription') {
        result = await this.activateSubscriptionFromPayment(payment, session);
      } else {
        // Booking payment — update booking + property status atomically
        const booking = await Booking.findByIdAndUpdate(
          payment.booking,
          { 
            status: 'completed', 
            paymentStatus: 'paid', 
            paidAmount: payment.totalAmount 
          },
          { session, new: true }
        );

        if (booking) {
          await Property.findByIdAndUpdate(
            payment.property,
            { 
              status: booking.bookingType === 'sale' ? 'sold' : 'reserved',
              $inc: { successfulBookings: 1 } 
            },
            { session }
          );
          logger.info(`[Payment] Booking ${booking._id} marked as COMPLETED, Property set to ${booking.bookingType === 'sale' ? 'sold' : 'reserved'}`);
        }

        // ── Ledger Logging: Payment ──
        await Transaction.create([{
          type: 'payment',
          payment: payment._id,
          booking: payment.booking,
          user: payment.user,
          credit: payment.totalAmount,
          metadata: {
            property: payment.property,
            platformFee: payment.platformFee
          }
        }], { session });

        // ── Ledger Logging: Commission ──
        await Transaction.create([{
          type: 'commission',
          payment: payment._id,
          booking: payment.booking,
          user: payment.user,
          credit: payment.platformFee,
          metadata: {
            property: payment.property
          }
        }], { session });

        result = { success: true, payment, booking };
      }

      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      logger.error('[Payment] verifyPayment error:', err);
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Activate subscription after successful payment webhook
   * SOURCE OF TRUTH — only called by verifyPayment after webhook verification
   */
  async activateSubscriptionFromPayment(payment, session) {
    const Subscription = require('../models/subscription.model');

    const subscription = await Subscription.findById(payment.subscription).session(session);
    if (!subscription) {
      throw new AppError(`Subscription ${payment.subscription} not found`, 404);
    }

    // Activate subscription
    subscription.status          = 'active';
    subscription.paymentVerified = true;   // ← HARD GATE CLEARED
    subscription.transactionId   = payment.transactionId;
    await subscription.save({ session });

    // Update user record
    await User.findByIdAndUpdate(
      payment.user,
      { activeSubscription: subscription._id, subscriptionStatus: 'active' },
      { session }
    );

    // ── Ledger Logging: Subscription ──
    await Transaction.create([{
      type: 'payment',
      payment: payment._id,
      user: payment.user,
      credit: payment.totalAmount,
      metadata: {
        subscription: subscription._id,
        plan: subscription.plan
      }
    }], { session });

    logger.info(`[Payment] Subscription ${subscription._id} ACTIVATED for user ${payment.user} — plan: ${subscription.plan}`);

    return { success: true, payment, subscription };
  }



  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId, userId = null) {
    try {
      const query = { _id: paymentId };
      if (userId) {
        query.user = userId; // User can only see their own payments
      }

      const payment = await Payment.findOne(query)
        .populate('user', 'name email')
        .populate('property', 'name price')
        .populate('booking', '_id amount');

      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      return {
        paymentId: payment._id,
        status: payment.status,
        totalAmount: payment.totalAmount,
        netAmount: payment.netAmount,
        platformFee: payment.platformFee,
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        expiresAt: payment.expiresAt,
        verifiedAt: payment.verifiedAt,
        createdAt: payment.createdAt,
        property: payment.property,
        booking: payment.booking,
      };
    } catch (err) {
      logger.error('[Payment] getPaymentStatus error:', err);
      throw err;
    }
  }

  /**
   * List user payments (transaction history)
   */
  async listPayments(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const payments = await Payment.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('property', 'name price')
        .populate('booking', '_id');

      const total = await Payment.countDocuments({ user: userId });

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (err) {
      logger.error('[Payment] listPayments error:', err);
      throw err;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, reason = '', adminId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`[Payment] Refund request: ${paymentId}, reason: ${reason}`);

      const payment = await Payment.findById(paymentId).session(session);
      if (!payment) {
        throw new AppError('Payment not found', 404);
      }

      if (payment.status !== 'paid') {
        throw new Error('Can only refund paid payments');
      }

      // Prevent double refunds
      if (payment.status === 'refunded' || payment.refundStatus === 'processed') {
        throw new Error('Payment has already been refunded');
      }

      // Load associated booking
      const booking = await Booking.findById(payment.booking).session(session);
      if (!booking) {
        throw new Error('Associated booking not found');
      }

      // Get provider
      const provider = ProviderFactory.getProvider(payment.paymentMethod);

      // Call provider refund
      let providerResponse = { status: 'processed' }; // Default
      if (provider.refund) {
        providerResponse = await provider.refund(payment.transactionId);
        payment.refundTransactionId = providerResponse.transactionId;
      }

      // ── Hardening: Refund Status Reconciliation ──
      // If provider returns 'pending', we don't mark as processed yet
      const finalRefundStatus = providerResponse.status === 'pending' ? 'pending' : 'processed';

      // Mark as refunded
      payment.status = 'refunded';
      payment.refundStatus = finalRefundStatus;
      payment.refundReason = reason;
      payment.refundedAt = new Date();
      await payment.save({ session });

      // Update booking to cancelled
      booking.status = 'cancelled';
      booking.paymentStatus = 'refunded';
      booking.cancelledAt = new Date();
      booking.cancelledBy = adminId;
      booking.cancelReason = `Admin Refund: ${reason}`;
      
      booking.statusHistory.push({
        status: 'cancelled',
        changedBy: adminId,
        changedAt: new Date(),
        reason: `Admin Refund: ${reason}`,
      });
      booking.lastActionBy = adminId;
      booking.lastActionAt = new Date();

      await booking.save({ session });

      // ── Hardening: Property Status Race Condition Patch ──
      if (booking.property_id) {
        const otherActiveBooking = await Booking.findOne({
          _id: { $ne: booking._id },
          property_id: booking.property_id,
          status: { $in: ['pending', 'approved', 'completed'] }
        }).session(session);

        if (!otherActiveBooking) {
          await Property.findByIdAndUpdate(booking.property_id, {
            status: 'available',
          }, { session });
          logger.info(`[Payment] Property ${booking.property_id} reverted to AVAILABLE`);
        } else {
          logger.info(`[Payment] Property ${booking.property_id} NOT reverted (active booking ${otherActiveBooking._id} exists)`);
        }
      }

      // ── Ledger Logging: Refund ──
      await Transaction.create([{
        type: 'refund',
        payment: payment._id,
        booking: payment.booking,
        user: payment.user,
        debit: payment.totalAmount,
        status: finalRefundStatus === 'processed' ? 'completed' : 'pending',
        metadata: {
          reason,
          property: booking.property_id,
          providerResponse
        }
      }], { session });

      // Audit Log
      await AuditLog.create([{
        actor: adminId,
        action: 'REFUND_PAYMENT',
        targetType: 'Payment',
        targetId: payment._id,
        changes: {
          before: { status: 'paid', refundStatus: 'none' },
          after: { status: 'refunded', refundStatus: finalRefundStatus }
        },
        metadata: { reason, bookingId: booking._id }
      }], { session });

      await session.commitTransaction();
      logger.info(`[Payment] Refund completed: ${paymentId}, amount: ${payment.totalAmount}`);

      return payment;
    } catch (err) {
      await session.abortTransaction();
      logger.error('[Payment] refundPayment error:', err);
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new PaymentService();
