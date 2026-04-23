const Bid      = require('../../models/bid.model');
const Auction  = require('../../models/auction.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError     = require('../../utils/AppError');
const { emitNewBid } = require('../../config/socket');
const { createNotification } = require('../../utils/notificationHelper');

// ─── Place Bid ────────────────────────────────────────────────
exports.placeBid = asyncHandler(async (req, res, next) => {
  const { auctionId, amount } = req.body;
  const bidderId = req.user._id;

  if (!auctionId) return next(new AppError('auctionId is required', 400));
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return next(new AppError('Bid amount must be a positive number', 400));
  }

  const auction = await Auction.findById(auctionId);
  if (!auction) return next(new AppError('Auction not found', 404));

  const now = new Date();
  if (auction.status !== 'active' || now < auction.startDate || now > auction.endDate) {
    return next(new AppError('Auction is not active or has ended', 400));
  }

  // FIX — Check that the bidder account is active
  if (!req.user.isActive || req.user.isBanned) {
    return next(new AppError('Your account is suspended and you cannot bid', 403));
  }

  const minimumBid = (auction.currentBid || auction.startingPrice) + auction.bidIncrement;
  if (amount < minimumBid) {
    return next(new AppError(
      `Bid amount must be at least ${minimumBid} (current: ${auction.currentBid}, increment: ${auction.bidIncrement})`,
      400
    ));
  }

  if (auction.seller.toString() === bidderId.toString()) {
    return next(new AppError('You cannot bid on your own auction', 403));
  }

  // Cancel the old winner and create a new one
  await Bid.updateMany({ auction: auctionId, isWinning: true }, { isWinning: false });

  const newBid = await Bid.create({ auction: auctionId, bidder: bidderId, amount, isWinning: true });
  await Auction.findByIdAndUpdate(auctionId, { currentBid: amount });

  const populatedBid = await newBid.populate('bidder', 'name email');

  emitNewBid(auctionId, {
    _id:       populatedBid._id,
    amount:    populatedBid.amount,
    bidder:    populatedBid.bidder,
    isWinning: true,
    createdAt: populatedBid.createdAt,
  });

  // Notify auction owner
  await createNotification(req.io, auction.seller, {
    type:    'auction',
    title:   'New bid in your auction',
    message: `${req.user.name} placed a bid of ${amount}`,
    link:    `/auctions/${auctionId}`,
  }).catch(() => {});

  res.status(201).json({ status: 'success', message: 'Bid placed successfully', data: { bid: populatedBid } });
});

// ─── Get Bids For Auction ─────────────────────────────────────
exports.getBidsForAuction = asyncHandler(async (req, res, next) => {
  const { auctionId } = req.params;
  const auction = await Auction.findById(auctionId);
  if (!auction) return next(new AppError('Auction not found', 404));

  const bids = await Bid.find({ auction: auctionId })
    .populate('bidder', 'name email')
    .sort({ amount: -1, createdAt: -1 });

  res.status(200).json({ status: 'success', count: bids.length, data: { bids } });
});

// ─── Get My Bids ──────────────────────────────────────────────
exports.getMyBids = asyncHandler(async (req, res) => {
  const bids = await Bid.find({ bidder: req.user._id })
    .populate({
      path:     'auction',
      select:   'startingPrice currentBid startDate endDate status',
      populate: { path: 'property', select: 'title location images price' },
    })
    .sort({ createdAt: -1 });

  res.status(200).json({ status: 'success', count: bids.length, data: { bids } });
});
