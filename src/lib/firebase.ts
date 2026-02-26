import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'kangopenbanking.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
};

const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID.');
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

export { isFirebaseConfigured };

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
