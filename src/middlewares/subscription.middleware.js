// ──────────────────────────────────────────────────────────
// Subscription Guard Middleware (v2 — Payment-Verified Hard Gate)
// ──────────────────────────────────────────────────────────

const Subscription = require('../models/subscription.model');

/**
 * Enforce active + payment-verified subscription + listing limit.
 * Admins bypass this check entirely.
 *
 * Hard Gate Rules:
 *   1. subscription.status === 'active'         — must be active
 *   2. subscription.paymentVerified === true     — must have paid (via webhook)
 *   3. listingsUsedThisMonth < maxListings       — must not be at limit
 *
 * Usage:
 *   router.post('/properties', protect, requireKYC, restrictTo('owner','agent','admin'),
 *     requireActiveSubscription, controller);
 *
 * On success, attaches `req.subscription` for controller to increment usage.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    // Admins can create properties without subscription
    if (req.user.role === 'admin') return next();

    const sub = await Subscription.findOne({
      user:   req.user._id,
      status: 'active',
    });

    // No subscription found
    if (!sub) {
      return res.status(403).json({
        status:  'fail',
        code:    'NO_SUBSCRIPTION',
        message: req.t ? req.t('SUBSCRIPTION.REQUIRED') : 'Active subscription required to create properties.',
        data:    { subscriptionStatus: 'none' },
      });
    }

    // Subscription exists but payment not verified (e.g., checkout started but not completed)
    if (!sub.paymentVerified) {
      return res.status(403).json({
        status:  'fail',
        code:    'SUBSCRIPTION_PAYMENT_PENDING',
        message: 'Your subscription payment is not yet verified. Please complete payment to start listing properties.',
        data:    {
          subscriptionId:  sub._id,
          plan:            sub.plan,
          pendingPaymentId: sub.pendingPaymentId,
        },
      });
    }

    // Check monthly listing limit (-1 = unlimited)
    if (sub.maxListings !== -1 && sub.listingsUsedThisMonth >= sub.maxListings) {
      return res.status(403).json({
        status:  'fail',
        code:    'LISTING_LIMIT_REACHED',
        message: req.t
          ? req.t('SUBSCRIPTION.LIMIT_REACHED', { used: sub.listingsUsedThisMonth, limit: sub.maxListings })
          : `Monthly listing limit reached (${sub.listingsUsedThisMonth}/${sub.maxListings}). Upgrade your plan.`,
        data: {
          plan:    sub.plan,
          used:    sub.listingsUsedThisMonth,
          limit:   sub.maxListings,
          endDate: sub.endDate,
        },
      });
    }

    // ✅ All checks passed — attach subscription for controller to increment usage
    req.subscription = sub;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireActiveSubscription };
