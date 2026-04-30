// ============================================================
// @kangopenbanking/sdk — Phase 3 helpers
// Additive: introduced in SDK v1.4.0. Does NOT modify any
// existing method, type, or resource. Safe to tree-shake.
// Standards cited: PSD2 RTS Art. 36 (event integrity), Stripe
// API Reference (exports & webhook reliability baseline).
// ============================================================

import type { KangOpenBanking } from "./client";

export type ExportFormat = "csv" | "xlsx" | "json";

export interface ExportFilters {
  merchant_id: string;
  from?: string;            // ISO date (YYYY-MM-DD)
  to?: string;              // ISO date
  environment?: "sandbox" | "live";
  currency?: string;        // XAF, XOF, USD, EUR, NGN, ...
  format?: ExportFormat;
}

export interface ExportJob {
  export_id: string;
  status: "queued" | "processing" | "ready" | "failed";
  format: ExportFormat;
  download_url?: string;
  expires_at?: string;
}

export interface StatementRequest {
  merchant_id: string;
  month: string;            // YYYY-MM
  format?: "json" | "csv" | "pdf";
}

export interface ReconciliationRunRequest {
  merchant_id: string;
  from: string;
  to: string;
}

export interface MerchantApiKey {
  id: string;
  prefix: string;
  scopes: string[];
  environment: "sandbox" | "live";
  created_at: string;
  last_used_at?: string | null;
}

export interface MerchantWebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  event_type: string;
  status: "pending" | "delivered" | "failed";
  attempt: number;
  max_attempts: number;
  response_status: number | null;
  created_at: string;
}

/**
 * Phase-3 merchant operations: exports, statements, reconciliation,
 * API key lifecycle and webhook reliability.
 *
 * Wire it onto an existing KangOpenBanking instance:
 *   const kob = new KangOpenBanking({...});
 *   const merchant = new MerchantOpsResource(kob);
 *   await merchant.exports.transactions({ merchant_id, from, to });
 */
export class MerchantOpsResource {
  constructor(private client: KangOpenBanking) {}

  readonly exports = {
    transactions: (filters: ExportFilters): Promise<ExportJob> =>
      this.client.request("POST", "merchant-exports", { resource: "transactions", ...filters }),
    settlements: (filters: ExportFilters): Promise<ExportJob> =>
      this.client.request("POST", "merchant-exports", { resource: "settlements", ...filters }),
    fees: (filters: ExportFilters): Promise<ExportJob> =>
      this.client.request("POST", "merchant-exports", { resource: "fees", ...filters }),
    get: (exportId: string): Promise<ExportJob> =>
      this.client.request("GET", "merchant-exports", undefined, { export_id: exportId }),
  };

  readonly statements = {
    download: (req: StatementRequest): Promise<{ url: string; expires_at: string }> =>
      this.client.request("GET", "gateway-merchant-statement", undefined, {
        merchant_id: req.merchant_id,
        month: req.month,
        format: req.format ?? "pdf",
      }),
  };

  readonly reconciliation = {
    run: (req: ReconciliationRunRequest): Promise<{ run_id: string; status: string }> =>
      this.client.request("POST", "gateway-reconciliation-run", req),
    get: (runId: string): Promise<{ run_id: string; status: string; mismatches: number }> =>
      this.client.request("GET", "gateway-reconciliation-run", undefined, { run_id: runId }),
  };

  readonly apiKeys = {
    list: (merchantId: string): Promise<MerchantApiKey[]> =>
      this.client.request("GET", "gateway-merchant-api-keys", undefined, { merchant_id: merchantId }),
    create: (params: { merchant_id: string; label: string; scopes: string[]; environment: "sandbox" | "live" }): Promise<MerchantApiKey & { plaintext_key: string }> =>
      this.client.request("POST", "gateway-merchant-api-keys", { action: "create", ...params }),
    revoke: (keyId: string): Promise<{ id: string; revoked: true }> =>
      this.client.request("POST", "gateway-merchant-api-keys", { action: "revoke", key_id: keyId }),
    rotate: (keyId: string): Promise<MerchantApiKey & { plaintext_key: string }> =>
      this.client.request("POST", "gateway-merchant-api-keys", { action: "rotate", key_id: keyId }),
  };

  readonly webhooks = {
    listEndpoints: (merchantId: string): Promise<MerchantWebhookEndpoint[]> =>
      this.client.request("GET", "gateway-webhook-endpoints", undefined, { merchant_id: merchantId }),
    listDeliveries: (params: { endpoint_id: string; limit?: number; status?: string }): Promise<WebhookDelivery[]> =>
      this.client.request("GET", "gateway-webhook-deliveries", undefined, {
        endpoint_id: params.endpoint_id,
        ...(params.limit ? { limit: String(params.limit) } : {}),
        ...(params.status ? { status: params.status } : {}),
      }),
    replayDelivery: (params: { endpoint_id: string; delivery_id: string }): Promise<{ replay_delivery_id: string; status: string }> =>
      this.client.request("POST", "gateway-webhook-replay-delivery", params),
    rotateSecret: (endpointId: string): Promise<{ id: string; secret: string; rotated_at: string }> =>
      this.client.request("POST", "gateway-webhook-endpoints", { action: "rotate_secret", endpoint_id: endpointId }),
  };
}
