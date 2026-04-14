// ============================================================
// @kangopenbanking/sdk — KOB API Client
// ============================================================

import {
  KOBClientConfig,
  OAuthTokenRequest,
  OAuthTokenResponse,
  Account,
  Balance,
  Transaction,
  Beneficiary,
  Charge,
  CreateChargeRequest,
  Refund,
  CreateRefundRequest,
  Payout,
  CreatePayoutRequest,
  FeeEstimate,
  PaginatedResponse,
  ApiError,
} from './types';

const DEFAULT_BASE_URL = 'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1';
const DEFAULT_TIMEOUT = 30000;

class KOBError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly errorId: string;

  constructor(statusCode: number, body: ApiError) {
    super(body.message || body.error);
    this.name = 'KOBError';
    this.statusCode = statusCode;
    this.errorCode = body.error_code;
    this.errorId = body.error_id;
  }
}

export class KangOpenBanking {
  private config: Required<Pick<KOBClientConfig, 'clientId' | 'baseUrl' | 'environment' | 'timeout'>> &
    Pick<KOBClientConfig, 'clientSecret' | 'apiKey'>;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  public readonly auth: AuthResource;
  public readonly accounts: AccountsResource;
  public readonly balances: BalancesResource;
  public readonly transactions: TransactionsResource;
  public readonly beneficiaries: BeneficiariesResource;
  public readonly charges: ChargesResource;
  public readonly refunds: RefundsResource;
  public readonly payouts: PayoutsResource;
  public readonly gateway: GatewayResource;
  public readonly sandbox: SandboxResource;
  public readonly webhooks: WebhooksResource;

  constructor(config: KOBClientConfig) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      environment: config.environment || 'sandbox',
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };

    this.auth = new AuthResource(this);
    this.accounts = new AccountsResource(this);
    this.balances = new BalancesResource(this);
    this.transactions = new TransactionsResource(this);
    this.beneficiaries = new BeneficiariesResource(this);
    this.charges = new ChargesResource(this);
    this.refunds = new RefundsResource(this);
    this.payouts = new PayoutsResource(this);
    this.gateway = new GatewayResource(this);
    this.sandbox = new SandboxResource(this);
    this.webhooks = new WebhooksResource(this);
  }

  /** Set token manually (e.g. from authorization_code flow) */
  setAccessToken(token: string, expiresIn?: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 : 0;
  }

  /** Internal: ensure a valid token is available */
  async ensureToken(): Promise<string> {
    if (this.accessToken && (this.tokenExpiresAt === 0 || Date.now() < this.tokenExpiresAt - 60000)) {
      return this.accessToken;
    }
    if (this.config.clientSecret) {
      const token = await this.auth.getToken({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'accounts balances transactions payments gateway',
      });
      this.accessToken = token.access_token;
      this.tokenExpiresAt = Date.now() + token.expires_in * 1000;
      return this.accessToken;
    }
    throw new Error('No access token available. Call setAccessToken() or provide clientSecret for auto-refresh.');
  }

  /** Internal: make an authenticated request */
  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.baseUrl}/${path}`);
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Use API key for sandbox, Bearer token for production
    if (this.config.apiKey && this.config.environment === 'sandbox') {
      headers['X-API-Key'] = this.config.apiKey;
    } else {
      const token = await this.ensureToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new KOBError(res.status, data as ApiError);
      }

      return data as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Verify webhook HMAC-SHA256 signature */
  async verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === signature;
  }
}

// --- Resource Classes ---

class AuthResource {
  constructor(private client: KangOpenBanking) {}

  async getToken(params: OAuthTokenRequest): Promise<OAuthTokenResponse> {
    const body = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) body.set(k, v); });

    const res = await fetch(`${(this.client as any).config.baseUrl}/oauth-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) throw new KOBError(res.status, data);
    return data;
  }

  buildAuthorizationUrl(params: {
    redirectUri: string;
    scope: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): string {
    const url = new URL(`${(this.client as any).config.baseUrl}/oauth-authorize`);
    url.searchParams.set('client_id', (this.client as any).config.clientId);
    url.searchParams.set('redirect_uri', params.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', params.scope);
    if (params.state) url.searchParams.set('state', params.state);
    if (params.codeChallenge) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', params.codeChallengeMethod || 'S256');
    }
    return url.toString();
  }
}

