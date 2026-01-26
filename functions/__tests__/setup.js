/**
 * Jest setup file for Firebase Cloud Functions testing
 *
 * This file mocks Firebase Admin SDK and Stripe to enable unit testing
 * without hitting real services.
 */

// Mock Firebase Admin
jest.mock('firebase-admin', () => {
  const firestoreMock = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    collectionGroup: jest.fn().mockReturnThis(),
  };

  return {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => firestoreMock),
    auth: jest.fn(() => ({
      getUser: jest.fn(),
      createUser: jest.fn(),
    })),
    storage: jest.fn(() => ({
      bucket: jest.fn(() => ({
        file: jest.fn(() => ({
          delete: jest.fn(),
          exists: jest.fn(),
        })),
      })),
    })),
  };
});

// Mock Firebase Functions params
jest.mock('firebase-functions/params', () => ({
  defineString: jest.fn((key) => ({
    value: () => process.env[key] || `mock_${key}`,
  })),
}));

// Set up test environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock_secret';

// Global test utilities
global.testUtils = {
  /**
   * Create a mock Firestore document snapshot
   */
  createDocSnapshot: (data, exists = true) => ({
    exists,
    data: () => data,
    id: data?.id || 'mock-doc-id',
    ref: {
      update: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  }),

  /**
   * Create a mock Firestore query snapshot
   */
  createQuerySnapshot: (docs) => ({
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((doc, i) => ({
      id: doc.id || `doc-${i}`,
      data: () => doc,
      ref: {
        update: jest.fn().mockResolvedValue({}),
      },
    })),
    forEach: (cb) => docs.forEach((doc, i) => cb({
      id: doc.id || `doc-${i}`,
      data: () => doc,
    })),
  }),

  /**
   * Create mock Stripe objects
   */
  stripe: {
    createMockCustomer: (overrides = {}) => ({
      id: 'cus_mock123',
      email: 'test@example.com',
      metadata: {},
      ...overrides,
    }),

    createMockSubscription: (overrides = {}) => ({
      id: 'sub_mock123',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      items: {
        data: [{ price: { id: 'price_mock123' } }],
      },
      ...overrides,
    }),

    createMockCheckoutSession: (overrides = {}) => ({
      id: 'cs_mock123',
      url: 'https://checkout.stripe.com/mock',
      mode: 'subscription',
      customer: 'cus_mock123',
      subscription: 'sub_mock123',
      metadata: {},
      ...overrides,
    }),

    createMockProduct: (overrides = {}) => ({
      id: 'prod_mock123',
      name: 'Test Product',
      active: true,
      ...overrides,
    }),

    createMockPrice: (overrides = {}) => ({
      id: 'price_mock123',
      product: 'prod_mock123',
      unit_amount: 2999,
      currency: 'usd',
      recurring: { interval: 'month' },
      ...overrides,
    }),

    createMockRefund: (overrides = {}) => ({
      id: 're_mock123',
      amount: 2999,
      status: 'succeeded',
      ...overrides,
    }),

    createMockInvoice: (overrides = {}) => ({
      id: 'in_mock123',
      subscription: 'sub_mock123',
      amount_paid: 2999,
      status: 'paid',
      ...overrides,
    }),
  },
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
