const cron = require('node-cron');
const Booking = require('../models/booking.model');
const logger = require('../utils/logger');

// ─── Auto-complete Bookings ───────────────────────────────
// FIX #19 — Automatically convert completed bookings to 'completed' status
// So users can write reviews for properties they actually used

const initBookingJob = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();

      // Find all approved bookings where end_date has passed
      const completed = await Booking.updateMany(
        {
          status: 'approved',
          end_date: { $lt: now },
        },
        { $set: { status: 'completed' } }
      );

      if (completed.modifiedCount > 0) {
        logger.info(`[BookingJob] Marked ${completed.modifiedCount} booking(s) as completed`);
      }
    } catch (err) {
      logger.error(`[BookingJob] Error: ${err.message}`);
    }
  });

  logger.info('⏰ Booking scheduler started — auto-completing expired bookings');
};

module.exports = { initBookingJob };
