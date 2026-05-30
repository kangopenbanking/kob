/**
 * Lightweight idempotency wrapper for internal remittance endpoints
 * (routing-engine, fulfill). Uses the shared `integration_idempotency_keys`
 * table and the proven reserve/store helpers.
 *
 * For routing/fulfill the natural key is the remittance UUID itself —
 * a v4 from `gen_random_uuid()` that is unique per business operation.
 * Callers may override with an explicit `Idempotency-Key` header.
 */
import {
  reserveIdempotency,
  storeIdempotency,
  idempotencyResponse,
  sha256,
  validateIdempotencyKey,
} from "./integration-layer/idempotency.ts";

export interface RemittanceIdemOptions {
  resource: string;           // e.g. "remittance.fulfill"
  defaultKey: string;         // remittance_id UUID v4
  headerKey?: string | null;  // optional client-supplied Idempotency-Key
  payload: unknown;           // body for hash comparison
  corsHeaders?: Record<string, string>;
}

export type RemittanceIdemContext =
  | { proceed: true; key: string; commit: (status: number, body: unknown) => Promise<void> }
  | { proceed: false; response: Response };

export async function withRemittanceIdempotency(
  opts: RemittanceIdemOptions,
): Promise<RemittanceIdemContext> {
  const cors = opts.corsHeaders ?? {};
  const key = (opts.headerKey && opts.headerKey.trim()) || opts.defaultKey;

  // Validate format (UUID v4 ≤255). Both defaults and header keys must pass.
  const invalid = validateIdempotencyKey(key);
  if (invalid) {
    const resp = idempotencyResponse(invalid, cors)!;
    return { proceed: false, response: resp };
  }

  const requestHash = await sha256(JSON.stringify(opts.payload ?? {}));
  const result = await reserveIdempotency({
    key,
    merchantId: null,
    resource: opts.resource,
    requestHash,
  });

  if (result.kind !== "miss") {
    const resp = idempotencyResponse(result, cors);
    if (resp) return { proceed: false, response: resp };
  }

  return {
    proceed: true,
    key,
    commit: async (status: number, body: unknown) => {
      await storeIdempotency({
        key,
        merchantId: null,
        resource: opts.resource,
        requestHash,
        status,
        body: body as Record<string, unknown>,
      });
    },
  };
}
