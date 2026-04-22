// KOB Integration Layer — Node SDK namespace
// Additive: introduced in SDK v1.3.0. Does NOT change any existing method.

export interface IntegrationOptions {
  idempotencyKey?: string;
  env?: "sandbox" | "live";
}

export interface PaymentCreateInput {
  amount: number;
  currency: string;
  method: "card" | "mobile_money" | "bank" | "wallet";
  country?: string;
  msisdn?: string;
  customer?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  preferred_connector?: string;
}

export interface UnifiedEnvelope<T = Record<string, unknown>> {
  id: string;
  object: string;
  status: string;
  amount?: number;
  currency?: string;
  created: number;
  livemode: boolean;
  metadata?: Record<string, unknown>;
  data: T;
}

export interface UnifiedError {
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    request_id: string;
  };
}

type Caller = (path: string, body: unknown, opts?: IntegrationOptions) => Promise<unknown>;

export class IntegrationNamespace {
  constructor(private call: Caller) {}

  payments = {
    create: (input: PaymentCreateInput, opts?: IntegrationOptions) =>
      this.call("/integration-layer/payments.create", input, opts) as Promise<UnifiedEnvelope>,
    retrieve: (id: string, opts?: IntegrationOptions) =>
      this.call("/integration-layer/payments.retrieve", { id }, opts) as Promise<UnifiedEnvelope>,
  };

  customers = {
    create: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/customers.create", input, opts) as Promise<UnifiedEnvelope>,
    retrieve: (id: string, opts?: IntegrationOptions) =>
      this.call("/integration-layer/customers.retrieve", { id }, opts) as Promise<UnifiedEnvelope>,
  };

  accounts = {
    list: (input: Record<string, unknown> = {}, opts?: IntegrationOptions) =>
      this.call("/integration-layer/accounts.list", input, opts) as Promise<{ object: "list"; data: UnifiedEnvelope[] }>,
    balances: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/accounts.balances", input, opts),
  };

  transfers = {
    initiate: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/transfers.create", input, opts) as Promise<UnifiedEnvelope>,
    create: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/transfers.create", input, opts) as Promise<UnifiedEnvelope>,
  };

  payouts = {
    create: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/payouts.create", input, opts) as Promise<UnifiedEnvelope>,
    cancel: (id: string, opts?: IntegrationOptions) =>
      this.call("/integration-layer/payouts.cancel", { id }, opts) as Promise<UnifiedEnvelope>,
  };

  refunds = {
    create: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/refunds.create", input, opts) as Promise<UnifiedEnvelope>,
  };

  webhooks = {
    register: (input: Record<string, unknown>, opts?: IntegrationOptions) =>
      this.call("/integration-layer/webhooks.register", input, opts),
    replay: (eventId: string, opts?: IntegrationOptions) =>
      this.call("/integration-layer/webhooks.replay", { event_id: eventId }, opts),
    ping: (opts?: IntegrationOptions) =>
      this.call("/integration-layer/webhooks.ping", {}, opts),
  };
}
