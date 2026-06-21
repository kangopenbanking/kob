/**
 * KYC/KYB submission client — routes EVERY customer-facing verification
 * through `unified-kyc-gateway` so Youverify is the default provider
 * (with automatic fallback to the self-hosted `kyc-submit` /
 * `business-kyc-submit` functions when the Youverify breaker is open).
 *
 * Do NOT call `kyc-submit` or `business-kyc-submit` from the frontend
 * directly. Always go through these helpers — that is what keeps
 * Youverify as the default verification system end-to-end.
 */
import { supabase } from "@/integrations/supabase/client";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unified-kyc-gateway`;

async function authedFetch(path: string, body: unknown) {
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
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok || json?.error) {
    const msg = json?.message || json?.error || `verification failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Verification request failed");
  }
  return json;
}

export interface IdentityKycPayload {
  verification_type?: "identity";
  document_type: string;
  document_number: string;
  document_country: string;
  document_expiry_date: string;
  document_front_url: string;
  document_back_url?: string;
  selfie_url: string;
  // Optional pass-throughs preserved by the gateway / fallback target
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

/** Submit individual identity KYC through Youverify-first gateway. */
export async function submitIdentityKyc(payload: IdentityKycPayload) {
  return authedFetch("/kyc/verify", { ...payload, verification_type: "identity" });
}

/** Submit business KYB through Youverify-first gateway. */
export async function submitBusinessKyb(payload: BusinessKybPayload) {
  return authedFetch("/kyb/verify", { ...payload, verification_type: "business" });
}