class AccountsResource {
  constructor(private client: KangOpenBanking) {}
  async list(): Promise<Account[]> {
    return this.client.request('GET', 'aisp-accounts');
  }
  async get(accountId: string): Promise<Account> {
    return this.client.request('GET', `aisp-accounts`, undefined, { account_id: accountId });
  }
}

class BalancesResource {
  constructor(private client: KangOpenBanking) {}
  async get(accountId: string): Promise<Balance[]> {
    return this.client.request('GET', 'aisp-balances', undefined, { account_id: accountId });
  }
}

class TransactionsResource {
  constructor(private client: KangOpenBanking) {}
  async list(accountId: string, params?: { from?: string; to?: string; page?: number; per_page?: number }): Promise<PaginatedResponse<Transaction>> {
    return this.client.request('GET', 'aisp-transactions', undefined, {
      account_id: accountId,
      ...(params?.from && { from: params.from }),
      ...(params?.to && { to: params.to }),
      ...(params?.page && { page: String(params.page) }),
      ...(params?.per_page && { per_page: String(params.per_page) }),
    });
  }
}

class BeneficiariesResource {
  constructor(private client: KangOpenBanking) {}
  async list(accountId: string): Promise<Beneficiary[]> {
    return this.client.request('GET', 'aisp-beneficiaries', undefined, { account_id: accountId });
  }
}

class ChargesResource {
  constructor(private client: KangOpenBanking) {}
  async create(params: CreateChargeRequest): Promise<Charge> {
    return this.client.request('POST', 'gateway-charges', { action: 'create_charge', ...params });
  }
  async get(chargeId: string): Promise<Charge> {
    return this.client.request('POST', 'gateway-charges', { action: 'get_charge', charge_id: chargeId });
  }
  async verify(chargeId: string): Promise<Charge> {
    return this.client.request('POST', 'gateway-charges', { action: 'verify_charge', charge_id: chargeId });
  }
  async list(params?: { merchant_id?: string; status?: string; page?: number }): Promise<PaginatedResponse<Charge>> {
    return this.client.request('POST', 'gateway-charges', { action: 'list_charges', ...params });
  }
}

class RefundsResource {
  constructor(private client: KangOpenBanking) {}
  async create(params: CreateRefundRequest): Promise<Refund> {
    return this.client.request('POST', 'gateway-refunds', { action: 'create', ...params });
  }
  async get(refundId: string): Promise<Refund> {
    return this.client.request('POST', 'gateway-refunds', { action: 'get', refund_id: refundId });
  }
}

class PayoutsResource {
  constructor(private client: KangOpenBanking) {}
  async create(params: CreatePayoutRequest): Promise<Payout> {
    return this.client.request('POST', 'gateway-payouts', { action: 'create', ...params });
  }
  async get(payoutId: string): Promise<Payout> {
    return this.client.request('POST', 'gateway-payouts', { action: 'get', payout_id: payoutId });
  }
}

class GatewayResource {
  constructor(private client: KangOpenBanking) {}
  async estimateFee(params: { amount: number; channel: string; currency?: string }): Promise<FeeEstimate> {
    return this.client.request('POST', 'gateway-charges', { action: 'fee_estimate', ...params });
  }
}

class SandboxResource {
  constructor(private client: KangOpenBanking) {}
  async createAccount(params: { account_holder_name: string; currency?: string }): Promise<any> {
    return this.client.request('POST', 'sandbox-create-account', params);
  }
  async generateData(params: { type: string; count?: number }): Promise<any> {
    return this.client.request('POST', 'sandbox-generate-data', params);
  }
}

class WebhooksResource {
  constructor(private client: KangOpenBanking) {}
  async register(params: { url: string; events: string[] }): Promise<any> {
    return this.client.request('POST', 'sandbox-register-webhook', params);
  }
}

export { KOBError };
