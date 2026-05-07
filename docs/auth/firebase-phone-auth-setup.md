# Firebase Phone Auth + reCAPTCHA Enterprise — Setup Checklist

Use this checklist EVERY time you set up (or move) Firebase Phone Auth for a Kang Open Banking environment. Missing any one of these steps produces opaque errors like `auth/error-code:-39`, `503`, or `auth/captcha-check-failed`.

---

## 1. Confirm the active Google Cloud project

- [ ] Open https://console.cloud.google.com and pick the project from the top selector.
- [ ] Verify the **Project ID** matches `VITE_FIREBASE_PROJECT_ID` in this app's `.env`.
- [ ] Verify the same project is selected in https://console.firebase.google.com (Firebase and Cloud share the same project).

## 2. Confirm billing (Blaze plan)

- [ ] Firebase Console → ⚙️ → **Usage and billing** → Plan must be **Blaze**.
- [ ] Cloud Console → **Billing** → confirm a billing account is **active** (not in grace period).
- Phone Auth SMS and reCAPTCHA Enterprise both REQUIRE Blaze.

## 3. Enable required Google Cloud APIs

In Cloud Console → **APIs & Services → Enabled APIs & services → + ENABLE APIS AND SERVICES**, enable:

- [ ] **Identity Toolkit API** (`identitytoolkit.googleapis.com`)
- [ ] **reCAPTCHA Enterprise API** (`recaptchaenterprise.googleapis.com`)
- [ ] **Firebase Authentication API** (`firebaseauth.googleapis.com`)
- [ ] **Token Service API** (`securetoken.googleapis.com`)

## 4. Configure reCAPTCHA Enterprise

- [ ] Cloud Console → **Security → reCAPTCHA Enterprise** → **Create key**.
- [ ] Type: **Website**.
- [ ] Add ALL hostnames the app runs on (see §6 below — must match Firebase Authorized domains exactly).
- [ ] Uncheck "Use checkbox challenge" (Phone Auth uses invisible).
- [ ] After creation, copy the **Site key** (e.g. `6Lc...`).
- [ ] Firebase Console → **Authentication → Settings → reCAPTCHA Enterprise** → paste the site key and **Save**.

## 5. Enable Phone provider

- [ ] Firebase Console → **Authentication → Sign-in method** → **Phone** → **Enable**.
- [ ] (Optional but recommended) add a few **Phone numbers for testing** so QA can sign in without burning SMS quota.

## 6. Authorized domains — MUST be in sync

Both lists below MUST contain the SAME set of hostnames. Mismatch is the #1 cause of `auth/unauthorized-domain` and `auth/captcha-check-failed`.

| Environment | Hostname |
|---|---|
| Development | `localhost` |
| Development | `127.0.0.1` |
| Preview | `id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app` |
| Preview | `342820e7-280a-44d3-88ce-2854c6d907ed.lovableproject.com` |
| Production | `kob.lovable.app` |
| Production | `info.kangfintechsolutions.com` |
| Production | `kangopenbanking.com` |

Add all of them to BOTH:

- [ ] **Firebase Console → Authentication → Settings → Authorized domains**
- [ ] **Cloud Console → reCAPTCHA Enterprise → \<your key\> → Domains**

When you add a new custom domain, update `FIREBASE_AUTHORIZED_DOMAINS` in `src/lib/firebase.ts` so the in-app pre-flight check stays accurate.

## 7. App credentials

In the Lovable project (or `.env` for local):

- [ ] `VITE_FIREBASE_API_KEY` — Web API key (Firebase Console → Project Settings → General → Web app config).
- [ ] `VITE_FIREBASE_PROJECT_ID` — same as Cloud project ID.
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` — defaults to `kangopenbanking.com`; override only if Firebase Hosting domain differs.

## 8. Edge-function secrets (Lovable Cloud → Secrets)

Required for the Firebase ID token verification step in `firebase-phone-verify`:

- [ ] `FIREBASE_API_KEY` — same value as `VITE_FIREBASE_API_KEY`.
- [ ] `FIREBASE_PROJECT_ID` — same value as `VITE_FIREBASE_PROJECT_ID`.

For the Vonage SMS fallback path:

- [ ] `VONAGE_API_KEY`
- [ ] `VONAGE_API_SECRET`

## 9. Smoke test

- [ ] In each environment, open the auth page and request an OTP for a real phone.
- [ ] Watch the browser console — you should see no `auth/captcha-check-failed`, no `503`, no `unauthorized-domain`.
- [ ] If Firebase fails, the app auto-falls back to Vonage SMS — verify a code arrives within 30s.
- [ ] Verify the OTP and confirm the user lands on `/dashboard` (or the role-correct route).

## 10. When something breaks — error → root cause map

| Error code / message | Root cause | Fix |
|---|---|---|
| `auth/unauthorized-domain` | Hostname missing from Firebase Authorized domains | §6 |
| `auth/captcha-check-failed`, `auth/missing-app-credential`, `error-code:-39` | reCAPTCHA Enterprise key missing, wrong, or hostname not in key allowlist | §4, §6 |
| `auth/billing-not-enabled` | Blaze not active | §2 |
| `auth/operation-not-allowed` | Phone provider disabled | §5 |
| `503 / auth/internal-error` | Identity Toolkit API not enabled or quota exceeded | §3 |
| `auth/quota-exceeded`, `auth/too-many-requests` | Per-number throttle (legitimate) — wait or use a test number | §5 |

---

The app's `mapFirebaseAuthError` (`src/lib/firebaseErrors.ts`) maps each of these to a user-facing message and decides whether to auto-fallback to Vonage SMS.
