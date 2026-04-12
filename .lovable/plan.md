

## Plan: Deepen Developer Documentation to Stripe/Mangopay Standard

### Current State Assessment

The audit criticisms are **mostly outdated**. The portal already has:
- Getting Started with 6-language code examples (cURL, Node.js, Python, PHP, Go, Java)
- Authentication page with OAuth 2.0 + PKCE flow diagram, API key docs, mTLS section, scopes table
- Token Lifecycle guide with rotation, reuse detection, and lifetimes
- Roles and Permissions page with RBAC model
- SDKs page (746 lines) covering 5 languages with auth, charges, webhooks, AISP examples
- 10 real-world integration guides with Mermaid sequence diagrams
- Error Codes Reference with RFC 7807 format
- Go-Live Checklist with 5 sections
- Bank Onboarding Guide with 7-step flow
- Rate Limits guide, Idempotency guide, Webhook Retry guide

**What is genuinely missing** (depth gaps vs. Stripe/Mangopay standard):

1. **No end-to-end lifecycle examples with failure/retry/reversal paths** -- existing guides show the happy path only
2. **Error codes page is shallow** -- lists ~18 errors but the OpenAPI spec defines 60+; no recovery instructions per error
3. **No "Build X Use Case" guides** -- e.g., "Build a Marketplace Checkout", "Build a Bank Data Aggregator"
4. **No Production Checklist with observability** -- Go-Live exists but lacks monitoring/alerting setup
5. **Authentication page lacks token lifecycle link** -- TokenLifecycleGuide exists but is not linked from AuthenticationOverview

### Changes

#### 1. Enhance Error Codes Reference with full catalogue + recovery actions
**File:** `src/pages/developer/ErrorCodesReference.tsx`
- Expand from 18 to 60+ error codes matching the OpenAPI spec catalogue (AUTH_, PAY_, PISP_, AISP_, LED_, MM_, FLW_, KYC_, CERT_, LOAN_, SAV_, ADM_, WH_)
- Add a "Recovery Action" column to every error with specific developer guidance
- Add retry/backoff code example for 429 and 5xx errors
- Add "Common Mistakes" section with solutions

#### 2. Add failure/retry/reversal sections to the top 3 real-world examples
**Files:** `docs/examples/02-accept-payments-create-charge.md`, `docs/examples/05-payouts-single-bulk-paypal.md`, `docs/examples/04-refunds.md`
- Add "Handling Failures" section with timeout, decline, and provider-unavailable scenarios
- Add retry logic code example (exponential backoff with idempotency)
- Add reversal/cancellation flow for each
- Add "Edge Cases" section (duplicate charge, partial failure in bulk payout, refund on disputed charge)

#### 3. Create two "Build X" use-case guides
**New files:** `docs/examples/11-build-marketplace-checkout.md`, `docs/examples/12-build-bank-data-aggregator.md`
- Marketplace guide: charge + split payment + payout + webhook + settlement reconciliation (end-to-end)
- Bank aggregator guide: OAuth consent + AISP account fetch + transaction sync + token refresh (end-to-end)
- Both include failure handling, retry logic, and production considerations
- Register in `RealWorldExamples.tsx` and `RealWorldExampleDetail.tsx`

#### 4. Enhance Authentication page with cross-links and role-based guidance
**File:** `src/pages/developer/AuthenticationOverview.tsx`
- Add "Which method do I need?" decision table (Merchant = API Key, TPP = OAuth, Bank = mTLS)
- Add link to Token Lifecycle guide
- Add link to Roles & Permissions page

#### 5. Add observability/monitoring section to Go-Live Checklist
**File:** `src/pages/developer/GoLiveChecklist.tsx`
- Add "Observability Setup" section with: request logging, webhook monitoring, latency tracking, error rate alerting
- Add code example for structured logging of API responses

### Files Summary

| Action | File |
|--------|------|
| Modify | `src/pages/developer/ErrorCodesReference.tsx` -- expand to 60+ errors with recovery actions |
| Modify | `docs/examples/02-accept-payments-create-charge.md` -- add failure/retry/edge cases |
| Modify | `docs/examples/04-refunds.md` -- add failure/edge cases |
| Modify | `docs/examples/05-payouts-single-bulk-paypal.md` -- add failure/retry/edge cases |
| Create | `docs/examples/11-build-marketplace-checkout.md` -- end-to-end use case |
| Create | `docs/examples/12-build-bank-data-aggregator.md` -- end-to-end use case |
| Modify | `src/pages/developer/RealWorldExamples.tsx` -- add 2 new guide entries |
| Modify | `src/pages/developer/RealWorldExampleDetail.tsx` -- register 2 new slugs |
| Modify | `src/pages/developer/AuthenticationOverview.tsx` -- add decision table + cross-links |
| Modify | `src/pages/developer/GoLiveChecklist.tsx` -- add observability section |

