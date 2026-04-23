const Property    = require('../../models/property.model');
const SavedSearch = require('../../models/savedSearch.model');
const asyncHandler = require('../../utils/asyncHandler');
const AppError     = require('../../utils/AppError');
const { cacheMiddleware } = require('../../middlewares/cache.middleware');
const { trackPropertyView } = require('../../services/analytics.service');

// ─── Advanced Search ──────────────────────────────────────────
// @route GET /api/v1/search
exports.advancedSearch = asyncHandler(async (req, res) => {
  const {
    q, type, listingType, city, district, minPrice, maxPrice,
    minArea, maxArea, bedrooms, bathrooms, minRating,
    sortBy = 'createdAt', order = 'desc',
    page = 1, limit = 12,
  } = req.query;

  const filter = { isApproved: true, status: 'available' };

  // Text search — using MongoDB text index for O(log n) performance instead of O(n) $regex
  // FIX — Confirmed use of $text to ensure best performance
  let textSearchScore = null;
  if (q) {
    filter.$text = { $search: q };
    textSearchScore = true; // Flag to include text score in projection
  }

  if (type)        filter.type        = type;
  if (listingType) filter.listingType = listingType;
  if (city)        filter['location.city']     = city; // Exact match is more efficient
  if (district)    filter['location.district'] = district; // Exact match is more efficient
  if (bedrooms)    filter.bedrooms  = { $gte: Number(bedrooms) };
  if (bathrooms)   filter.bathrooms = { $gte: Number(bathrooms) };
  if (minRating)   filter.avgRating = { $gte: Number(minRating) };

  const priceFilter = {};
  if (minPrice) priceFilter.$gte = Number(minPrice);
  if (maxPrice) priceFilter.$lte = Number(maxPrice);
  if (Object.keys(priceFilter).length) filter.price = priceFilter;

  const areaFilter = {};
  if (minArea) areaFilter.$gte = Number(minArea);
  if (maxArea) areaFilter.$lte = Number(maxArea);
  if (Object.keys(areaFilter).length) filter.area = areaFilter;

  const sortOrder = order === 'asc' ? 1 : -1;
  const validSorts = ['price', 'createdAt', 'avgRating', 'area', 'bedrooms'];
  const sortField  = validSorts.includes(sortBy) ? sortBy : 'createdAt';

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await Property.countDocuments(filter);

  let query = Property.find(filter);
  
  // When using text search, include text score and prioritize by relevance
  if (textSearchScore) {
    query = query.select({ score: { $meta: 'textScore' }, '-__v': 1 });
    // Sort by text score first if text search is active, then by specified sort field
    if (sortField === 'createdAt') {
      query = query.sort({ score: { $meta: 'textScore' }, [sortField]: sortOrder });
    } else {
      query = query.sort({ score: { $meta: 'textScore' } });
    }
  } else {
    query = query.select('-__v').sort({ [sortField]: sortOrder });
  }
  
  const properties = await query
    .populate('owner', 'name email phone photo')
    .skip(skip)
    .limit(Number(limit));

  // Price stats for the current search
  const priceStats = await Property.aggregate([
    { $match: filter },
    { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' }, avg: { $avg: '$price' } } },
  ]);

  res.status(200).json({
    status: 'success',
    total,
    page:   Number(page),
    pages:  Math.ceil(total / Number(limit)),
    count:  properties.length,
    priceStats: priceStats[0] ? {
      min: Math.round(priceStats[0].min),
      max: Math.round(priceStats[0].max),
      avg: Math.round(priceStats[0].avg),
    } : null,
    data: { properties },
  });
});

// ─── Saved Searches ───────────────────────────────────────────
exports.getSavedSearches = asyncHandler(async (req, res) => {
  const searches = await SavedSearch.find({ userId: req.user._id }).sort('-createdAt');
  res.status(200).json({ status: 'success', count: searches.length, data: { searches } });
});

exports.saveSearch = asyncHandler(async (req, res, next) => {
  const { name, filters, notifyOnMatch } = req.body;
  if (!name || !filters) return next(new AppError('name and filters are required', 400));

  const count = await SavedSearch.countDocuments({ userId: req.user._id });
  if (count >= 10) return next(new AppError('You cannot save more than 10 searches', 400));

  const search = await SavedSearch.create({
    userId: req.user._id, name, filters, notifyOnMatch: notifyOnMatch !== false,
  });
  res.status(201).json({ status: 'success', data: { search } });
});

exports.deleteSavedSearch = asyncHandler(async (req, res, next) => {
  const search = await SavedSearch.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!search) return next(new AppError('Search not found', 404));
  res.status(204).json({ status: 'success', data: null });
});

// ─── Property Analytics (Owner) ───────────────────────────────
exports.getPropertyAnalytics = asyncHandler(async (req, res, next) => {
  const Property = require('../../models/property.model');
  const prop = await Property.findById(req.params.id);
  if (!prop) return next(new AppError('Property not found', 404));
  if (prop.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return next(new AppError('You are not authorized', 403));
  }
  const { getPropertyAnalytics } = require('../../services/analytics.service');
  const days      = Number(req.query.days) || 30;
  const analytics = await getPropertyAnalytics(prop._id, days);
  res.status(200).json({ status: 'success', data: analytics });
});

// ─── Similar Properties ───────────────────────────────────────
exports.getSimilarProperties = asyncHandler(async (req, res, next) => {
  const property = await Property.findById(req.params.id).select('type listingType location.city price');
  if (!property) return next(new AppError('العقار غير موجود', 404));

  const similar = await Property.find({
    _id:         { $ne: property._id },
    type:        property.type,
    listingType: property.listingType,
    'location.city': property.location?.city,
    isApproved:  true,
    status:      'available',
    price:       { $gte: property.price * 0.7, $lte: property.price * 1.3 },
  })
    .select('title price location images avgRating bedrooms bathrooms area')
    .limit(6)
    .sort('-avgRating');

  res.status(200).json({ status: 'success', count: similar.length, data: { properties: similar } });
});
