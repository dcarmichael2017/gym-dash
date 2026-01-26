/**
 * Stripe Mock for Testing
 *
 * Provides a configurable mock of the Stripe SDK for unit testing.
 * Each method can be configured to return specific values or throw errors.
 */

class StripeMock {
  constructor() {
    this.reset();
  }

  reset() {
    this._responses = {
      accounts: {},
      customers: {},
      products: {},
      prices: {},
      subscriptions: {},
      checkoutSessions: {},
      billingPortalSessions: {},
      refunds: {},
      coupons: {},
      promotionCodes: {},
      paymentMethods: {},
    };
    this._errors = {};
  }

  // Configure mock responses
  setResponse(category, method, response) {
    if (!this._responses[category]) this._responses[category] = {};
    this._responses[category][method] = response;
  }

  setError(category, method, error) {
    if (!this._errors[category]) this._errors[category] = {};
    this._errors[category][method] = error;
  }

  _getResponse(category, method, defaultResponse) {
    if (this._errors[category]?.[method]) {
      throw this._errors[category][method];
    }
    return this._responses[category]?.[method] ?? defaultResponse;
  }

  // Stripe SDK Mock Implementation
  get accounts() {
    return {
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve(this._getResponse('accounts', 'create', {
          id: 'acct_mock123',
          type: 'express',
          ...data,
        }))
      ),
      retrieve: jest.fn().mockImplementation((id) =>
        Promise.resolve(this._getResponse('accounts', 'retrieve', {
          id,
          charges_enabled: true,
          payouts_enabled: true,
          requirements: { currently_due: [] },
        }))
      ),
      update: jest.fn().mockImplementation((id, data) =>
        Promise.resolve(this._getResponse('accounts', 'update', { id, ...data }))
      ),
      createLoginLink: jest.fn().mockImplementation(() =>
        Promise.resolve(this._getResponse('accounts', 'createLoginLink', {
          url: 'https://connect.stripe.com/express/mock',
        }))
      ),
    };
  }

  get accountLinks() {
    return {
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve(this._getResponse('accountLinks', 'create', {
          url: 'https://connect.stripe.com/setup/mock',
          ...data,
        }))
      ),
    };
  }

  get customers() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('customers', 'create', {
          id: 'cus_mock123',
          ...data,
        }))
      ),
      retrieve: jest.fn().mockImplementation((id) =>
        Promise.resolve(this._getResponse('customers', 'retrieve', {
          id,
          email: 'test@example.com',
        }))
      ),
      list: jest.fn().mockImplementation(() =>
        Promise.resolve(this._getResponse('customers', 'list', { data: [] }))
      ),
    };
  }

  get products() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('products', 'create', {
          id: 'prod_mock123',
          ...data,
        }))
      ),
      update: jest.fn().mockImplementation((id, data, options) =>
        Promise.resolve(this._getResponse('products', 'update', { id, ...data }))
      ),
    };
  }

  get prices() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('prices', 'create', {
          id: 'price_mock123',
          ...data,
        }))
      ),
      update: jest.fn().mockImplementation((id, data, options) =>
        Promise.resolve(this._getResponse('prices', 'update', { id, ...data }))
      ),
    };
  }

  get subscriptions() {
    return {
      retrieve: jest.fn().mockImplementation((id, options) =>
        Promise.resolve(this._getResponse('subscriptions', 'retrieve', {
          id,
          status: 'active',
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        }))
      ),
      update: jest.fn().mockImplementation((id, data, options) =>
        Promise.resolve(this._getResponse('subscriptions', 'update', { id, ...data }))
      ),
      cancel: jest.fn().mockImplementation((id, options) =>
        Promise.resolve(this._getResponse('subscriptions', 'cancel', {
          id,
          status: 'canceled',
        }))
      ),
    };
  }

  get checkout() {
    return {
      sessions: {
        create: jest.fn().mockImplementation((data, options) =>
          Promise.resolve(this._getResponse('checkoutSessions', 'create', {
            id: 'cs_mock123',
            url: 'https://checkout.stripe.com/pay/mock',
            ...data,
          }))
        ),
        retrieve: jest.fn().mockImplementation((id) =>
          Promise.resolve(this._getResponse('checkoutSessions', 'retrieve', {
            id,
            payment_status: 'paid',
          }))
        ),
      },
    };
  }

  get billingPortal() {
    return {
      sessions: {
        create: jest.fn().mockImplementation((data, options) =>
          Promise.resolve(this._getResponse('billingPortalSessions', 'create', {
            id: 'bps_mock123',
            url: 'https://billing.stripe.com/session/mock',
            ...data,
          }))
        ),
      },
    };
  }

  get refunds() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('refunds', 'create', {
          id: 're_mock123',
          status: 'succeeded',
          ...data,
        }))
      ),
    };
  }

  get coupons() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('coupons', 'create', {
          id: 'coupon_mock123',
          ...data,
        }))
      ),
      update: jest.fn().mockImplementation((id, data, options) =>
        Promise.resolve(this._getResponse('coupons', 'update', { id, ...data }))
      ),
      del: jest.fn().mockImplementation((id, options) =>
        Promise.resolve(this._getResponse('coupons', 'del', { id, deleted: true }))
      ),
    };
  }

  get promotionCodes() {
    return {
      create: jest.fn().mockImplementation((data, options) =>
        Promise.resolve(this._getResponse('promotionCodes', 'create', {
          id: 'promo_mock123',
          code: data.code || 'TESTCODE',
          ...data,
        }))
      ),
      list: jest.fn().mockImplementation((params, options) =>
        Promise.resolve(this._getResponse('promotionCodes', 'list', { data: [] }))
      ),
    };
  }

  get paymentMethods() {
    return {
      list: jest.fn().mockImplementation((params, options) =>
        Promise.resolve(this._getResponse('paymentMethods', 'list', {
          data: [
            {
              id: 'pm_mock123',
              card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2025 },
            },
          ],
        }))
      ),
    };
  }

  get webhooks() {
    return {
      constructEvent: jest.fn().mockImplementation((payload, sig, secret) => {
        // Return the payload as-is for testing, or throw if configured
        if (this._errors.webhooks?.constructEvent) {
          throw this._errors.webhooks.constructEvent;
        }
        return typeof payload === 'string' ? JSON.parse(payload) : payload;
      }),
    };
  }
}

// Create singleton instance
const stripeMock = new StripeMock();

// Factory function that returns the mock (mimics stripe(apiKey) call)
const stripeFactory = jest.fn(() => stripeMock);

module.exports = { stripeMock, stripeFactory };
