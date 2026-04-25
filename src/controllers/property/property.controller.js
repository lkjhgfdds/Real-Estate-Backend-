const cloudinary = require('../../config/cloudinary');
const Property   = require('../../models/property.model');
const Review     = require('../../models/review.model');
const Favorite   = require('../../models/favorite.model');
const Booking    = require('../../models/booking.model');
const Inquiry    = require('../../models/inquiry.model');
const ViewingRequest = require('../../models/viewingRequest.model');
const APIFeatures    = require('../../utils/apiFeatures');
const asyncHandler   = require('../../utils/asyncHandler');
const AppError       = require('../../utils/AppError');
const { clearCache } = require('../../middlewares/cache.middleware');
const { checkSavedSearches } = require('../../services/savedSearch.service');

// ─── Create Property ─────────────────────────────────────────
exports.createProperty = async (req, res, next) => {
  try {
    const images = req.body.images || [];
    const property = await Property.create({ ...req.body, images, owner: req.user._id });

    clearCache('/api/v1/properties');
    clearCache('/api/v1/search');

    // Notify users with matching saved searches
    checkSavedSearches(req.io, property).catch(() => {});

    res.status(201).json({ status: 'success', data: { property } });
  } catch (err) { next(err); }
};

// ─── Get All Properties ──────────────────────────────────────
exports.getAllProperties = asyncHandler(async (req, res) => {
  const features = new APIFeatures(Property.find({ isApproved: true }), req.query)
    .filter().search().sort().limitFields().paginate();

  const properties = await features.query.populate('owner', 'name email phone photo').lean();
  const total = await Property.countDocuments({ ...features.filterQuery, isApproved: true });

  res.status(200).json({
    status: 'success', results: properties.length, total,
    page:   req.query.page * 1 || 1,
    pages:  Math.ceil(total / (req.query.limit * 1 || 10)),
    data:   { properties },
  });
});

// ─── Get Single Property ─────────────────────────────────────
exports.getProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('owner', 'name email phone photo bio')
      .populate({ path: 'reviews', options: { limit: 5, sort: { createdAt: -1 } }, populate: { path: 'userId', select: 'name photo' } })
      .lean();

    if (!property) return next(new AppError('Property not found', 404));

    // Check if current user has favorited this property
    let isFavorited = false;
    if (req.user) {
      const fav = await Favorite.findOne({ user_id: req.user._id, property_id: property._id });
      isFavorited = !!fav;
    }

    res.status(200).json({ status: 'success', data: { property, isFavorited } });
  } catch (err) { next(err); }
};

// ─── Update Property ─────────────────────────────────────────
exports.updateProperty = async (req, res, next) => {
  try {
    const propertyToUpdate = await Property.findById(req.params.id);
    if (!propertyToUpdate) return next(new AppError('Property not found', 404));
    if (propertyToUpdate.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('You are not authorized to modify this property', 403));
    }

    const updates = { ...req.body };
    if (req.body.images?.length > 0 && req.query.append === 'true') {
      await Property.findByIdAndUpdate(req.params.id, { $push: { images: { $each: req.body.images } } });
      delete updates.images;
    }

    const property = await Property.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });

    clearCache('/api/v1/properties');
    clearCache('/api/v1/search');
    res.status(200).json({ status: 'success', data: { property } });
  } catch (err) { next(err); }
};

// ─── Delete Property ─────────────────────────────────────────
exports.deleteProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return next(new AppError('Property not found', 404));
    if (property.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(new AppError('You are not authorized to modify this property', 403));
    }

    for (const url of property.images) {
      try {
        const parts = url.split('/'); const fn = parts[parts.length-1].split('.')[0]; const folder = parts[parts.length-2];
        await cloudinary.uploader.destroy(`${folder}/${fn}`);
      } catch (e) {}
    }

    await Promise.all([
      Review.deleteMany({ propertyId: property._id }),
      Favorite.deleteMany({ property_id: property._id }),
      Booking.deleteMany({ property_id: property._id }),
      Inquiry.deleteMany({ property: property._id }),
      ViewingRequest.deleteMany({ property: property._id }),
    ]);

    await property.deleteOne();
    clearCache('/api/v1/properties');
    clearCache('/api/v1/search');
    res.status(204).json({ status: 'success', data: null });
  } catch (err) { next(err); }
};

// ─── Delete Single Image ─────────────────────────────────────
exports.deletePropertyImage = async (req, res, next) => {
  try {
    const { imageUrl } = req.body;
    const property = req.property;
    if (!imageUrl) return next(new AppError('imageUrl is required', 400));
    if (!property.images.includes(imageUrl)) return next(new AppError('Image not found', 404));
    if (property.images.length === 1) return next(new AppError('Cannot delete the only image', 400));

    try {
      const parts = imageUrl.split('/'); const fn = parts[parts.length-1].split('.')[0]; const folder = parts[parts.length-2];
      await cloudinary.uploader.destroy(`${folder}/${fn}`);
    } catch (e) {}

    property.images = property.images.filter(img => img !== imageUrl);
    await property.save();
    clearCache('/api/v1/properties');
    res.status(200).json({ status: 'success', data: { images: property.images } });
  } catch (err) { next(err); }
};

// ─── Get My Properties ───────────────────────────────────────
exports.getMyProperties = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { owner: req.user._id };
  if (status) filter.status = status;

  const skip  = (page - 1) * limit;
  const total = await Property.countDocuments(filter);
  const properties = await Property.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)).lean();

  res.status(200).json({ status: 'success', total, page: Number(page), pages: Math.ceil(total/limit), results: properties.length, data: { properties } });
});

// ─── Toggle Property Status ──────────────────────────────────
exports.togglePropertyStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const valid = ['available', 'reserved', 'sold'];
  if (!valid.includes(status)) return next(new AppError('Invalid status', 400));

  const property = req.property; // from isOwner
  property.status = status;
  await property.save();
  clearCache('/api/v1/properties');
  res.status(200).json({ status: 'success', data: { property } });
});
