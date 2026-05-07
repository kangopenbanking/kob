import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, type Auth } from 'firebase/auth';

/**
 * Environment-based Firebase configuration.
 *
 * `authDomain` is the Firebase Hosting domain that handles the reCAPTCHA
 * verification iframe. It must be one of the **Authorized domains** listed
 * in Firebase Console → Authentication → Settings.
 *
 * The runtime origin (window.location.hostname) must ALSO be authorized in
 * Firebase Console — see `docs/auth/firebase-authorized-domains.md` for the
 * full list per environment.
 */
export type AppEnv = 'development' | 'preview' | 'production';

export function detectEnv(): AppEnv {
  if (typeof window === 'undefined') return 'production';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return 'development';
  }
  if (host.includes('id-preview--') || host.endsWith('.lovableproject.com')) {
    return 'preview';
  }
  return 'production';
}

/**
 * Authorized domains per environment. Each MUST be added in
 * Firebase Console → Authentication → Settings → Authorized domains.
 * Update this list when new preview / custom domains are added.
 */
export const FIREBASE_AUTHORIZED_DOMAINS: Record<AppEnv, string[]> = {
  development: ['localhost', '127.0.0.1'],
  preview: [
    'id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app',
    '342820e7-280a-44d3-88ce-2854c6d907ed.lovableproject.com',
  ],
  production: [
    'kob.lovable.app',
    'info.kangfintechsolutions.com',
    'kangopenbanking.com',
  ],
};

const ENV = detectEnv();

// Pick the canonical authDomain per environment. In production we use the
// Firebase-hosted domain (kangopenbanking.com). In dev/preview we still need
// a Firebase-managed authDomain because reCAPTCHA must be served from one.
const AUTH_DOMAIN_BY_ENV: Record<AppEnv, string> = {
  development: 'kangopenbanking.com',
  preview: 'kangopenbanking.com',
  production: 'kangopenbanking.com',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || AUTH_DOMAIN_BY_ENV[ENV],
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
};

export const FIREBASE_ENV = ENV;
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

/**
 * Best-effort runtime check: warn (don't block) if the current hostname is
 * not in the authorized list for this environment. Helps catch new domains
 * that need to be registered in Firebase Console.
 */
export function checkRuntimeDomainAuthorized(): { ok: boolean; host: string; expected: string[] } {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const expected = FIREBASE_AUTHORIZED_DOMAINS[ENV];
  const ok = expected.some((d) => host === d || host.endsWith(`.${d}`));
  if (!ok && typeof console !== 'undefined') {
    console.warn(
      `[firebase] Current host "${host}" is not in the ${ENV} authorized domain list. ` +
      `Add it in Firebase Console → Authentication → Settings → Authorized domains. ` +
      `Expected one of: ${expected.join(', ')}`
    );
  }
  return { ok, host, expected };
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID.');
  }
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp());
  }
  return _auth;
}

// Backwards-compatible export — lazy getter to avoid crash on import
export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getFirebaseAuth() as any)[prop];
  },
});

// Setup invisible reCAPTCHA verifier
export function setupRecaptchaVerifier(containerId: string = 'recaptcha-container'): RecaptchaVerifier {
  const auth = getFirebaseAuth();
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
  });
  return verifier;
}
