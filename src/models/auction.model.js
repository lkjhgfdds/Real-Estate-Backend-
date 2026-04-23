const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property is required'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Seller is required'],
    },
    startingPrice: {
      type: Number,
      required: [true, 'Starting price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currentBid: {
      type: Number,
      default: null,
    },
    bidIncrement: {
      type: Number,
      default: 100,
      min: [1, 'Minimum bid increment must be at least 1'],
    },
    startDate: {
      type: Date,
      required: [true, 'Auction start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'Auction end date is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['upcoming', 'active', 'closed', 'cancelled'],
        message: 'Status must be: upcoming, active, closed, or cancelled',
      },
      default: 'upcoming',
    },
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// FIX #1 — Modern async/await approach (no risk of forgetting next())
auctionSchema.pre('save', async function () {
  if (this.isNew && this.currentBid === null) {
    this.currentBid = this.startingPrice;
  }
  // ✅ No risk of forgetting next()
});

auctionSchema.virtual('isLive').get(function () {
  const now = new Date();
  return this.status === 'active' && now >= this.startDate && now <= this.endDate;
});

auctionSchema.virtual('remainingSeconds').get(function () {
  if (this.status !== 'active') return 0;
  const diff = new Date(this.endDate) - new Date();
  return diff > 0 ? Math.floor(diff / 1000) : 0;
});

auctionSchema.index({ property: 1 });
auctionSchema.index({ seller: 1 });
auctionSchema.index({ status: 1 });
auctionSchema.index({ endDate: 1 });
auctionSchema.index({ isApproved: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
