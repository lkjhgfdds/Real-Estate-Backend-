const PropertyView = require('../models/propertyView.model');
const Property     = require('../models/property.model');
const Booking      = require('../models/booking.model');
const Payment      = require('../models/payment.model');
const logger       = require('../utils/logger');

/**
 * Log property view
 */
const trackPropertyView = async (propertyId, userId, ip, userAgent) => {
  try {
    await PropertyView.create({ property: propertyId, viewer: userId || null, ip, userAgent });
  } catch (e) {
    // silent — analytics shouldn't break the main flow
  }
};

/**
 * Property statistics (for owner)
 */
const getPropertyAnalytics = async (propertyId, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [views, uniqueViewers, bookings, revenue] = await Promise.all([
    PropertyView.countDocuments({ property: propertyId, viewedAt: { $gte: since } }),
    PropertyView.distinct('viewer', { property: propertyId, viewedAt: { $gte: since }, viewer: { $ne: null } }).then(a => a.length),
    Booking.countDocuments({ property_id: propertyId, created_at: { $gte: since } }),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $lookup: { from: 'bookings', localField: 'booking_id', foreignField: '_id', as: 'booking' } },
      { $unwind: '$booking' },
      { $match: { 'booking.property_id': propertyId, createdAt: { $gte: since } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  // Views over time (daily)
  const viewsOverTime = await PropertyView.aggregate([
    { $match: { property: propertyId, viewedAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$viewedAt' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return {
    period:      `${days} days`,
    views,
    uniqueViewers,
    bookings,
    revenue:      revenue[0]?.total || 0,
    conversionRate: views > 0 ? ((bookings / views) * 100).toFixed(2) + '%' : '0%',
    viewsOverTime,
  };
};

/**
 * Admin revenue report with period comparison
 */
const getAdminRevenueAnalytics = async () => {
  const thisMonth  = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lastMonth  = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0);

  const [thisMonthRev, lastMonthRev, monthlyTrend, topProperties] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: lastMonth, $lte: lastMonthEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]),
    Booking.aggregate([
      { $group: { _id: '$property_id', bookingCount: { $sum: 1 } } },
      { $sort: { bookingCount: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'properties', localField: '_id', foreignField: '_id', as: 'property' } },
      { $unwind: '$property' },
      { $project: { bookingCount: 1, 'property.title': 1, 'property.price': 1, 'property.location': 1 } },
    ]),
  ]);

  const currentTotal  = thisMonthRev[0]?.total  || 0;
  const previousTotal = lastMonthRev[0]?.total || 0;
  const growth = previousTotal > 0 ? (((currentTotal - previousTotal) / previousTotal) * 100).toFixed(1) : null;

  return {
    currentMonth:  { revenue: currentTotal, transactions: thisMonthRev[0]?.count || 0 },
    previousMonth: { revenue: previousTotal, transactions: lastMonthRev[0]?.count || 0 },
    growth:        growth ? `${growth}%` : 'N/A',
    monthlyTrend,
    topProperties,
  };
};

module.exports = { trackPropertyView, getPropertyAnalytics, getAdminRevenueAnalytics };
