const Bid      = require('../../models/bid.model');
const Auction  = require('../../models/auction.model');
const mongoose = require('mongoose');
const asyncHandler = require('../../utils/asyncHandler');
const AppError     = require('../../utils/AppError');
const { emitNewBid } = require('../../config/socket');
const { createNotification } = require('../../utils/notificationHelper');
const { cursorPaginate } = require('../../utils/cursorPaginate');

// ─── Place Bid ────────────────────────────────────────────────
exports.placeBid = asyncHandler(async (req, res, next) => {
  const { auctionId, amount } = req.body;
  const bidderId = req.user._id;

  if (!auctionId) return next(new AppError(req.t('BID.AUCTION_ID_REQUIRED'), 400));
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return next(new AppError(req.t('BID.AMOUNT_POSITIVE'), 400));
  }

  const session = await mongoose.startSession();
  let populatedBid;
  let auction;
  let retries = 5;

  try {
    while (retries >= 0) {
      try {
        session.startTransaction();

        // Acquire an early write-lock on the auction to prevent late TransientTransactionErrors
        auction = await Auction.findOneAndUpdate(
          { _id: auctionId },
          { $set: { updatedAt: new Date() } },
          { session, new: true }
        );
        if (!auction) throw new AppError(req.t('AUCTION.NOT_FOUND'), 404);

        const now = new Date();
        if (auction.status !== 'active' || now < auction.startDate || now > auction.endDate) {
          throw new AppError(req.t('BID.AUCTION_NOT_ACTIVE'), 400);
        }

        if (!req.user.isActive || req.user.isBanned) {
          throw new AppError(req.t('BID.ACCOUNT_SUSPENDED'), 403);
        }

        const minimumBid = (auction.currentBid || auction.startingPrice) + auction.bidIncrement;
        if (amount < minimumBid) {
          throw new AppError(
            req.t('BID.MINIMUM_BID', { minimum: minimumBid, current: auction.currentBid, increment: auction.bidIncrement }),
            400
          );
        }

        if (auction.seller.toString() === bidderId.toString()) {
          throw new AppError(req.t('BID.OWN_AUCTION'), 403);
        }

        await Bid.updateMany(
          { auction: auctionId, isWinning: true },
          { isWinning: false },
          { session }
        );

        const [newBid] = await Bid.create(
          [{ auction: auctionId, bidder: bidderId, amount, isWinning: true }],
          { session }
        );

        await Auction.findByIdAndUpdate(
          auctionId,
          { currentBid: amount },
          { session, new: true }
        );

        await session.commitTransaction();
        populatedBid = await newBid.populate('bidder', 'name email');
        break; // Success, exit retry loop
      } catch (err) {
        await session.abortTransaction();
        if (err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError') && retries > 0) {
          retries--;
          // Jitter: wait 10-100ms before retrying to prevent livelock
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 90) + 10));
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    throw err;
  } finally {
    await session.endSession();
  }

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
    title:   req.t('NOTIFICATION.NEW_BID'),
    message: req.t('NOTIFICATION.NEW_BID_MSG', { name: req.user.name, amount }),
    link:    `/auctions/${auctionId}`,
  }).catch(() => {});

  res.status(201).json({ status: 'success', message: req.t('BID.PLACED'), data: { bid: populatedBid } });
});

// ─── Get Bids For Auction ─────────────────────────────────────
exports.getBidsForAuction = asyncHandler(async (req, res, next) => {
  const { auctionId } = req.params;
  const auction = await Auction.findById(auctionId);
  if (!auction) return next(new AppError(req.t('AUCTION.NOT_FOUND'), 404));

  const { data: bids, nextCursor, hasMore, count } = await cursorPaginate(Bid, {
    filter: { auction: auctionId },
    populate: { path: 'bidder', select: 'name email' },
    sort: 'desc',
    limit: parseInt(req.query.limit) || 20,
    afterCursor: req.query.cursor
  });

  res.status(200).json({ status: 'success', count, nextCursor, hasMore, data: { bids } });
});

// ─── Get My Bids ──────────────────────────────────────────────
exports.getMyBids = asyncHandler(async (req, res) => {
  const { data: bids, nextCursor, hasMore, count } = await cursorPaginate(Bid, {
    filter: { bidder: req.user._id },
    populate: {
      path:     'auction',
      select:   'startingPrice currentBid startDate endDate status',
      populate: { path: 'property', select: 'title location images price' },
    },
    sort: 'desc',
    limit: parseInt(req.query.limit) || 20,
    afterCursor: req.query.cursor
  });

  res.status(200).json({ status: 'success', count, nextCursor, hasMore, data: { bids } });
});
