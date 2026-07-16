# Phase 1B-R1I-a.3 — Nium Runtime Hardening (Local/Test)

**Authorization:** CONDITIONALLY AUTHORIZED — Chief Architect and Phase Guardian
**Scope executed:** Local & test implementation only. No production deployment, no migration, no secret rotation, no SDK publish, no version increment, no gate weakening, no allowlist entry.

## Preconditions (all PASS)

| # | Precondition | Result |
|---|---|---|
| 1 | `rm -rf node_modules` | done |
| 2 | `npm ci` | 1365 pkgs, exit 0 |
| 3 | `npm run build` | exit 0 |
| 4 | 74-test quality-gate suite | 74/74 pass |
| 5 | `package-lock.json` sha256 unchanged | `137def28…c1c7a5` before **and** after |
| 6 | API version | `4.53.1` (unchanged) |
| 7 | Operation count | `484` (unchanged) |

## Files changed

| Path | Nature |
|---|---|
| `supabase/functions/_shared/webhook-replay-protection.ts` | Additive: `computePayloadFingerprint`, `enforceReplayWindow`, `payload_fingerprint` + `stale_retry_after_seconds` args, new `mismatch`/`retried` result fields and reasons. All new args optional → existing callers unaffected. |
| `supabase/functions/nium-webhook/index.ts` | Wires the three controls: (a) ±5 min replay-window on `x-nium-timestamp` / payload.timestamp; (b) SHA-256 body fingerprint passed to inbox check, returns HTTP 409 on mismatch; (c) reserve-then-crash recovery via `markWebhookProcessed` and reclaim of stale (>90 s) unprocessed inbox rows. |
| `supabase/functions/_shared/webhook-replay-protection_test.ts` | Deno unit tests (7): fingerprint determinism, replay-window fresh/stale/invalid/absent, fresh insert, duplicate same body, mutated body → mismatch, stale reclaim, fresh unprocessed still deduped. |
| `src/test/nium-webhook-hardening.test.ts` | Vitest source-level wiring assertions (7) proving the handler imports and uses the new helpers and preserves back-compat on the shared surface. |
| `docs/audits/phase-1/phase-1b-r1i-a3-closeout.md` | This report. |

## Evidence

- **Vitest targeted (Nium + gates + idempotency contract):** 90 / 90 pass.
- **Production OpenAPI quality gates:** `failures: 188` (baseline unchanged; G3 provider-event semantics still 0 failures).
- **Contract hashes (unchanged):**
  - `public/openapi.json` sha256 = `5b5db5d6b67829c130aa8f7e0883dd666ebf69eb60b7d7cab574909f0f0e5305`
  - `package-lock.json` sha256 = `137def28331ad1d9d993edb955521182e229fe674817f33bad799e0994d1c7a5`
- **Lint (touched files):** 0 errors / 0 warnings.
- **Build:** `npm run build` PASS in preconditions.

## Controls implemented

1. **Changed-payload fingerprint protection** — Handler computes SHA-256 of the raw body and passes it into `checkAndRegisterWebhook`. When the stored payload for the same `(source, event_id)` differs, the helper returns `mismatch: true` and the handler responds **HTTP 409 `payload_fingerprint_mismatch`**, auditing the rejection. Prior valid duplicates continue to return 200 unchanged.
2. **Replay-window enforcement** — `enforceReplayWindow(ts, 300 s)` accepts either seconds or milliseconds; absent timestamps remain tolerated for back-compat. Skew > 5 min or non-numeric values return 401 with `outside_replay_window` / `invalid_timestamp`.
3. **Reserve-then-crash recovery** — Inbox rows still in-flight (`is_processed = false`) that are older than `stale_retry_after_seconds` (default 90 s) are reclaimed for reprocessing (`retried: true, reason: "stale_retry_reclaimed"`). On successful ACK the handler now calls `markWebhookProcessed` via a microtask so downstream branches keep their early returns.

## Back-compat & safety

- All new helper args are optional; every other caller of `checkAndRegisterWebhook` in the repo continues to compile and behave identically (verified: `stripe`, `paypal`, `flutterwave`, `kora`, generic webhook receivers do not pass the new args).
- No DB migration required. `payload` is already stored in `webhook_inbox`; fingerprint comparison uses that column in-process.
- No spec change in this slice. A truthful OpenAPI addition (documenting `x-nium-timestamp` and the 409 response) is deferred to a subsequent slice that carries the required `4.53.1 → 4.53.2` patch bump under a separate authorization.

## Rollback

1. Revert the two source files (`webhook-replay-protection.ts`, `nium-webhook/index.ts`) to the pre-slice commit.
2. Delete `supabase/functions/_shared/webhook-replay-protection_test.ts` and `src/test/nium-webhook-hardening.test.ts`.
3. Re-run the 74-test gate harness to confirm baseline; no DB changes to undo.

## Final authorization statement

**AUTHORIZED FOR LOCAL/TEST ONLY — PRODUCTION PROHIBITED**
Authorising role: Chief Architect and Phase Guardian.
Scope: Nium runtime hardening (fingerprint, replay-window, reserve-then-crash recovery) and tests in local + test environments. Production deployment, migration, secret rotation, SDK publish, and version increment remain prohibited under this authorization.
