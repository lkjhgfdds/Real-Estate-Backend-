const mongoose = require('mongoose');

// FIX — Replace the 3 booleans (pending, applied, rejected) with a single clear enum
// Old: pending:true/false + applied:true/false + rejected:true/false
// New: status: 'pending' | 'approved' | 'rejected' | 'cancelled'

const bookingSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      alias: 'userId',
    },
    property_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      alias: 'propertyId',
    },

    // ── Unified Booking Type (rent | sale) ──────────────────────
    bookingType: {
      type: String,
      enum: ['rent', 'sale'],
      required: [true, 'Booking type (rent/sale) is required'],
      index: true,
    },

    // ── Rent: date range ────────────────────────────────────────
    start_date: {
      type: Date,
      alias: 'startDate',
    },
    end_date: {
      type: Date,
      alias: 'endDate',
    },

    // ── Sale: offer price ────────────────────────────────────────
    offerPrice: {
      type: Number,
      min: [0, 'Offer price cannot be negative'],
    },

    // ── Common ──────────────────────────────────────────────────
    amount: {
      type: Number,
      required: true,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    // FIX — One enum instead of 3 confusing booleans
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },

    // ── CANCELLATION DETAILS ────────────────────────────────────
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: String,

    // AUDIT TRAIL & HISTORY
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        reason: String
      }
    ],
    lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastActionAt: Date,
    isPriority: { type: Boolean, default: false },

    // PAYMENT TRACKING
    paymentStatus: {
      type: String,
      enum: ['not_initiated', 'pending', 'paid', 'refunded'],
      default: 'not_initiated',
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

bookingSchema.index({ property_id: 1, start_date: 1, end_date: 1 });
bookingSchema.index({ user_id: 1 });
bookingSchema.index({ user_id: 1, status: 1 }); // Index for dashboard aggregations
bookingSchema.index({ user_id: 1, created_at: -1 });
bookingSchema.index({ property_id: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
