Plan to fix the 12 retired endpoints in the live developer spec:

1. Update the live spec-serving backend function
   - Set the public spec function API version to `4.29.2` so `public-api-spec` no longer serves `4.29.1` or older metadata.
   - Keep the current local static specs at `public/openapi.json` and `public/openapi-sandbox.json` aligned at `4.29.2`.

2. Enforce the 12 retired endpoint contract in the runtime-generated OpenAPI spec
   - For each of the 12 endpoints:
     - Remove the advertised `200` success response.
     - Advertise only `410 Gone` for the retired operation.
     - Add/retain `deprecated: true`.
     - Add/retain `x-retired: true`.
     - Add `x-replacement-endpoint` with the correct replacement from the fix table.
     - Retain `x-successor` as a compatibility alias for existing internal tests and tooling.
     - Add `Sunset`, `Link`, and `Deprecation` headers on the `410` response.
     - Return RFC 7807 `application/problem+json` response examples.
   - Correct the three SWIFT MT endpoints to use the required `2025-11-22` sunset date, while the remaining nine keep `2026-01-01`.

3. Harden the patch script and regression tests
   - Update `scripts/apply-v4.29.0-fixes.mjs` so future regeneration also writes `x-replacement-endpoint` and preserves the correct SWIFT sunset dates.
   - Strengthen `src/test/v4.29.0-audit-remediation.test.ts` to assert:
     - No retired endpoint has a `200` response.
     - Every retired endpoint has a `410` response.
     - Every retired endpoint has the exact `x-replacement-endpoint` from the fix table.
     - SWIFT MT endpoints use `2025-11-22`; the other nine use `2026-01-01`.

4. Add a deployed/live parity guard
   - Add or update a smoke/parity test for the deployed spec URL so CI can detect when `/openapi.json` or the public spec function serves stale versions or stale retired endpoint metadata.
   - The guard will validate `info.version`, the 12 retired endpoint response maps, and replacement metadata.

5. Deploy and verify
   - Deploy the updated public spec backend function.
   - Re-check the live function URL and the public spec surface after deployment.
   - Confirm all 12 retired endpoints show `410`, no `200`, correct `x-replacement-endpoint`, and correct sunset dates.

No database changes are required.