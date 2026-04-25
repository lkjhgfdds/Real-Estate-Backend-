const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    // ─── Associated auction ───────────────────────────────────────
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Auction',
      required: [true, 'Auction is required'],
    },

    // ─── Bidder ──────────────────────────────────────────────
    bidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Bidder is required'],
    },

    // ─── Bid amount ─────────────────────────────────────────
    amount: {
      type: Number,
      required: [true, 'Bid amount is required'],
      min: [0, 'Bid amount cannot be negative'],
    },

    // ─── Is this bid currently winning? ────────────────────
    isWinning: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────
bidSchema.index({ auction: 1, amount: -1 });   // Required index — descending sort
bidSchema.index({ auction: 1, isWinning: 1 }); // Fetch winning bid quickly
bidSchema.index({ bidder: 1 });                // Fetch bids for specific user
bidSchema.index({ auction: 1, createdAt: -1 });

module.exports = mongoose.model('Bid', bidSchema);
