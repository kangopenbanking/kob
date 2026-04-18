// ─────────────────────────────────────────────────────────────────────────────
// Phase 25 — KOB Bank Payout Router
//
// Decides whether a bank payout should be sent through the Kang Open Banking
// (KOB) connector network or fall back to the Flutterwave rail. The router is
// purely additive: callers receive a structured decision and a ready-to-await
// `execute()` thunk when the KOB rail is selected. Failures are logged and the
// caller is expected to fall back to the legacy provider so funds always move.
// ─────────────────────────────────────────────────────────────────────────────

import { getBankConnector } from "./bank-connectors/registry.ts";
import type {
  BankConnectorContext,
  TransferPayload,
  TransferResult,
} from "./bank-connectors/types.ts";

export type BankPayoutRail = "kob_open_banking" | "flutterwave";

export interface PayoutSelection {
  rail: BankPayoutRail;
  reason: string;
  bank_id?: string;
  bank_name?: string;
  adapter_type?: string;
  config_id?: string;
  health_status?: string;
  // Present only when rail === 'kob_open_banking'
  execute?: (payload: Omit<TransferPayload, "from_account">) => Promise<TransferResult>;
}

interface SelectArgs {
  supabase: any;
  bank_code?: string | null;
  swift_bic?: string | null;
  environment?: "sandbox" | "live";
  preferred_rail?: BankPayoutRail | "auto";
  source_account?: string;
}

/**
 * Resolve the best payout rail for a given destination bank.
 * Returns `flutterwave` when no KOB connector exists, is disabled, or is unhealthy.
 */
export async function selectBankPayoutRail(args: SelectArgs): Promise<PayoutSelection> {
  const {
    supabase,
    bank_code,
    swift_bic,
    environment = "sandbox",
    preferred_rail = "auto",
    source_account = "KANG-PLATFORM",
  } = args;

  const fallback = (reason: string): PayoutSelection => ({
    rail: "flutterwave",
    reason,
  });

  if (preferred_rail === "flutterwave") {
    return fallback("caller_requested_flutterwave");
  }
  if (!bank_code && !swift_bic) {
    return fallback("missing_bank_identifier");
  }

  // 1. Look up the bank in the KOB registry
  let bankQuery = supabase.from("banks").select("id, display_name, bank_code, swift_bic, status");
  if (bank_code) bankQuery = bankQuery.eq("bank_code", bank_code);
  else bankQuery = bankQuery.eq("swift_bic", swift_bic!);
  const { data: bank } = await bankQuery.limit(1).maybeSingle();

  if (!bank) return fallback("bank_not_registered_in_kob");
  if (bank.status !== "active") return fallback(`bank_status_${bank.status}`);

  // 2. Find an active connector config for this bank/environment
  const { data: cfg } = await supabase
    .from("bank_connector_configs")
    .select("id, adapter_type, environment, enabled, health_status, credentials_encrypted, config_json")
    .eq("bank_id", bank.id)
    .eq("environment", environment)
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cfg) return fallback("no_enabled_connector");
  if (cfg.health_status === "down") return fallback("connector_unhealthy");

  // 3. Build connector + execute thunk
  const connector = getBankConnector(cfg.adapter_type as any);
  const ctx: BankConnectorContext = {
    bank_id: bank.id,
    config_id: cfg.id,
    credentials: (cfg.credentials_encrypted as Record<string, string>) || {},
    config: (cfg.config_json as Record<string, unknown>) || {},
    environment: cfg.environment as "sandbox" | "live",
  };

  return {
    rail: "kob_open_banking",
    reason: "kob_connector_selected",
    bank_id: bank.id,
    bank_name: bank.display_name,
    adapter_type: cfg.adapter_type,
    config_id: cfg.id,
    health_status: cfg.health_status,
    execute: (payload) =>
      connector.initiateTransfer(ctx, {
        from_account: source_account,
        ...payload,
      }),
  };
}

/**
 * Convenience helper for callers that simply want a ledger trail of which rail
 * was used (for observability and the audit log).
 */
export function describeRailDecision(sel: PayoutSelection): Record<string, unknown> {
  return {
    rail: sel.rail,
    reason: sel.reason,
    bank_id: sel.bank_id,
    bank_name: sel.bank_name,
    adapter_type: sel.adapter_type,
    config_id: sel.config_id,
    health_status: sel.health_status,
  };
}
