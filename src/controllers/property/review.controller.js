const Review   = require('../../models/review.model');
const Property = require('../../models/property.model');
const Booking  = require('../../models/booking.model');
const { clearCache } = require('../../middlewares/cache.middleware');
const { createNotification } = require('../../utils/notificationHelper');

// ─── Create Review ────────────────────────────────────────────
exports.createReview = async (req, res, next) => {
  try {
    const { propertyId, rating, comment } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ status: 'fail', message: 'Property not found' });
    }
    if (property.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ status: 'fail', message: 'You cannot rate your own property' });
    }

    // FIX — Verify user has actually completed their stay (completed, not approved)
    // approved = payment only, completed = stayed and stay period ended
    const booking = await Booking.findOne({
      user_id:     req.user._id,
      property_id: propertyId,
      status:      'completed',
    });
    if (!booking) {
      return res.status(403).json({
        status:  'fail',
        message: 'You must complete a booking for this property before you can rate it',
      });
    }

    const review = await Review.create({ propertyId, userId: req.user._id, rating, comment });
    await review.populate('userId', 'name photo');

    clearCache(`/api/v1/properties/${propertyId}`);

    // Notify property owner
    await createNotification(req.io, property.owner, {
      type:    'review',
      title:   'New rating on your property',
      message: `${req.user.name} rated your property "${property.title}" with ${rating} stars`,
      link:    `/properties/${propertyId}`,
    }).catch(() => {});

    res.status(201).json({ status: 'success', data: { review } });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ status: 'fail', message: 'You have already rated this property' });
    }
    next(err);
  }
};

// ─── Get Property Reviews ─────────────────────────────────────
exports.getPropertyReviews = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const total   = await Review.countDocuments({ propertyId: req.params.propertyId });
    const reviews = await Review.find({ propertyId: req.params.propertyId })
      .populate('userId', 'name photo')
      .skip(skip).limit(limit).sort('-createdAt');

    res.status(200).json({ status: 'success', results: reviews.length, total, page, pages: Math.ceil(total / limit), data: { reviews } });
  } catch (err) {
    next(err);
  }
};

// ─── Update Review ────────────────────────────────────────────
exports.updateReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ status: 'fail', message: 'Review not found' });
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }

    const { rating, comment } = req.body;
    review.rating  = rating  ?? review.rating;
    review.comment = comment ?? review.comment;
    await review.save();

    clearCache(`/api/v1/properties/${review.propertyId}`);
    res.status(200).json({ status: 'success', data: { review } });
  } catch (err) {
    next(err);
  }
};

// ─── Delete Review ────────────────────────────────────────────
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ status: 'fail', message: 'Review not found' });
    if (review.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }

    await review.deleteOne();
    clearCache(`/api/v1/properties/${review.propertyId}`);
    res.status(204).json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};
