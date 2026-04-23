/**
 * APPLICATION CONSTANTS
 * 
 * Single source of truth for enum values used throughout the application.
 * Prevents bugs caused by hardcoded strings that don't match model enums.
 * 
 * Usage: const { PAYMENT_STATUS } = require('../utils/constants');
 *        { $match: { status: PAYMENT_STATUS.PAID } }
 */

/**
 * PAYMENT STATUS CONSTANTS
 * Must match Payment model enum: ['pending', 'paid', 'refunded', 'failed']
 * 
 * Benefits:
 * - IDE autocomplete for status values
 * - Compile-time type checking
 * - Single point to update if status values change
 * - Prevents silent failures from enum mismatches
 */
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FAILED: 'failed',
};

module.exports = {
  PAYMENT_STATUS: Object.freeze(PAYMENT_STATUS),
};
