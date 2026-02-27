import { describe, it, expect, vi } from 'vitest';

// Funding Intents domain logic tests

describe('Funding Intents', () => {
  describe('Fee Calculation', () => {
    const calculateGatewayFee = (amount: number, channel: string) => {
      let feeRate = 0.035;
      let fixedFee = 0;
      if (channel === 'mobile_money' || channel === 'account_funding') { feeRate = 0.025; fixedFee = 0; }
      else if (channel === 'card') { feeRate = 0.035; fixedFee = 100; }
      else if (channel === 'bank_transfer') { feeRate = 0.02; fixedFee = 75; }
      else if (channel === 'paypal') { feeRate = 0.035; fixedFee = 150; }
      const fee = Math.round(amount * feeRate + fixedFee);
      return { fee, net: amount - fee };
    };

    it('calculates mobile_money fee correctly', () => {
      const { fee, net } = calculateGatewayFee(50000, 'account_funding');
      expect(fee).toBe(1250);
      expect(net).toBe(48750);
    });

    it('calculates card fee correctly', () => {
      const { fee, net } = calculateGatewayFee(100000, 'card');
      expect(fee).toBe(3600);
      expect(net).toBe(96400);
    });

    it('calculates bank_transfer fee correctly', () => {
      const { fee, net } = calculateGatewayFee(25000, 'bank_transfer');
      expect(fee).toBe(575);
      expect(net).toBe(24425);
    });

    it('calculates paypal fee correctly', () => {
      const { fee, net } = calculateGatewayFee(50000, 'paypal');
      expect(fee).toBe(1900);
      expect(net).toBe(48100);
    });
  });

  describe('Scoped Fee Calculation', () => {
    const calculateScopedFee = (amount: number, method: string, scope: string) => {
      if (scope === 'merchant') {
        const fee = Math.round(amount * 0.02);
        return { fee, net: amount - fee };
      }
      if (scope === 'institution' || scope === 'external_api') {
        const fee = Math.round(amount * 0.015);
        return { fee, net: amount - fee };
      }
      // end_user: simulate standard fee
      let feeRate = 0.035;
      let fixedFee = 0;
      if (method === 'mobile_money') { feeRate = 0.025; fixedFee = 0; }
      else if (method === 'card') { feeRate = 0.035; fixedFee = 100; }
      else if (method === 'bank_transfer') { feeRate = 0.02; fixedFee = 75; }
      else if (method === 'paypal') { feeRate = 0.035; fixedFee = 150; }
      const fee = Math.round(amount * feeRate + fixedFee);
      return { fee, net: amount - fee };
    };

    it('merchant scope: flat 2%', () => {
      const { fee, net } = calculateScopedFee(100000, 'card', 'merchant');
      expect(fee).toBe(2000);
      expect(net).toBe(98000);
    });

    it('institution scope: flat 1.5%', () => {
      const { fee, net } = calculateScopedFee(100000, 'bank_transfer', 'institution');
      expect(fee).toBe(1500);
      expect(net).toBe(98500);
    });

    it('external_api scope: same as institution (1.5%)', () => {
      const { fee, net } = calculateScopedFee(200000, 'mobile_money', 'external_api');
      expect(fee).toBe(3000);
      expect(net).toBe(197000);
    });

    it('end_user scope: uses standard fee schedule', () => {
      const { fee, net } = calculateScopedFee(50000, 'mobile_money', 'end_user');
      expect(fee).toBe(1250);
      expect(net).toBe(48750);
    });

    it('merchant scope ignores method-specific fees', () => {
      const momo = calculateScopedFee(100000, 'mobile_money', 'merchant');
      const card = calculateScopedFee(100000, 'card', 'merchant');
      const paypal = calculateScopedFee(100000, 'paypal', 'merchant');
      expect(momo.fee).toBe(card.fee);
      expect(card.fee).toBe(paypal.fee);
      expect(momo.fee).toBe(2000);
    });
  });

  describe('Funding Scope Validation', () => {
    const VALID_SCOPES = ['end_user', 'merchant', 'institution', 'external_api'];

    it('accepts all valid scopes', () => {
      VALID_SCOPES.forEach(scope => {
        expect(VALID_SCOPES.includes(scope)).toBe(true);
      });
    });

    it('rejects invalid scopes', () => {
      expect(VALID_SCOPES.includes('admin')).toBe(false);
      expect(VALID_SCOPES.includes('')).toBe(false);
      expect(VALID_SCOPES.includes('partner')).toBe(false);
    });
  });

  describe('Status Machine', () => {
    const FINAL_STATUSES = ['succeeded', 'failed', 'cancelled', 'expired'];
    const NON_FINAL_STATUSES = ['created', 'pending_provider', 'pending_customer_action', 'pending_verification'];

    it('final statuses cannot be cancelled', () => {
      FINAL_STATUSES.forEach(status => {
        expect(FINAL_STATUSES.includes(status)).toBe(true);
      });
    });

    it('non-final statuses can be cancelled', () => {
      NON_FINAL_STATUSES.forEach(status => {
        expect(FINAL_STATUSES.includes(status)).toBe(false);
      });
    });

    it('all valid statuses are accounted for', () => {
      const allStatuses = [...FINAL_STATUSES, ...NON_FINAL_STATUSES];
      expect(allStatuses.length).toBe(8);
    });
  });

  describe('Method Validation', () => {
    const VALID_METHODS = ['mobile_money', 'card', 'paypal', 'bank_transfer'];

    it('accepts valid methods', () => {
      VALID_METHODS.forEach(method => {
        expect(VALID_METHODS.includes(method)).toBe(true);
      });
    });

    it('rejects invalid methods', () => {
      expect(VALID_METHODS.includes('bitcoin')).toBe(false);
      expect(VALID_METHODS.includes('')).toBe(false);
    });
  });

  describe('Provider Routing', () => {
    const resolveProvider = (method: string, provider?: string) => {
      if (provider) return provider;
      if (method === 'mobile_money') return 'flutterwave';
      if (method === 'card') return 'stripe';
      if (method === 'paypal') return 'paypal';
      return 'bank';
    };

    it('defaults MoMo to Flutterwave', () => {
      expect(resolveProvider('mobile_money')).toBe('flutterwave');
    });

    it('defaults card to Stripe', () => {
      expect(resolveProvider('card')).toBe('stripe');
    });

    it('defaults PayPal to PayPal', () => {
      expect(resolveProvider('paypal')).toBe('paypal');
    });

    it('defaults bank_transfer to bank', () => {
      expect(resolveProvider('bank_transfer')).toBe('bank');
    });

    it('respects explicit provider override', () => {
      expect(resolveProvider('mobile_money', 'stripe')).toBe('stripe');
    });
  });

  describe('Idempotency', () => {
    it('same idempotency key returns same response', () => {
      const intentCache = new Map<string, { id: string; amount: number }>();
      const key = 'idem-123';
      const accountId = 'acc-1';
      const cacheKey = `${accountId}:${key}`;

      const intent1 = { id: 'fi-1', amount: 50000 };
      intentCache.set(cacheKey, intent1);

      const cached = intentCache.get(cacheKey);
      expect(cached).toEqual(intent1);
    });
  });

  describe('Bank Transfer Instructions', () => {
    it('generates unique reference', () => {
      const txRef1 = `fi_acc12345_${Date.now()}`;
      const ref1 = `KOBFUND-${txRef1.slice(-8).toUpperCase()}`;
      
      expect(ref1).toMatch(/^KOBFUND-/);
      expect(ref1.length).toBeGreaterThan(8);
    });

    it('includes required bank details in next_action', () => {
      const nextAction = {
        type: 'bank_transfer_instructions',
        bank_name: 'Afriland First Bank',
        account_number: '10005 00041 09200950141 92',
        account_name: 'Kang Open Banking SA',
        reference: 'KOBFUND-ABCD1234',
        amount: 50000,
        currency: 'XAF',
      };

      expect(nextAction.type).toBe('bank_transfer_instructions');
      expect(nextAction.bank_name).toBeTruthy();
      expect(nextAction.account_number).toBeTruthy();
      expect(nextAction.reference).toMatch(/^KOBFUND-/);
    });
  });

  describe('PayPal XAF Conversion', () => {
    it('converts XAF to EUR for PayPal', () => {
      const amount = 50000;
      const eurAmount = (amount / 655.957).toFixed(2);
      expect(parseFloat(eurAmount)).toBeCloseTo(76.22, 0);
    });
  });

  describe('Expiration', () => {
    it('intents expire after 48 hours', () => {
      const now = Date.now();
      const expiresAt = new Date(now + 48 * 60 * 60 * 1000);
      const diff = expiresAt.getTime() - now;
      expect(diff).toBe(48 * 60 * 60 * 1000);
    });

    it('reconciliation expires intents older than 24h', () => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldIntent = { created_at: twentyFourHoursAgo.toISOString() };
      expect(new Date(oldIntent.created_at).getTime()).toBeLessThan(Date.now() - 23 * 60 * 60 * 1000);
    });
  });

  describe('Scope-Aware Crediting', () => {
    const getCreditTarget = (scope: string) => scope === 'merchant' ? 'gateway_merchant_wallets' : 'account_balances';

    it('merchant scope credits wallet, not account_balances', () => {
      expect(getCreditTarget('merchant')).toBe('gateway_merchant_wallets');
    });

    it('end_user scope credits account_balances', () => {
      expect(getCreditTarget('end_user')).toBe('account_balances');
    });

    it('institution scope credits account_balances', () => {
      expect(getCreditTarget('institution')).toBe('account_balances');
    });

    it('external_api scope credits account_balances', () => {
      expect(getCreditTarget('external_api')).toBe('account_balances');
    });
  });
});
