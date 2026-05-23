/**
 * Shared "basic check" gate for the CrediQ credit scoring system.
 *
 * No customer receives a credit score until they have completed the
 * minimum identity and profile checks below. This protects the integrity
 * of the score and prevents speculative ranking of unverified profiles.
 *
 * Basic check requirements:
 *   1. Profile row exists
 *   2. Full name (>= 3 chars, contains a space)
 *   3. Date of birth present
 *   4. Country code present
 *   5. Phone verified (phone_verified = true)
 *   6. At least one KYC verification with status = 'approved' OR 'verified'
 */

// Note: a Supabase client must be passed in (service role) by the caller.
// deno-lint-ignore no-explicit-any
type SB = any;

export interface BasicCheckResult {
  passed: boolean;
  missing: string[];
  details: {
    profile_exists: boolean;
    has_full_name: boolean;
    has_date_of_birth: boolean;
    has_country: boolean;
    phone_verified: boolean;
    kyc_verified: boolean;
  };
}

export async function evaluateBasicCheck(sb: SB, userId: string): Promise<BasicCheckResult> {
  const { data: profile } = await sb
    .from("profiles")
    .select("id, full_name, date_of_birth, country_code, phone_verified")
    .eq("id", userId)
    .maybeSingle();

  const profile_exists = !!profile;
  const fullName = (profile?.full_name || "").trim();
  const has_full_name = fullName.length >= 3 && fullName.includes(" ");
  const has_date_of_birth = !!(profile?.date_of_birth || "").trim();
  const has_country = !!(profile?.country_code || "").trim();
  const phone_verified = profile?.phone_verified === true;

  let kyc_verified = false;
  if (profile_exists) {
    const { data: kyc } = await sb
      .from("kyc_verifications")
      .select("id, status")
      .eq("user_id", userId)
      .in("status", ["approved", "verified"])
      .limit(1)
      .maybeSingle();
    kyc_verified = !!kyc;
  }

  const missing: string[] = [];
  if (!profile_exists) missing.push("profile");
  if (!has_full_name) missing.push("full_name");
  if (!has_date_of_birth) missing.push("date_of_birth");
  if (!has_country) missing.push("country");
  if (!phone_verified) missing.push("phone_verification");
  if (!kyc_verified) missing.push("kyc");

  const passed = missing.length === 0;

  return {
    passed,
    missing,
    details: {
      profile_exists,
      has_full_name,
      has_date_of_birth,
      has_country,
      phone_verified,
      kyc_verified,
    },
  };
}

/**
 * Persist the basic-check flag onto credit_profiles. Safe to call whenever
 * the engine runs; only updates if the value actually changed.
 */
export async function persistBasicCheckFlag(
  sb: SB,
  userId: string,
  passed: boolean,
): Promise<void> {
  const { data: existing } = await sb
    .from("credit_profiles")
    .select("user_id, basic_check_passed")
    .eq("user_id", userId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    user_id: userId,
    basic_check_passed: passed,
    basic_check_completed_at: passed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (!existing) {
    await sb.from("credit_profiles").upsert(payload, { onConflict: "user_id" });
    return;
  }
  if (existing.basic_check_passed !== passed) {
    await sb.from("credit_profiles").update(payload).eq("user_id", userId);
  }
}
