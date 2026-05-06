const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * transaction.model.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Immutable financial ledger recording all money movements within the platform.
 * Supports double-entry style tracking (Debit/Credit).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const transactionSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['payment', 'refund', 'commission', 'payout'],
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: 0,
    },
    credit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'EGP',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },
    metadata: {
      property: { type: Schema.Types.ObjectId, ref: 'Property' },
      owner: { type: Schema.Types.ObjectId, ref: 'User' },
      platformFee: Number,
      reason: String,
      providerResponse: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: No updates allowed
    versionKey: false,
  }
);

// Prevent any accidental updates to existing transactions
transactionSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Financial transactions are immutable and cannot be modified.'));
  }
  next();
});

// Indexes for financial reporting
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
