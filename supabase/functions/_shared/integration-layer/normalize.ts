// KOB Integration Layer — Unified Response Normalizer
// Stripe-style envelopes for every resource. NEVER modifies upstream payloads;
// only re-shapes them for the integration-layer router output.

export type IntegrationObject =
  | "customer" | "account" | "balance" | "payment" | "transfer"
  | "payout" | "refund" | "webhook_endpoint" | "webhook_event"
  | "sandbox_event";

export interface UnifiedEnvelope<T = Record<string, unknown>> {
  id: string;
  object: IntegrationObject;
  status: string;
  amount?: number;
  currency?: string;
  created: number; // unix seconds
  livemode: boolean;
  metadata?: Record<string, unknown>;
  data: T;
  raw?: unknown; // raw upstream body — opt-in via ?include=raw
}

export interface UnifiedError {
  error: {
    type: "api_error" | "invalid_request_error" | "authentication_error"
        | "rate_limit_error" | "connector_error" | "idempotency_error";
    code: string;
    message: string;
    param?: string;
    request_id: string;
    upstream?: unknown;
  };
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function envelope<T extends Record<string, unknown>>(args: {
  id: string;
  object: IntegrationObject;
  status: string;
  amount?: number;
  currency?: string;
  created?: number;
  livemode?: boolean;
  metadata?: Record<string, unknown>;
  data: T;
  raw?: unknown;
  includeRaw?: boolean;
}): UnifiedEnvelope<T> {
  return {
    id: args.id,
    object: args.object,
    status: args.status,
    amount: args.amount,
    currency: args.currency,
    created: args.created ?? nowUnix(),
    livemode: args.livemode ?? false,
    metadata: args.metadata,
    data: args.data,
    raw: args.includeRaw ? args.raw : undefined,
  };
}

export function errorEnvelope(args: {
  type: UnifiedError["error"]["type"];
  code: string;
  message: string;
  param?: string;
  request_id: string;
  upstream?: unknown;
}): UnifiedError {
  return { error: { ...args } };
}

// ---------- Resource-specific normalizers ----------

export function normalizePayment(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  const id = String(upstream.id ?? upstream.charge_id ?? upstream.transaction_id ?? upstream.reference ?? "");
  const status = String(upstream.status ?? "pending").toLowerCase();
  const amount = Number(upstream.amount ?? upstream.amount_minor ?? 0);
  const currency = String(upstream.currency ?? "XAF");
  return envelope({
    id, object: "payment", status, amount, currency,
    metadata: (upstream.metadata as Record<string, unknown>) ?? undefined,
    data: {
      payment_method: upstream.payment_method ?? upstream.method ?? null,
      customer: upstream.customer_id ?? upstream.customer ?? null,
      reference: upstream.reference ?? null,
      provider: upstream.provider ?? upstream.connector ?? null,
      provider_reference: upstream.provider_reference ?? null,
    },
    raw: upstream, includeRaw,
  });
}

export function normalizeAccount(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  return envelope({
    id: String(upstream.id ?? upstream.account_id ?? ""),
    object: "account",
    status: String(upstream.is_active === false ? "inactive" : "active"),
    currency: String(upstream.currency ?? "XAF"),
    data: {
      holder: upstream.account_holder_name ?? null,
      type: upstream.account_type ?? null,
      identification_scheme: upstream.identification_scheme ?? null,
      identification_value: upstream.identification_value ?? null,
      institution_id: upstream.institution_id ?? null,
    },
    raw: upstream, includeRaw,
  });
}

export function normalizeTransfer(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  return envelope({
    id: String(upstream.id ?? upstream.transfer_id ?? upstream.reference ?? ""),
    object: "transfer",
    status: String(upstream.status ?? "pending").toLowerCase(),
    amount: Number(upstream.amount ?? 0),
    currency: String(upstream.currency ?? "XAF"),
    data: {
      from: upstream.from_account ?? upstream.source ?? null,
      to: upstream.to_account ?? upstream.destination ?? null,
      reference: upstream.reference ?? null,
    },
    raw: upstream, includeRaw,
  });
}

export function normalizePayout(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  return envelope({
    id: String(upstream.id ?? upstream.payout_id ?? ""),
    object: "payout",
    status: String(upstream.status ?? "pending").toLowerCase(),
    amount: Number(upstream.amount ?? 0),
    currency: String(upstream.currency ?? "XAF"),
    data: upstream, raw: upstream, includeRaw,
  });
}

export function normalizeRefund(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  return envelope({
    id: String(upstream.id ?? upstream.refund_id ?? ""),
    object: "refund",
    status: String(upstream.status ?? "pending").toLowerCase(),
    amount: Number(upstream.amount ?? 0),
    currency: String(upstream.currency ?? "XAF"),
    data: upstream, raw: upstream, includeRaw,
  });
}

export function normalizeCustomer(upstream: Record<string, unknown>, includeRaw = false): UnifiedEnvelope {
  return envelope({
    id: String(upstream.id ?? upstream.user_id ?? upstream.customer_id ?? ""),
    object: "customer",
    status: "active",
    data: {
      email: upstream.email ?? null,
      phone: upstream.phone ?? upstream.phone_number ?? null,
      name: upstream.name ?? upstream.full_name ?? null,
    },
    raw: upstream, includeRaw,
  });
}
