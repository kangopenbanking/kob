/**
 * KYC/KYB submission client — routes EVERY customer-facing verification
 * through `unified-kyc-gateway` so **Didit** is the primary provider, with
 * automatic fallback to **Youverify**, and finally to the self-hosted
 * manual-upload flow (`kyc-submit` / `business-kyc-submit`) if both fail.
 *
 * Do NOT call `kyc-submit` or `business-kyc-submit` from the frontend
 * directly. Always go through these helpers.
 */
import { supabase } from "@/integrations/supabase/client";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-kyc-gateway`;

export interface KycGatewayResponse {
  trace_id: string;
  provider: "didit" | "youverify" | "self_hosted";
  fallback_triggered: boolean;
  result: "approved" | "rejected" | "pending" | "manual_review";
  risk_score?: number;
  session_id?: string;
  reference?: string;
  /** Didit hosted verification URL — auto-launched by the SDK when present. */
  verification_url?: string;
  raw?: Record<string, unknown>;
  error?: { code: string; message: string };
}

async function authedFetch(path: string, body: unknown): Promise<KycGatewayResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${FN_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let json: KycGatewayResponse | { error?: string; message?: string; raw?: string } | null = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok || (json as { error?: unknown })?.error) {
    const j = (json ?? {}) as { message?: string; error?: string };
    const msg = j.message || j.error || `verification failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Verification request failed");
  }
  return json as KycGatewayResponse;
}

/**
 * Launch the Didit hosted verification modal. Resolves when the modal closes
 * (user completed, cancelled, or errored). The final decision is delivered
 * asynchronously via the didit-webhook Edge Function — this promise only
 * signals that the client-side flow ended.
 */
export async function openDiditVerification(url: string): Promise<"completed" | "cancelled" | "failed"> {
  try {
    const mod: any = await import("@didit-protocol/sdk-web");
    const DiditSdk = mod.DiditSdk ?? mod.default?.DiditSdk ?? mod.default;
    if (!DiditSdk?.shared?.startVerification) {
      // SDK shape unexpected — fall back to a new tab so the user still finishes.
      window.open(url, "_blank", "noopener,noreferrer");
      return "completed";
    }
    return await new Promise((resolve) => {
      DiditSdk.shared.onComplete = (result: { status: "completed" | "cancelled" | "failed" }) => {
        resolve(result?.status ?? "completed");
      };
      DiditSdk.shared.startVerification({ url });
    });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return "completed";
  }
}

export interface IdentityKycPayload {
  verification_type?: "identity";
  /** Optional — Didit collects these itself during the hosted flow. */
  document_type?: string;
  document_number?: string;
  document_country?: string;
  document_expiry_date?: string;
  document_front_url?: string;
  document_back_url?: string;
  selfie_url?: string;
  source_app?: string;
  [k: string]: unknown;
}


export interface BusinessKybPayload {
  account_id?: string;
  business_name: string;
  registration_number: string;
  business_type?: string;
  industry?: string;
  vat_number?: string | null;
  tax_id?: string | null;
  registration_date?: string | null;
  business_address?: Record<string, unknown>;
  business_description?: string;
  annual_turnover?: number | null;
  number_of_employees?: number | null;
  registration_certificate_url?: string | null;
  articles_of_association_url?: string | null;
  tax_certificate_url?: string | null;
  proof_of_address_url?: string | null;
  bank_statement_url?: string | null;
  [k: string]: unknown;
}

async function submitAndMaybeLaunchDidit(
  path: string,
  payload: Record<string, unknown>,
): Promise<KycGatewayResponse> {
  const resp = await authedFetch(path, payload);
  if (resp.provider === "didit" && resp.verification_url) {
    // Fire-and-await the SDK modal; the webhook is the source of truth for
    // the actual decision, so callers can continue polling `/kyc/status/:id`.
    await openDiditVerification(resp.verification_url);
  }
  return resp;
}

/** Submit individual identity KYC through Didit-first gateway. */
export async function submitIdentityKyc(payload: IdentityKycPayload) {
  return submitAndMaybeLaunchDidit("/kyc/verify", { ...payload, verification_type: "identity" });
}

/** Submit business KYB through Didit-first gateway. */
export async function submitBusinessKyb(payload: BusinessKybPayload) {
  return submitAndMaybeLaunchDidit("/kyb/verify", { ...payload, verification_type: "business" });
}

