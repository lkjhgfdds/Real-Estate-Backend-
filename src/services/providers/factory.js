const PaymobProvider = require('./paymob.provider');
const PaypalProvider = require('./paypal.provider');
const BankTransferProvider = require('./bankTransfer.provider');
const CashProvider = require('./cash.provider');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Provider Factory
// ─────────────────────────────────────────────────────────────────
// Singleton pattern: returns same provider instance per method
// ─────────────────────────────────────────────────────────────────

class ProviderFactory {
  constructor() {
    this.providers = {
      paymob: new PaymobProvider(),
      paypal: new PaypalProvider(),
      bank_transfer: new BankTransferProvider(),
      cash: new CashProvider(),
    };
  }

  /**
   * Get provider by method
   */
  getProvider(method) {
    const provider = this.providers[method];

    if (!provider) {
      const validMethods = Object.keys(this.providers);
      throw new Error(
        `Unknown payment method: ${method}. Valid methods: ${validMethods.join(', ')}`
      );
    }

    logger.debug(`[ProviderFactory] Using provider: ${provider.name}`);
    return provider;
  }

  /**
   * List all available providers
   */
  listProviders() {
    return Object.keys(this.providers);
  }
}

module.exports = new ProviderFactory();
