/**
 * OTP provider mode toggle.
 *
 * Controls whether the phone-auth flow may fall back to Vonage SMS when
 * Firebase fails. Combines:
 *  1. ?otpMode=firebase-only | fallback   (URL param — per-session override)
 *  2. localStorage 'kob.otpMode'          (persists across reloads)
 *  3. VITE_OTP_MODE env var               (build-time default)
 *  4. Admin-managed `otp_provider_settings` row for the current environment
 *  5. 'fallback' (final default)
 */
import { detectEnv, type AppEnv } from '@/lib/firebase';

export type OTPMode = 'firebase-only' | 'fallback';

const STORAGE_KEY = 'kob.otpMode';

export interface ResolvedOTPSettings {
  mode: OTPMode;
  source: 'url' | 'storage' | 'env' | 'admin' | 'default';
  firebase_enabled: boolean;
  sms_fallback_enabled: boolean;
  environment: AppEnv;
  role_scope: 'all' | 'admin' | 'user';
}

function readUrlParam(): OTPMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URLSearchParams(window.location.search).get('otpMode');
    if (v === 'firebase-only' || v === 'fallback') return v;
  } catch { /* noop */ }
  return null;
}

function readStorage(): OTPMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'firebase-only' || v === 'fallback') return v;
  } catch { /* noop */ }
  return null;
}

function readEnv(): OTPMode | null {
  const v = (import.meta as any).env?.VITE_OTP_MODE;
  if (v === 'firebase-only' || v === 'fallback') return v;
  return null;
}

export function getOTPMode(): OTPMode {
  return readUrlParam() ?? readStorage() ?? readEnv() ?? 'fallback';
}

export function setOTPMode(mode: OTPMode): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
}

export function isFirebaseOnly(): boolean {
  return getOTPMode() === 'firebase-only';
}

/**
 * In-memory cache of admin-managed settings (per environment) so the hook
 * does not block on a network round trip. Populated by `useOTPProviderSettings`.
 */
let _adminSettingsCache: { firebase_enabled: boolean; sms_fallback_enabled: boolean; role_scope: 'all'|'admin'|'user' } | null = null;

export function setAdminOTPSettings(settings: { firebase_enabled: boolean; sms_fallback_enabled: boolean; role_scope?: 'all'|'admin'|'user' } | null) {
  _adminSettingsCache = settings ? { ...settings, role_scope: settings.role_scope || 'all' } : null;
}

export function getAdminOTPSettings() {
  return _adminSettingsCache;
}

/**
 * Resolve the effective OTP settings combining all sources.
 * URL/storage/env override admin settings (operator escape hatch for QA).
 */
export function resolveOTPSettings(): ResolvedOTPSettings {
  const env = detectEnv();
  const url = readUrlParam();
  const stor = readStorage();
  const envv = readEnv();
  const admin = _adminSettingsCache;

  if (url) return {
    mode: url, source: 'url', environment: env,
    firebase_enabled: url === 'firebase-only' || (admin?.firebase_enabled ?? true),
    sms_fallback_enabled: url === 'fallback' && (admin?.sms_fallback_enabled ?? true),
    role_scope: admin?.role_scope ?? 'all',
  };
  if (stor) return {
    mode: stor, source: 'storage', environment: env,
    firebase_enabled: stor === 'firebase-only' || (admin?.firebase_enabled ?? true),
    sms_fallback_enabled: stor === 'fallback' && (admin?.sms_fallback_enabled ?? true),
    role_scope: admin?.role_scope ?? 'all',
  };
  if (envv) return {
    mode: envv, source: 'env', environment: env,
    firebase_enabled: envv === 'firebase-only' || (admin?.firebase_enabled ?? true),
    sms_fallback_enabled: envv === 'fallback' && (admin?.sms_fallback_enabled ?? true),
    role_scope: admin?.role_scope ?? 'all',
  };
  if (admin) {
    const mode: OTPMode = admin.sms_fallback_enabled ? 'fallback' : 'firebase-only';
    return {
      mode, source: 'admin', environment: env,
      firebase_enabled: admin.firebase_enabled,
      sms_fallback_enabled: admin.sms_fallback_enabled,
      role_scope: admin.role_scope,
    };
  }
  return {
    mode: 'fallback', source: 'default', environment: env,
    firebase_enabled: true, sms_fallback_enabled: true, role_scope: 'all',
  };
}
