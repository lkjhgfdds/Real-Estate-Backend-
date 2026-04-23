const BaseProvider = require('./baseProvider');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Cash Provider (In-Person Payment)
// ─────────────────────────────────────────────────────────────────
// Status: pending → admin confirms in person → completed
// No online transaction, entirely manual
// ─────────────────────────────────────────────────────────────────

class CashProvider extends BaseProvider {
  constructor() {
    super('Cash');
  }

  /**
   * Create payment (cash payment setup)
   */
  async createPayment(data) {
    try {
      const { amount, paymentId, propertyName } = data;

      logger.info(`[Cash] Setting up cash payment: ${paymentId}, amount: ${amount}`);

      return {
        paymentKey: paymentId,
        instructions: `Booking confirmed. Please complete the payment of ${amount} in cash when meeting the property owner or agent.`,
        paymentMethod: {
          type: 'cash_on_meeting',
          meetingRequired: true,
          instructions: [
            '1. Contact the property owner/agent to arrange a meeting',
            '2. Bring exactly the required amount in cash',
            '3. Payment is due before signing the rental agreement',
            '4. Admin will confirm payment receipt',
          ],
        },
        metadata: {
          method: 'cash',
          requiresInPersonVerification: true,
          autoVerification: false,
        },
      };
    } catch (err) {
      logger.error('[Cash] createPayment error:', err);
      throw err;
    }
  }

  /**
   * Verify payment (admin only)
   */
  async verifyPayment(paymentKey) {
    try {
      logger.info(`[Cash] Cannot auto-verify: ${paymentKey}`);
      throw new Error('Cash payment requires admin manual verification');
    } catch (err) {
      logger.error('[Cash] verifyPayment error:', err);
      throw err;
    }
  }

  /**
   * Handle webhook (not applicable)
   */
  async handleWebhook(payload, payment) {
    logger.info('[Cash] handleWebhook not applicable');
    throw new Error('Cash payments are verified manually by admin');
  }

  /**
   * Refund (manual process)
   */
  async refund(transactionId) {
    try {
      logger.info(`[Cash] Refund initiated (manual): ${transactionId}`);
      return {
        transactionId,
        method: 'manual_cash_return',
        note: 'Cash refund must be handled directly between admin and user',
      };
    } catch (err) {
      logger.error('[Cash] refund error:', err);
      throw err;
    }
  }
}

module.exports = CashProvider;
