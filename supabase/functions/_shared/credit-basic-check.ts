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
 *
 * On the false→true transition we ALSO emit:
 *   1. An in-app notice via `app_notifications` (idempotency-keyed so the
 *      customer never receives it twice).
 *   2. A "basic check complete" app email through the shared
 *      `send-transactional-email` function (uses the same idempotency key so
 *      the transactional queue de-duplicates retries).
 *
 * All side effects are wrapped in try/catch — a notification failure must
 * never break the credit-score fetch path.
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

  const wasPassed = !!existing?.basic_check_passed;
  const transitioning = passed && !wasPassed;

  if (!existing) {
    await sb.from("credit_profiles").upsert(payload, { onConflict: "user_id" });
  } else if (existing.basic_check_passed !== passed) {
    await sb.from("credit_profiles").update(payload).eq("user_id", userId);
  }

  if (!transitioning) return;

  // ── Fan-out: in-app notice + email. Best-effort only. ───────────────
  const idempotencyKey = `crediq-basic-check-unlocked-${userId}`;
  try {
    await sb.from("app_notifications").upsert(
      {
        user_id: userId,
        type: "credit_score",
        title: "Your CrediQ score is unlocking",
        message:
          "Your identity, phone and profile checks all passed. Your credit score is being calculated now — tap to view it.",
        icon: "shield-check",
        is_read: false,
        metadata: { source: "basic_check_unlocked", route: "/app/credit" },
        idempotency_key: idempotencyKey,
      },
      { onConflict: "idempotency_key" },
    );
  } catch (err) {
    console.warn("[credit-basic-check] app_notifications insert failed", (err as Error).message);
  }

  try {
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const recipient = profile?.email as string | undefined;
    if (recipient) {
      await sb.functions.invoke("send-transactional-email", {
        body: {
          templateName: "crediq-basic-check-unlocked",
          recipientEmail: recipient,
          idempotencyKey,
          templateData: {
            name: (profile?.full_name as string | undefined)?.split(" ")[0] ?? "",
          },
        },
      });
    }
  } catch (err) {
    console.warn("[credit-basic-check] send-transactional-email failed", (err as Error).message);
  }
}
