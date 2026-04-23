// ─────────────────────────────────────────────────────────────────
// Base Provider (Abstract)
// ─────────────────────────────────────────────────────────────────
// All payment providers must implement these methods
// ─────────────────────────────────────────────────────────────────

class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Create payment in provider's system
   * Returns: { paymentKey, paymentUrl/iframeKey, metadata }
   */
  async createPayment(data) {
    throw new Error(`${this.name}.createPayment() not implemented`);
  }

  /**
   * Verify payment with provider (polling)
   * Returns: { success: boolean, transactionId, metadata }
   */
  async verifyPayment(paymentKey) {
    throw new Error(`${this.name}.verifyPayment() not implemented`);
  }

  /**
   * Handle webhook from provider (optional)
   * Returns: { success: boolean, transactionId, metadata }
   */
  async handleWebhook(payload, payment) {
    throw new Error(`${this.name}.handleWebhook() not implemented`);
  }

  /**
   * Refund payment (optional)
   * Returns: { transactionId }
   */
  async refund(transactionId) {
    throw new Error(`${this.name}.refund() not implemented`);
  }
}

module.exports = BaseProvider;
