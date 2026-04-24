/**
 * Centralized API configuration for Kang Open Banking
 * All API URLs and endpoints should be referenced from here.
 *
 * DIRECT BACKEND MANDATE (PERMANENT — DO NOT CHANGE):
 * All RUNTIME API calls MUST use the direct Supabase Edge Functions URL
 * (API_RUNTIME_BASE_URL below). The branded gateway hostname
 * (api.kangopenbanking.com, served by the Cloudflare Worker in /worker)
 * is exposed for DOCUMENTATION + SDK DEFAULTS only — never for in-app
 * runtime traffic. The direct-backend-guard test (src/test/direct-backend-guard.test.ts)
 * enforces this separation.
 */

/** Single canonical backend base URL — the ONLY source of truth for runtime API access. */
export const API_BACKEND_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/**
 * Branded public gateway hostname — served by the Cloudflare Worker in /worker
 * and proxied to API_BACKEND_BASE. Used in OpenAPI servers[], SDK defaults,
 * and copy-pasteable documentation examples ONLY. Never used for runtime calls.
 */
export const API_PUBLIC_GATEWAY_URL = "https://api.kangopenbanking.com/v1";

export const API_CONFIG = {
  /** Website URL (NOT an API endpoint) */
  SITE_URL: 'https://kangopenbanking.com',
  /** Direct backend base URL for all API calls */
  BASE_URL: API_BACKEND_BASE,
  /** Developer documentation URL (website, not API) */
  DOCS_URL: 'https://kangopenbanking.com/documentation',
  /** API Explorer URL (website, not API) */
  EXPLORER_URL: 'https://kangopenbanking.com/developer/api-explorer',
  /** OpenAPI spec — served from direct backend */
  OPENAPI_SPEC: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api-spec`,
  /** Postman collection — served from direct backend */
  POSTMAN_COLLECTION: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postman-collection`,
  /** Static spec files served from /public — no edge function cold-start */
  OPENAPI_JSON: '/openapi.json',
  OPENAPI_YAML: '/openapi.yaml',
  OPENAPI_SANDBOX_JSON: '/openapi-sandbox.json',
  OPENAPI_SANDBOX_YAML: '/openapi-sandbox.yaml',
} as const;

/**
 * Runtime API base URL — always the direct Supabase Edge Functions backend.
 * PERMANENT: This must never be changed to a custom domain or proxy.
 */
export const API_RUNTIME_BASE_URL = API_BACKEND_BASE;

/**
 * Display-facing API base URL for documentation and code examples.
 * Uses the direct backend URL so examples work immediately for developers.
 */
export const API_EXAMPLE_BASE_URL = API_BACKEND_BASE;

/**
 * Returns a canonical public URL for the given path.
 * Always uses kangopenbanking.com regardless of the current browser origin.
 * NOTE: This is for WEBSITE URLs, not API endpoints.
 */
export const getCanonicalUrl = (path: string) => `${API_CONFIG.SITE_URL}${path}`;
