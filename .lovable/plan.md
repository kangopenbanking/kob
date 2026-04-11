

## Plan: Permanent Fix Package -- Developer Portal, Spec, and Monitoring

### Problem Summary
Based on codebase analysis, the audit report identifies issues that are partially outdated (many fixes already exist). Here is the actual current state and remaining gaps:

**Already Fixed (no work needed):**
- Portal routing: All /developer/* routes exist in App.tsx with real page components (GettingStarted, ApiExplorer, GatewayQuickstart, GatewayWebhooksGuide, RealWorldExamples, Sandbox, Changelog, SDKsPage, etc.)
- Rate limit headers: Already defined in OpenAPI spec components (X-RateLimit-* headers, 429 TooManyRequests response, RateLimitError schema)
- Status page: /developer/status exists with ApiStatusPage component
- Developer registration: /developer/register exists with DeveloperRegistration component
- Sitemap, robots.txt: Already exist in /public
- CORS headers: Already configured in public/_headers
- SDKs page: /developer/guides/sdks exists with multi-language tabs

**Actual Remaining Gaps:**

### 1. Changelog version desync (spec 4.9.5, changelog 4.9.4)
- Update `public/changelog.json` to apiVersion 4.9.5
- Add v4.9.5 entry to changelog.json
- Add v4.9.5 entry to the Changelog.tsx React component

### 2. Sandbox spec missing x-sandbox metadata
- Add `x-sandbox: true` to openapi-sandbox.json info block
- Add `x-test-data` section with test phone numbers and card numbers
- Add `x-scenario` annotations to key payment endpoints

### 3. /developer/sandbox routes partially in PROTECTED_PATHS
- `/developer/sandbox` is listed in PROTECTED_PATHS (line 39 of PublicDeveloperLayout.tsx), but it redirects to `/developer/sandbox/overview` which is NOT protected
- The redirect itself works, but `/developer/sandbox` should be removed from PROTECTED_PATHS since the sandbox overview must be public per ORDER P3
- Also remove sandbox sub-paths that should be public (overview, test-cards, mobile-money, credentials)

### 4. Missing webhook event types
- Add 8 new event types to the WebhookEventPayload enum in openapi.json and openapi-sandbox.json:
  `onboarding_application.approved`, `onboarding_application.rejected`, `merchant_kyb.verified`, `merchant_kyb.failed`, `credit_score.updated`, `loan_application.approved`, `loan_application.rejected`, `loan_application.pending_documents`
- Update GatewayWebhooksGuide.tsx event table to include these

### 5. Webhook event filtering documentation
- Add `events` field documentation to the webhook registration section in GatewayWebhooksGuide.tsx
- Show topic-based subscription model with code example

### 6. Split payment documentation gap
- Enhance GatewaySplitPaymentsGuide.tsx with worked marketplace example
- Add percentage vs fixed_amount split types
- Add settlement timing for split recipients

### 7. /developer/sdks alias route
- The audit expects `/developer/sdks` but the route is at `/developer/guides/sdks`
- Add a redirect: `/developer/sdks` -> `/developer/guides/sdks` (ORDER P2: zero-404)

### 8. /status top-level route
- `/status` exists but renders a general Status page, not the API-specific status page
- Add a prominent link from /status to /developer/status or make /status redirect to /developer/status

### 9. Navigation additions
- Add "SDKs" link to the top nav bar in PublicDeveloperLayout
- Already has: Docs, API Explorer, SDKs, Changelog -- verified present

---

### Files to Modify

| File | Change |
|------|--------|
| `public/changelog.json` | Add v4.9.5 entry, bump apiVersion |
| `public/openapi-sandbox.json` | Add x-sandbox, x-test-data metadata |
| `public/openapi-sandbox.yaml` | Same as above in YAML |
| `public/openapi.json` | Add 8 new webhook event types to enum |
| `public/openapi.yaml` | Same as above in YAML |
| `src/components/developer/PublicDeveloperLayout.tsx` | Remove sandbox paths from PROTECTED_PATHS |
| `src/pages/developer/Changelog.tsx` | Add v4.9.5 release entry |
| `src/pages/developer/GatewayWebhooksGuide.tsx` | Add event filtering docs + 8 new event types |
| `src/pages/developer/GatewaySplitPaymentsGuide.tsx` | Add marketplace worked example |
| `src/App.tsx` | Add /developer/sdks redirect to /developer/guides/sdks |

### Version Bump
Spec version stays at 4.9.5 (already current). Changelog syncs to match.

### Standing Order Compliance
- All changes are additive (ORDER 4 -- Surgeon Rule)
- No operationIds renamed or removed (ORDER 1 -- The Lock)
- Enum values only added, never removed (ORDER 2 -- The Ratchet)
- Justification: RFC 6585 (rate limits), FAPI 1.0 ADV (ORDER 3)

