const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────
// Provider Factory
// ─────────────────────────────────────────────────────────────────
// Singleton pattern: returns same provider instance per method
// ─────────────────────────────────────────────────────────────────

class ProviderFactory {
  constructor() {
    this.providers = {};
    this.providerConstructors = {
      paymob: () => new (require('./paymob.provider'))(),
      paypal: () => new (require('./paypal.provider'))(),
      bank_transfer: () => new (require('./bankTransfer.provider'))(),
      cash: () => new (require('./cash.provider'))(),
    };
  }

  /**
   * Get provider by method
   */
  getProvider(method) {
    if (!this.providers[method]) {
      const createProvider = this.providerConstructors[method];
      if (!createProvider) {
        const validMethods = Object.keys(this.providerConstructors);
        throw new Error(
          `Unknown payment method: ${method}. Valid methods: ${validMethods.join(', ')}`
        );
      }

      try {
        this.providers[method] = createProvider();
      } catch (err) {
        const base = err?.message ? err.message : String(err);
        throw new Error(
          `Payment provider '${method}' is not configured or failed to initialize: ${base}`
        );
      }
    }

    const provider = this.providers[method];

    if (!provider) {
      const validMethods = Object.keys(this.providerConstructors);
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
    return Object.keys(this.providerConstructors);
  }
}

module.exports = new ProviderFactory();
