/**
 * Translate Firebase Auth errors into user-friendly messages and a
 * machine-readable category the UI can act on (e.g. show a banner).
 */
export type FirebaseErrorCategory =
  | 'invalid-phone'
  | 'too-many-requests'
  | 'unauthorized-domain'
  | 'recaptcha-disabled'
  | 'billing-required'
  | 'network'
  | 'provider-disabled'
  | 'invalid-code'
  | 'expired-code'
  | 'unknown';

export interface MappedFirebaseError {
  category: FirebaseErrorCategory;
  /** Short message safe to show in toast / inline error. */
  userMessage: string;
  /** Longer hint shown in the fallback banner. */
  hint?: string;
  /** True if the app should automatically fall back to Vonage SMS. */
  shouldFallback: boolean;
  /** Raw Firebase error code (e.g. 'auth/invalid-app-credential') for diagnostics. */
  rawCode?: string;
}

/**
 * Build a user-safe diagnostics block describing what to check, given the
 * mapped error category and current runtime context. Safe to render in the UI.
 */
export function buildOTPDiagnostics(
  mapped: MappedFirebaseError,
  ctx: { host: string; env: string; expectedDomains: string[]; domainOk: boolean },
): { title: string; checks: Array<{ label: string; ok: boolean | null; detail?: string }> } {
  const checks: Array<{ label: string; ok: boolean | null; detail?: string }> = [];
  checks.push({
    label: `Current host "${ctx.host}" is in Firebase Authorized domains (${ctx.env})`,
    ok: ctx.domainOk,
    detail: ctx.domainOk ? undefined : `Add "${ctx.host}" in Firebase Console → Authentication → Settings → Authorized domains.`,
  });
  if (mapped.category === 'recaptcha-disabled') {
    checks.push({
      label: 'reCAPTCHA v2 Invisible active (no Enterprise key bound)',
      ok: false,
      detail: 'In Firebase Console → Authentication → Settings → reCAPTCHA Enterprise, unlink any site key so the SDK falls back to the free v2 Invisible widget.',
    });
    checks.push({
      label: 'Identity Toolkit API enabled',
      ok: null,
      detail: 'Verify identitytoolkit.googleapis.com is enabled in Google Cloud Console → APIs & Services.',
    });
  }
  if (mapped.category === 'billing-required') {
    checks.push({
      label: 'Firebase project on Blaze plan',
      ok: false,
      detail: 'Phone Auth SMS requires the Blaze (pay-as-you-go) plan.',
    });
  }
  if (mapped.category === 'provider-disabled') {
    checks.push({
      label: 'Phone provider enabled in Firebase Auth',
      ok: false,
      detail: 'Firebase Console → Authentication → Sign-in method → Phone → Enable.',
    });
  }
  return {
    title: mapped.userMessage,
    checks,
  };
}

export function mapFirebaseAuthError(err: any): MappedFirebaseError {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || '').toLowerCase();

  // Domain not authorized in Firebase Console
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain') || msg.includes('not authorized')) {
    return {
      category: 'unauthorized-domain',
      userMessage: 'This domain is not authorized for phone sign-in.',
      hint: 'The current website address must be added in Firebase Console → Authentication → Settings → Authorized domains. Switching to SMS fallback…',
      shouldFallback: true,
      rawCode: code || undefined,
    };
  }

  // reCAPTCHA Enterprise not enabled / misconfigured
  if (
    code === 'auth/captcha-check-failed' ||
    code === 'auth/missing-app-credential' ||
    code === 'auth/invalid-app-credential' ||
    msg.includes('recaptcha') ||
    msg.includes('error-code:-39')
  ) {
    return {
      category: 'recaptcha-disabled',
      userMessage: 'Phone verification is temporarily unavailable.',
      hint: 'reCAPTCHA v2 Invisible could not load. If a reCAPTCHA Enterprise key is still bound in Firebase Auth settings, unlink it. Switching to SMS fallback…',
      shouldFallback: true,
      rawCode: code || undefined,
    };
  }

  // Billing / Blaze plan not active
  if (code === 'auth/billing-not-enabled' || msg.includes('billing')) {
    return {
      category: 'billing-required',
      userMessage: 'Phone verification is temporarily unavailable.',
      hint: 'Firebase Blaze plan billing must be active to send SMS via Phone Auth. Switching to SMS fallback…',
      shouldFallback: true,
      rawCode: code || undefined,
    };
  }

  // Provider disabled
  if (code === 'auth/operation-not-allowed') {
    return {
      category: 'provider-disabled',
      userMessage: 'Phone sign-in is disabled for this project.',
      hint: 'Enable Phone provider in Firebase Console → Authentication → Sign-in method. Switching to SMS fallback…',
      shouldFallback: true,
      rawCode: code || undefined,
    };
  }

  // Network / transient
  if (
    code === 'auth/network-request-failed' ||
    code === 'auth/internal-error' ||
    code === 'auth/timeout' ||
    code === 'auth/quota-exceeded' ||
    msg.includes('503') ||
    msg.includes('network')
  ) {
    return {
      category: 'network',
      userMessage: 'Phone verification service is temporarily unreachable.',
      hint: 'Switching to SMS fallback…',
      shouldFallback: true,
      rawCode: code || undefined,
    };
  }

  // Hard user errors — do NOT fallback
  if (code === 'auth/invalid-phone-number') {
    return {
      category: 'invalid-phone',
      userMessage: 'Invalid phone number. Please check the format (e.g. +237 6XX XXX XXX).',
      shouldFallback: false,
      rawCode: code || undefined,
    };
  }
  if (code === 'auth/too-many-requests') {
    return {
      category: 'too-many-requests',
      userMessage: 'Too many attempts on this number. Please wait a few minutes and try again.',
      shouldFallback: false,
      rawCode: code || undefined,
    };
  }
  if (code === 'auth/invalid-verification-code') {
    return {
      category: 'invalid-code',
      userMessage: 'Incorrect code. Please check and try again.',
      shouldFallback: false,
      rawCode: code || undefined,
    };
  }
  if (code === 'auth/code-expired') {
    return {
      category: 'expired-code',
      userMessage: 'This code has expired. Please request a new one.',
      shouldFallback: false,
      rawCode: code || undefined,
    };
  }

  return {
    category: 'unknown',
    userMessage: err?.message || 'Verification failed. Please try again.',
    hint: 'Switching to SMS fallback…',
    shouldFallback: true,
    rawCode: code || undefined,
  };
}
