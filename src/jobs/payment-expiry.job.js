const cron = require('node-cron');
const Payment = require('../models/payment.model');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Payment Expiry Cleanup Job
// ─────────────────────────────────────────────────────────────────
// Every 10 minutes: Find pending payments older than 30 min
// Mark them as 'expired' → user can retry
// ─────────────────────────────────────────────────────────────────

module.exports = () => {
  logger.info('[Cron] Starting payment expiry cleanup job...');

  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      const result = await Payment.updateMany(
        {
          status: 'pending',
          expiresAt: { $lt: now },
          isVerified: false,
        },
        {
          status: 'expired',
        }
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `[Cron] Payment expiry: ${result.modifiedCount} payments marked as expired`
        );
      }
    } catch (err) {
      logger.error('[Cron] Payment expiry job error:', err);
    }
  });

  logger.info('[Cron] Payment expiry job scheduled (every 10 minutes)');
};
