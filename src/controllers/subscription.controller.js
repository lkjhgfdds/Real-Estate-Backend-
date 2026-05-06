// ──────────────────────────────────────────────────────────
// Subscription Controller
// ──────────────────────────────────────────────────────────

const Subscription = require('../models/subscription.model');
const User = require('../models/user.model');
const Property = require('../models/property.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { logAction } = require('../services/audit.service');
const { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS } = require('../utils/constants');

// ──────────────────────────────────────────────────────────
// PUBLIC / USER ENDPOINTS
// ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/subscriptions/plans
 * List all available subscription plans
 */
exports.getPlans = (req, res) => {
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    id: key,
    ...plan,
  }));

  res.status(200).json({
    status: 'success',
    data: { plans },
  });
};

/**
 * GET /api/v1/subscriptions/my
 * Get current user's active subscription
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      user: req.user._id,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    }).lean();

    res.status(200).json({
      status: 'success',
      data: sub || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/subscriptions/history
 * Get all subscriptions for current user
 */
exports.getMySubscriptionHistory = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user._id })
      .sort('-createdAt')
      .lean();

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      data: { subscriptions },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/subscriptions/checkout
 * Initiate a payment session for a subscription plan.
 * Returns a payment URL — subscription is activated ONLY via webhook.
 */
exports.subscriptionCheckout = async (req, res, next) => {
  try {
    const { plan, paymentMethod } = req.body;

    // Validate plan
    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid plan. Available plans: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`,
      });
    }

    const validMethods = ['paymob', 'paypal'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid payment method. Use: ${validMethods.join(', ')}`,
      });
    }

    // Check for existing active subscription
    const existing = await Subscription.findOne({
      user: req.user._id,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });
    if (existing) {
      return res.status(400).json({
        status: 'fail',
        message: 'You already have an active subscription.',
        data: { currentPlan: existing.plan, endDate: existing.endDate },
      });
    }

    // Check for existing pending subscription (prevent duplicate checkout)
    const pendingSub = await Subscription.findOne({
      user: req.user._id,
      status: 'pending',
    });
    if (pendingSub) {
      return res.status(400).json({
        status: 'fail',
        code: 'PENDING_SUBSCRIPTION_EXISTS',
        message: 'You have a pending subscription payment. Please complete or cancel it first.',
      });
    }

    const planConfig = SUBSCRIPTION_PLANS[plan];
    const startDate  = new Date();
    const endDate    = new Date(startDate.getTime() + planConfig.durationDays * 24 * 60 * 60 * 1000);

    // 1. Create pending subscription (activated by webhook later)
    const subscription = await Subscription.create({
      user:                    req.user._id,
      plan,
      status:                  'pending',    // NOT active yet!
      maxListings:             planConfig.maxListings,
      listingsUsedThisMonth:   0,
      price:                   planConfig.price,
      currency:                planConfig.currency || 'EGP',
      startDate,
      endDate,
      paymentMethod,
      paymentVerified:         false,        // Set to true by webhook ONLY
    });

    // 2. Create pending Payment record (Transaction Layer)
    const Payment = require('../models/payment.model');
    const ProviderFactory = require('../services/providers/factory');
    const logger = require('../utils/logger');

    const platformFee = Math.round(planConfig.price * 0.025 * 100) / 100;
    const payment = await Payment.create({
      paymentType:  'subscription',
      user:         req.user._id,
      subscription: subscription._id,
      propertyPrice: planConfig.price,
      platformFee,
      netAmount:    planConfig.price,
      totalAmount:  planConfig.price + platformFee,
      paymentMethod,
      status:       'pending',
      expiresAt:    new Date(Date.now() + 30 * 60 * 1000), // 30 min
      ipAddress:    req.ip,
      userAgent:    req.headers['user-agent'],
    });

    // Link payment to subscription
    subscription.pendingPaymentId = payment._id;
    await subscription.save();

    // 3. Route to payment provider
    let providerResult;
    try {
      const provider = ProviderFactory.getProvider(paymentMethod);
      providerResult = await provider.createPayment({
        amount:         payment.totalAmount,
        paymentId:      payment._id.toString(),
        userId:         req.user._id.toString(),
        currency:       planConfig.currency || 'EGP',
        description:    `Luxe Estates — ${planConfig.name} Plan`,
        // No propertyId/bookingId for subscriptions
      });
    } catch (provErr) {
      // Rollback: cancel pending payment + subscription
      payment.status = 'failed';
      await payment.save();
      subscription.status = 'cancelled';
      await subscription.save();
      logger.error('[SUBSCRIPTION] Provider error:', provErr.message);
      return next(new Error(`Payment provider error: ${provErr.message}`));
    }

    // Update payment with provider response
    payment.paymentKey = providerResult.paymentKey || null;
    payment.provider   = paymentMethod;
    payment.metadata   = providerResult.metadata || {};
    await payment.save();

    logger.info(`[SUBSCRIPTION] Checkout initiated: user=${req.user._id}, plan=${plan}, payment=${payment._id}`);

    res.status(200).json({
      status:      'success',
      message:     'Payment session created. Complete payment to activate subscription.',
      data: {
        paymentId:       payment._id,
        subscriptionId:  subscription._id,
        plan:            planConfig.name,
        amount:          payment.totalAmount,
        currency:        planConfig.currency || 'EGP',
        paymentMethod,
        expiresAt:       payment.expiresAt,
        // Provider-specific redirect/iframe
        paymentUrl:      providerResult.paymentUrl || null,
        paymentKey:      providerResult.paymentKey || null,
        iframeUrl:       providerResult.iframeKey  || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/subscriptions/subscribe
 * Direct subscribe (admin-granted or cash — still creates active sub for backward compat).
 * For gateway payments, use /subscriptions/checkout instead.
 */
exports.subscribe = async (req, res, next) => {

  try {
    const { plan } = req.body;

    // Validate plan
    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid plan. Available plans: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`,
      });
    }

    // Check for existing active subscription
    const existing = await Subscription.findOne({
      user: req.user._id,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });

    if (existing) {
      return res.status(400).json({
        status: 'fail',
        message: 'You already have an active subscription.',
        data: {
          currentPlan: existing.plan,
          endDate: existing.endDate,
        },
      });
    }

    // Create subscription
    const planConfig = SUBSCRIPTION_PLANS[plan];
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + planConfig.durationDays * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      user: req.user._id,
      plan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      maxListings: planConfig.maxListings,
      listingsUsedThisMonth: 0,
      price: planConfig.price,
      currency: planConfig.currency,
      startDate,
      endDate,
      paymentMethod: req.body.paymentMethod || 'manual',
      transactionId: req.body.transactionId || null,
      paymentVerified: true, // Manual/cash subscriptions are considered verified
    });

    // Update user with subscription reference
    await User.findByIdAndUpdate(req.user._id, {
      activeSubscription: subscription._id,
      subscriptionStatus: 'active',
    });

    logger.info(`[SUBSCRIPTION] User ${req.user._id} subscribed to ${plan} plan | ends ${endDate.toISOString()}`);

    res.status(201).json({
      status: 'success',
      message: `Successfully subscribed to ${planConfig.name} plan.`,
      data: { subscription },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/subscriptions/cancel
 * Cancel current active subscription
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const sub = await Subscription.findOne({
      user: req.user._id,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });

    if (!sub) {
      return res.status(404).json({
        status: 'fail',
        message: 'No active subscription found.',
      });
    }

    sub.status = SUBSCRIPTION_STATUS.CANCELLED;
    await sub.save();

    await User.findByIdAndUpdate(req.user._id, {
      activeSubscription: null,
      subscriptionStatus: 'none',
    });

    logger.info(`[SUBSCRIPTION] User ${req.user._id} cancelled ${sub.plan} subscription`);

    res.status(200).json({
      status: 'success',
      message: 'Subscription cancelled successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ──────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/subscriptions/admin/list
 * List all subscriptions with pagination (Admin only)
 */
exports.adminListSubscriptions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { status: filterStatus } = req.query;

    const filter = {};
    if (filterStatus && filterStatus !== 'all') {
      filter.status = filterStatus;
    }

    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate('user', 'name email role photo')
        .populate('activatedBy', 'name email')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    res.status(200).json({
      status: 'success',
      results: subscriptions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: { subscriptions },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/subscriptions/admin/:id/activate
 * Admin manually activates a subscription
 */
exports.adminActivateSubscription = async (req, res, next) => {
  try {
    const { plan } = req.body;
    const userId = req.params.id;

    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({
        status: 'fail',
        message: `Invalid plan. Available: ${Object.keys(SUBSCRIPTION_PLANS).join(', ')}`,
      });
    }

    // Cancel existing active subscription if any
    await Subscription.updateMany(
      { user: userId, status: SUBSCRIPTION_STATUS.ACTIVE },
      { status: SUBSCRIPTION_STATUS.CANCELLED }
    );

    const planConfig = SUBSCRIPTION_PLANS[plan];
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + planConfig.durationDays * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.create({
      user: userId,
      plan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      maxListings: planConfig.maxListings,
      listingsUsedThisMonth: 0,
      price: planConfig.price,
      currency: planConfig.currency,
      startDate,
      endDate,
      activatedBy: req.user._id,
      paymentMethod: 'admin_manual',
      paymentVerified: true,  // Admin activation bypasses payment gateway
    });

    await User.findByIdAndUpdate(userId, {
      activeSubscription: subscription._id,
      subscriptionStatus: 'active',
    });

    logger.info(`[SUBSCRIPTION] Admin ${req.user._id} activated ${plan} for user ${userId}`);

    await logAction(
      req.user._id, 'ACTIVATE_SUBSCRIPTION', 'Subscription', subscription._id,
      { after: { plan, userId, endDate } },
      { ip: req.ip, userAgent: req.headers['user-agent'] }
    );

    res.status(200).json({
      status: 'success',
      message: `${planConfig.name} plan activated successfully.`,
      data: { subscription },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/subscriptions/admin/revenue
 * Subscription revenue analytics (Admin only)
 */
exports.adminSubscriptionRevenue = async (req, res, next) => {
  try {
    const [stats] = await Subscription.aggregate([
      {
        $facet: {
          totals: [
            { $group: {
              _id: null,
              totalRevenue: { $sum: '$price' },
              totalSubscriptions: { $sum: 1 },
            }},
          ],
          byPlan: [
            { $group: {
              _id: '$plan',
              revenue: { $sum: '$price' },
              count: { $sum: 1 },
            }},
            { $sort: { revenue: -1 } },
          ],
          byStatus: [
            { $group: {
              _id: '$status',
              count: { $sum: 1 },
            }},
          ],
          monthly: [
            { $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              revenue: { $sum: '$price' },
              count: { $sum: 1 },
            }},
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        totalRevenue: stats.totals[0]?.totalRevenue || 0,
        totalSubscriptions: stats.totals[0]?.totalSubscriptions || 0,
        byPlan: stats.byPlan,
        byStatus: stats.byStatus,
        monthly: stats.monthly,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/subscriptions/admin/:id/hard-cancel
 * Admin immediately revokes subscription and optionally archives all listings.
 */
exports.hardCancelSubscription = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sub = await Subscription.findById(req.params.id).session(session);

    if (!sub) {
      return res.status(404).json({ status: 'fail', message: 'Subscription not found' });
    }

    if (sub.status !== SUBSCRIPTION_STATUS.ACTIVE) {
      return res.status(400).json({ status: 'fail', message: 'Only active subscriptions can be hard cancelled' });
    }

    const reason = req.body.reason || 'Hard cancelled by admin';

    // 1. Mark subscription as cancelled and force revoked
    sub.status = SUBSCRIPTION_STATUS.CANCELLED;
    sub.cancelledAt = new Date();
    sub.cancelledBy = req.user._id;
    sub.cancelReason = reason;
    sub.forceRevoked = true;

    await sub.save({ session });

    // 2. Clear active subscription reference from User
    await User.findByIdAndUpdate(sub.user, {
      activeSubscription: null,
      subscriptionStatus: 'none',
    }, { session });

    // 3. Optional: Archive all user properties
    let propertyCount = 0;
    if (req.body.forceDeactivateListings === true) {
      const result = await Property.updateMany(
        { owner: sub.user, status: { $ne: 'archived' } },
        { status: 'archived' },
        { session }
      );
      propertyCount = result.modifiedCount || result.nModified || 0;
    }

    // 4. Log Action
    await logAction(
      req.user._id, 
      'ADMIN_HARD_CANCEL_SUBSCRIPTION', 
      'Subscription', 
      sub._id,
      { 
        before: { status: SUBSCRIPTION_STATUS.ACTIVE, forceRevoked: false },
        after: { status: SUBSCRIPTION_STATUS.CANCELLED, forceRevoked: true, listingsArchived: propertyCount }
      },
      { ip: req.ip, userAgent: req.headers['user-agent'], reason }
    );

    await session.commitTransaction();
    logger.info(`[SUBSCRIPTION] Admin ${req.user._id} hard-cancelled subscription ${sub._id} for user ${sub.user}. Listings archived: ${propertyCount}`);

    res.status(200).json({
      status: 'success',
      message: 'Subscription has been immediately revoked and locked.',
      data: {
        subscriptionId: sub._id,
        listingsArchived: propertyCount
      }
    });

  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};
