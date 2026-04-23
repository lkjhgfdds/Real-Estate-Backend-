const BaseProvider = require('./baseProvider');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Bank Transfer Provider (Manual Verification)
// ─────────────────────────────────────────────────────────────────
// Status: pending → admin verifies receipt → completed
// ─────────────────────────────────────────────────────────────────

class BankTransferProvider extends BaseProvider {
  constructor() {
    super('Bank Transfer');
    this.bankName = process.env.BANK_NAME || 'Commercial Bank';
    this.accountNumber = process.env.BANK_ACCOUNT_NUMBER || '12345678';
    this.iban = process.env.BANK_IBAN || 'EG1234567890ABCDEF';
  }

  /**
   * Create payment (return bank details for user)
   */
  async createPayment(data) {
    try {
      const { amount, paymentId, currency } = data;

      logger.info(`[BankTransfer] Creating payment: ${paymentId}, amount: ${amount}`);

      // Return bank details for manual transfer
      return {
        paymentKey: paymentId,
        bankDetails: {
          bankName: this.bankName,
          accountNumber: this.accountNumber,
          iban: this.iban,
          amount,
          currency: currency || 'EGP',
          reference: paymentId, // User should include this in transfer
          instructions: 'Please transfer the amount using the IBAN provided. Include the payment reference in the transfer description.',
        },
        metadata: {
          method: 'bank_transfer',
          manualVerification: true,
        },
      };
    } catch (err) {
      logger.error('[BankTransfer] createPayment error:', err);
      throw err;
    }
  }

  /**
   * Verify payment (no automatic verification)
   */
  async verifyPayment(paymentKey) {
    try {
      logger.info(`[BankTransfer] Cannot auto-verify: ${paymentKey}`);
      throw new Error('Bank transfer requires manual admin verification. Please upload receipt in dashboard.');
    } catch (err) {
      logger.error('[BankTransfer] verifyPayment error:', err);
      throw err;
    }
  }

  /**
   * Handle webhook (not applicable for bank transfer)
   */
  async handleWebhook(payload, payment) {
    logger.info('[BankTransfer] handleWebhook not applicable');
    throw new Error('Bank transfer uses manual verification, not webhooks');
  }

  /**
   * Refund (manual process)
   */
  async refund(transactionId) {
    try {
      logger.info(`[BankTransfer] Refund initiated (manual): ${transactionId}`);
      // Manual refund via bank
      return {
        transactionId,
        method: 'manual',
        note: 'Bank transfer refund must be processed manually by admin',
      };
    } catch (err) {
      logger.error('[BankTransfer] refund error:', err);
      throw err;
    }
  }
}

module.exports = BankTransferProvider;
