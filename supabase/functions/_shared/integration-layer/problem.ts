// RFC 7807 Problem Details response helper.
// Standing Order #3 citation: RFC 7807 §3.1 (Members of a Problem Details Object).
//
// Usage:
//   import { problemResponse } from "../_shared/integration-layer/problem.ts";
//   return problemResponse(req, 409, "Idempotency Key Conflict",
//     "The provided Idempotency-Key was previously used with a different request body.",
//     { type: "https://api.kangopenbanking.com/errors/idempotency-key-reused", error_id });
//
// Content negotiation: when the caller sends `Accept: application/problem+json`,
// or always for 4xx/5xx, the response is `application/problem+json` per RFC 7807.

import { corsHeaders } from "../cors.ts";

export interface ProblemOptions {
  /** Absolute URI identifying the problem type. Defaults to about:blank. */
  type?: string;
  /** Optional URI for the specific instance of the problem. */
  instance?: string;
  /** Trace id surfaced to support. */
  error_id?: string;
  /** RFC 7807 §3.2 allows additional members; merged into the response root. */
  extensions?: Record<string, unknown>;
  /** Extra headers to merge (cors + content-type already set). */
  headers?: Record<string, string>;
}

export function problemResponse(
  reqOrAccept: Request | string | null,
  status: number,
  title: string,
  detail: string,
  opts: ProblemOptions = {},
): Response {
  const accept = typeof reqOrAccept === "string"
    ? reqOrAccept
    : reqOrAccept?.headers?.get?.("Accept") ?? "";

  const body: Record<string, unknown> = {
    type: opts.type ?? "about:blank",
    title,
    status,
    detail,
    timestamp: new Date().toISOString(),
    ...(opts.instance ? { instance: opts.instance } : {}),
    ...(opts.error_id ? { error_id: opts.error_id } : {}),
    ...(opts.extensions ?? {}),
  };

  // Always emit application/problem+json for 4xx/5xx (Stripe convention + RFC 7807 default).
  // Legacy clients sending `Accept: application/json` still get a parseable JSON body;
  // only the content-type header differs.
  const wantsProblem = !accept || accept.includes("application/problem+json") || accept.includes("*/*") || status >= 400;
  const contentType = wantsProblem ? "application/problem+json" : "application/json";

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...(opts.headers ?? {}),
      "Content-Type": contentType,
    },
  });
}
