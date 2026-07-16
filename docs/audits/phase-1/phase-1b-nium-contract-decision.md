# Phase 1B-R1I-a.1 — Nium Webhook Contract Decision

## Decision

**Model A — Provider-event idempotency.**

## Rationale (evidence-based)

1. The Nium handler **does not read** an inbound `Idempotency-Key` header. The only occurrence in the file is the *outbound* header sent to `gateway-create-payout` at `supabase/functions/nium-webhook/index.ts:279`. `rg 'Idempotency-Key' supabase/functions/nium-webhook/` confirms.
2. Provider event-ID deduplication **is** authoritative: `(source='nium', event_id)` is enforced by a `UNIQUE` index on `public.webhook_inbox` (migration `20260216212726…sql:314–325`) and the handler invokes `checkAndRegisterWebhook` **before** any domain mutation (`index.ts:74`).
3. Signature verification is the mandatory integrity boundary: HMAC-SHA256 hex over the raw body plus a static shared-secret compare, both timing-safe (`_shared/nium-client.ts:226–271`). Verification happens before parse and before any DB write (`index.ts:48→56`).
4. Nium never sends a generic `Idempotency-Key`. Advertising it as an optional parameter on `niumIncomingWebhook` misleads SDK generators and developer docs, and provides no runtime protection.
5. Removing the header from this single operation is truthful and does not weaken G3 for any other operation, provided the gate exemption is gated on machine-readable metadata (see §5).

## Rejected: Model B — provider-event plus optional generic `Idempotency-Key`

Rejected because:
- The middleware to honour a generic header on this Edge Function does not exist (`OPTIONAL_BUT_IGNORED`).
- Adding such middleware would introduce two competing dedup mechanisms with different TTLs and storage backends (`webhook_inbox` vs `integration_idempotency_keys`) and no reconciliation logic. This is a real correctness risk, not a paper one.
- Retaining an ignored optional header solely to satisfy G3 is exactly what §7.2/7.3 of the Phase 1B-R1I-a directive forbids.

## Contract-decision table

| Item | Before (4.53.1 as-is) | After (proposed a.3) | Evidence |
|---|---|---|---|
| Generic `Idempotency-Key` header | `$ref IdempotencyKeyHeader` (optional) | **removed from `niumIncomingWebhook` only** | `openapi.json` for niumIncomingWebhook.parameters[1] |
| Provider event ID | prose (`Idempotent on transactionId`) | machine-readable + prose | `x-kob-idempotency.event-id-required: true` |
| Signature requirement | required header `x-nium-signature` | unchanged + machine-readable marker | `x-kob-idempotency.signature-required: true` |
| Replay window | undocumented | acknowledged gap; **not** claimed enforced until runtime added in a future slice | `x-kob-idempotency.replay-window-enforced: false` (honest) |
| OpenAPI extension | none | `x-kob-idempotency: { mode: provider-event, provider: nium, event-id-required: true, signature-required: true, replay-window-enforced: false, receiver: webhook }` | new extension block |
| Runtime behaviour | unchanged | unchanged | source unchanged in a.1 |

Note on `replay-window-enforced`: setting the marker to `false` is deliberate. The truthful contract must not claim replay-window enforcement the runtime does not provide. This means the G3 provider-webhook exemption in a.2 **must not** require `replay-window-enforced === true` — it must instead require the marker to be *present and machine-readable*, with `event-id-required` and `signature-required` as the mandatory truth conditions. Adding replay-window enforcement is a separate, in-runtime remediation.

If the Guardian prefers a strict exemption requiring all three markers to be `true`, then this operation stays G3-non-exempt and its 4x G3 debt returns; a.2 must be planned accordingly.

## Required a.2 work (gate script + fixtures)

- Introduce recognition of `x-kob-idempotency` on operations in `scripts/openapi-quality-gates.mjs`.
- Exempt an operation from G3 only when **all** of: `mode === 'provider-event'`, `event-id-required === true`, `signature-required === true`, `receiver === 'webhook'`, and the operation carries a required signature header parameter.
- Add positive fixture (valid provider webhook with full markers → no G3).
- Add negative fixtures (path contains `/webhook`, opId contains `Webhook`, tag `Webhooks`, partial metadata, invalid mode, misspelled extension, metadata in description text only) — each must still fail G3.
- Retain existing positive/negative G3 fixtures for ordinary mutations.
- Prove that the exemption does not suppress G2, G5, G6, G9.

## Required a.3 work (contract + tests + docs)

- Surgical edit of `public/openapi.json` and `public/openapi.yaml`: remove the `IdempotencyKeyHeader` `$ref` **only** from `niumIncomingWebhook.parameters`; add the `x-kob-idempotency` extension block.
- Do not touch operation count, method, path, operationId, version.
- Add handler-boundary tests (raw-body preservation, changed-payload behaviour proof, mutation-count DB assertion, missing eventId behaviour, cross-provider isolation).
- Update developer docs for the Nium webhook page to describe: signature model, event-ID dedup, no-generic-header, safe-retry behaviour, and the known replay-window gap (honestly documented).

## Compatibility impact

- Removal of an **optional** parameter from a single operation is a permissive change in the additive-first sense: no client sending the header will fail (Nium never sent it); no SDK method signature is renamed. Under Standing Orders §1 (The Lock) this is a parameter *removal* from an operation and therefore triggers Guardian review for the a.3 slice.
- The Standing Orders §6 (Version Gate) treatment: the containing 4.53.1 candidate is Unreleased. This correction is a within-candidate honesty fix, not a post-release removal. No further version increment is required.

## Rollback impact

- Revert a.3 diff (single OpenAPI edit + one extension block) → restores prior contract exactly.
- No runtime, DB, dependency, or SDK artifact changes accompany a.1.
