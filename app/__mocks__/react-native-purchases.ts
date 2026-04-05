// Audit fix 10.19 — Enhanced mock for react-native-purchases with configurable state
let _isPremium = false;

export function setPremiumState(premium: boolean) {
  _isPremium = premium;
}

const _makeCustomerInfo = () => ({
  entitlements: {
    active: _isPremium ? { premium: { identifier: 'premium', isActive: true } } : {},
    all: _isPremium ? { premium: { identifier: 'premium', isActive: true } } : {},
  },
  activeSubscriptions: _isPremium ? ['premium_monthly'] : [],
});

export default {
  configure: jest.fn(),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn().mockImplementation(() => Promise.resolve(_makeCustomerInfo())),
  getCustomerInfo: jest.fn().mockImplementation(() => Promise.resolve(_makeCustomerInfo())),
};
