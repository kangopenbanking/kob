

# Netlify Deployment Readiness — Audit & Plan

## Framework & Build Details

| Item | Value |
|---|---|
| Framework | React 18 + Vite 5 + TypeScript |
| Package manager | npm |
| Build command | `npm run build` (runs `vite build`) |
| Output directory | `dist` |
| Frontend location | Repo root (no subfolder) |
| App type | SPA (React Router, client-side routing) |

---

## 1. Create `netlify.toml`

A new file at the repo root with:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

No `base` directive needed — frontend is at root. The SPA redirect ensures all React Router paths (350+ routes) resolve correctly on direct URL visits.

---

## 2. Required Environment Variables on Netlify

Set these in **Netlify > Site settings > Environment variables**:

| Variable | Value | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://wdzkzeahdtxlynetndqw.supabase.co` | Backend API base — used by ~14 files for edge function calls |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(the anon key)* | Auth + API calls |
| `VITE_SUPABASE_PROJECT_ID` | `wdzkzeahdtxlynetndqw` | Referenced in env |
| `VITE_FIREBASE_API_KEY` | *(current value)* | Phone auth via Firebase |
| `VITE_FIREBASE_PROJECT_ID` | `kang-open-banking-5e1e2` | Firebase config |
| `VITE_STRIPE_PUBLIC_KEY` | *(if set)* | Optional — Stripe card payments |

All are `VITE_` prefixed, so Vite will inline them at build time. No runtime env injection needed.

---

## 3. URL & Callback Audit — No Code Changes Needed

| Category | Status | Detail |
|---|---|---|
| API base URLs | **OK** | All edge function calls use `import.meta.env.VITE_SUPABASE_URL` — will resolve correctly with the same env var on Netlify |
| Canonical URLs | **OK** | `src/config/api.ts` hardcodes `https://kangopenbanking.com` — independent of hosting |
| Auth callbacks | **OK** | `window.location.origin` used for email redirects — will automatically use the Netlify domain |
| Firebase authDomain | **OK** | Hardcoded to `kangopenbanking.com` in `src/lib/firebase.ts` |
| Storage/asset URLs | **OK** | Public assets use relative paths (`/kob-logo.png`) — served from Netlify |
| PWA manifest | **OK** | `start_url: "/app"` is relative — works on any domain |

### Domain/Callback Change Needed (Post-Deploy)

If deploying to a **new domain** (not `kangopenbanking.com`):
- Add the Netlify domain to **Firebase Authorized Domains** for phone auth
- Add the Netlify domain to the backend auth provider's **Redirect URL allowlist**
- Update `authDomain` in `src/lib/firebase.ts` if not using `kangopenbanking.com`

If pointing `kangopenbanking.com` DNS to Netlify, no changes needed.

---

## 4. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| CORS on edge functions | LOW | Edge functions already set CORS headers via `_shared/cors.ts`. If the Netlify domain differs from current allowed origins, verify CORS allows it. |
| OneSignal push notifications | LOW | `index.html` has OneSignal SDK hardcoded — will work if the Netlify domain matches the OneSignal app config. |
| PWA service worker caching | LOW | `vite-plugin-pwa` generates a service worker. On Netlify, ensure the SW scope and caching strategy work. The `navigateFallbackDenylist` for `/~oauth` is Lovable-specific and harmless. |
| Large bundle / build timeout | MEDIUM | ~450 lazy-loaded pages may produce a long build. Netlify free tier has a 15-min build limit — should be fine but monitor first build. |

---

## 5. Recommended Deployment Steps

1. **Create `netlify.toml`** at repo root (as shown above)
2. **Connect repo to Netlify** via GitHub
3. **Set all 5-6 env vars** in Netlify dashboard
4. **Trigger first build** and verify it completes
5. **Test**: Visit a deep route directly (e.g., `/developer/api-explorer`) — should load correctly via the SPA redirect
6. **Custom domain**: If using `kangopenbanking.com`, update DNS to point to Netlify and add it in Netlify domain settings
7. **Firebase**: Add the Netlify domain to Firebase console > Authentication > Authorized domains
8. **Backend**: No changes — all edge functions, database, auth, and storage remain on Lovable Cloud

---

## Summary

The frontend is fully self-contained and ready for Netlify deployment. The only file to create is `netlify.toml`. No backend code, edge functions, database logic, or auth provider code needs to change. All API calls already use environment variables that can be configured identically on Netlify.

