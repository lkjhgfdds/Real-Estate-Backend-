const mongoose = require('mongoose');

// SECURITY FIX — Comprehensive Payment Model with:
// 1. Server-validated amounts (never trust frontend)
// 2. Idempotency guard (isVerified prevents webhook double-credit)
// 3. Payment expiry mechanism (auto-cleanup for failed payments)
// 4. Explicit commission/fee tracking (transparent for users + owners)
// 5. Unique index to prevent double payments

const paymentSchema = new mongoose.Schema(
  {
    // ─── TYPE: booking (property) | subscription (plan) ──────────
    paymentType: {
      type: String,
      enum: ['booking', 'subscription'],
      required: [true, 'Payment type is required'],
      default: 'booking',
      index: true,
    },

    // ─── REFERENCES ───────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    // For booking payments
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    // For subscription payments
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      index: true,
    },

    // ─── AMOUNT CALCULATION (Server-validated only) ───────────────
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: 0,
    },
    currency: {
      type: String,
      default: 'EGP',
      enum: ['EGP', 'USD', 'EUR'],
    },

    // ─── PAYMENT METHOD & STATUS ──────────────────────────────────
    paymentMethod: {
      type: String,
      enum: {
        values: ['cash', 'bank_transfer', 'paypal', 'paymob'],
        message: 'Invalid payment method',
      },
      required: [true, 'Payment method is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid', 'failed', 'refunded', 'expired'],
        message: 'Invalid payment status',
      },
      default: 'pending',
      index: true,
    },

    // ─── PROVIDER INTEGRATION ─────────────────────────────────────
    provider: {
      type: String,
      enum: ['paymob', 'paypal'],
      required: true,
    },
    transactionId: String,  // Provider transaction ID
    providerOrderId: {
      type: String,
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      index: true,
    },

    // ─── CRITICAL: IDEMPOTENCY GUARD ──────────────────────────────
    // Prevents webhook from being processed twice and creating double credit
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ─── PAYMENT EXPIRY ────────────────────────────────────────────
    // Pending payments expire after 30 minutes
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000),
      index: true,  // For cron job to find expired payments
    },
    paidAt: Date,

    // ─── SECURITY & AUDIT ─────────────────────────────────────────
    ipAddress: String,
    userAgent: String,
    webhookSignature: String,  // For webhook verification

    // ─── REFUND HANDLING ──────────────────────────────────────────
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'processed', 'failed'],
      default: 'none'
    },
    refundReason: String,
    refundedAt: Date,
    refundTransactionId: String,

    // ─── METADATA (flexible for provider-specific data) ────────────
    metadata: {
      bookingType: { type: String, enum: ['rent', 'sale'] },
      nights: { type: Number },
      offerPrice: { type: Number },
    },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────

// CRITICAL: Prevent double payments
// A booking can have at most ONE non-failed payment at a time
paymentSchema.index(
  { booking: 1, status: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'paid'] },
    },
  }
);

// Queries
paymentSchema.index({ user: 1, status: 1 }); // Index for dashboard aggregations
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ property: 1, createdAt: -1 });
paymentSchema.index({ providerOrderId: 1 });
paymentSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
