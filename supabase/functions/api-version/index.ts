// /v1/version — semantic version metadata for the public API surface
// Public, unauthenticated. Documented response shape:
//   { api_version, build, released_at, supported_versions[], deprecated_versions[], spec_url }
import { corsHeaders } from "../_shared/cors.ts";

const PUBLIC_BASE = "https://api.kangopenbanking.com/v1";
const API_VERSION = "4.18.0";
const BUILD = Deno.env.get("KOB_BUILD_SHA") ?? "dev";
const RELEASED_AT = "2026-04-28T00:00:00Z";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json", "Allow": "GET" },
    });
  }

  const sandbox = req.headers.get("x-sandbox") === "true" ||
    new URL(req.url).searchParams.get("sandbox") === "true";

  const body = {
    api_version: API_VERSION,
    build: BUILD,
    released_at: RELEASED_AT,
    environment: sandbox ? "sandbox" : "production",
    supported_versions: ["v1", "v1.1"],
    deprecated_versions: [],
    spec_url: sandbox ? `${PUBLIC_BASE}/openapi-sandbox.json` : `${PUBLIC_BASE}/openapi.json`,
    docs_url: "https://kangopenbanking.com/developer",
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
});
