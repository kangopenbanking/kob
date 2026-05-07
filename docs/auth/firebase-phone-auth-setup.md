# Firebase Phone Auth + reCAPTCHA v2 Invisible — Setup Checklist

Use this checklist EVERY time you set up (or move) Firebase Phone Auth for a Kang Open Banking environment. Missing any one of these steps produces opaque errors like `auth/captcha-check-failed`, `auth/invalid-app-credential`, or `auth/unauthorized-domain`.

> **Important — we use reCAPTCHA v2 Invisible, NOT reCAPTCHA Enterprise.**
> The Firebase Web SDK auto-uses **reCAPTCHA v2 Invisible** when no
> Enterprise site key is registered for the project. v2 Invisible is free,
> requires no GCP key allowlist, and only needs the runtime hostname to be
> in Firebase's **Authorized domains** list.

---

## 1. Confirm the active Google Cloud project

- [ ] Open https://console.cloud.google.com and pick the project from the top selector.
- [ ] Verify the **Project ID** matches `VITE_FIREBASE_PROJECT_ID` in this app's `.env`.
- [ ] Verify the same project is selected in https://console.firebase.google.com.

## 2. Confirm billing (Blaze plan)

- [ ] Firebase Console → ⚙️ → **Usage and billing** → Plan must be **Blaze**.
- [ ] Cloud Console → **Billing** → confirm a billing account is **active**.
- Phone Auth SMS requires Blaze. (reCAPTCHA v2 Invisible itself is free.)

## 3. Enable required Google Cloud APIs

In Cloud Console → **APIs & Services → Enabled APIs & services**, enable:

- [ ] **Identity Toolkit API** (`identitytoolkit.googleapis.com`)
- [ ] **Firebase Authentication API** (`firebaseauth.googleapis.com`)
- [ ] **Token Service API** (`securetoken.googleapis.com`)

You do **NOT** need to enable `recaptchaenterprise.googleapis.com` for v2 Invisible.

## 4. Disable / unregister reCAPTCHA Enterprise (if previously set)

If a previous setup pasted an Enterprise site key into Firebase Auth:

- [ ] Firebase Console → **Authentication → Settings → reCAPTCHA Enterprise** → **Unlink** / clear the site key. Save.
- [ ] (Optional) Cloud Console → **Security → reCAPTCHA Enterprise** → delete or leave the unused key — it will no longer be referenced by Firebase Auth.

After this step, the next call to `signInWithPhoneNumber` will use **reCAPTCHA v2 Invisible** automatically.

## 5. Enable Phone provider

- [ ] Firebase Console → **Authentication → Sign-in method** → **Phone** → **Enable**.
- [ ] (Recommended) Add a few **Phone numbers for testing** to avoid burning SMS quota in QA.

## 6. Authorized domains (the only domain list that matters for v2 Invisible)

Add EVERY hostname the app runs on to:

- [ ] **Firebase Console → Authentication → Settings → Authorized domains**

| Environment | Hostname |
|---|---|
| Development | `localhost` |
| Development | `127.0.0.1` |
| Preview | `id-preview--342820e7-280a-44d3-88ce-2854c6d907ed.lovable.app` |
| Preview | `342820e7-280a-44d3-88ce-2854c6d907ed.lovableproject.com` |
| Production | `kob.lovable.app` |
| Production | `info.kangfintechsolutions.com` |
| Production | `kangopenbanking.com` |

When you add a new custom domain, also update `FIREBASE_AUTHORIZED_DOMAINS` in `src/lib/firebase.ts` so the in-app pre-flight check stays accurate.

## 7. App credentials

- [ ] `VITE_FIREBASE_API_KEY` — Web API key (Firebase Console → Project Settings → General → Web app).
- [ ] `VITE_FIREBASE_PROJECT_ID` — same as Cloud project ID.
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` — defaults to `kangopenbanking.com`; override only if Firebase Hosting domain differs.

## 8. Edge-function secrets (Lovable Cloud → Secrets)

Required for the Firebase ID token verification step in `firebase-phone-verify`:

- [ ] `FIREBASE_API_KEY`
- [ ] `FIREBASE_PROJECT_ID`

For the Vonage SMS fallback path:

- [ ] `VONAGE_API_KEY`
- [ ] `VONAGE_API_SECRET`

## 9. Smoke test

- [ ] Open the auth page in each environment and request an OTP for a real phone.
- [ ] You should see **no visible reCAPTCHA challenge** (v2 Invisible runs silently). If a checkbox or image puzzle appears, Firebase has degraded — see §10.
- [ ] Verify no `auth/captcha-check-failed`, `unauthorized-domain`, or `503` in the console.
- [ ] If Firebase fails, the app auto-falls back to Vonage SMS — confirm a code arrives within 30s.
- [ ] Verify the OTP and confirm the user lands on `/dashboard`.

## 10. When something breaks — error → root cause map

| Error code / message | Root cause | Fix |
|---|---|---|
| `auth/unauthorized-domain` | Hostname missing from Firebase Authorized domains | §6 |
| Visible v2 checkbox / image challenge | Bot-suspicion fallback OR Enterprise key still registered | §4, then retry |
| `auth/captcha-check-failed`, `auth/missing-app-credential`, `auth/invalid-app-credential` | Stale Enterprise key still bound, or Authorized domains missing | §4 + §6 |
| `auth/billing-not-enabled` | Blaze not active | §2 |
| `auth/operation-not-allowed` | Phone provider disabled | §5 |
| `503 / auth/internal-error` | Identity Toolkit API not enabled or quota exceeded | §3 |
| `auth/quota-exceeded`, `auth/too-many-requests` | Per-number throttle (legitimate) — wait or use a test number | §5 |

---

The app's `mapFirebaseAuthError` (`src/lib/firebaseErrors.ts`) maps each of these to a user-facing message and decides whether to auto-fallback to Vonage SMS.
