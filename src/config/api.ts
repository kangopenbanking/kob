/**
 * Centralized API configuration for Kang Open Banking
 * All API URLs and endpoints should be referenced from here
 * 
 * Note: Using custom domain with automatic fallback to direct Supabase URL
 * until custom domain function routing is fully configured.
 */
export const API_CONFIG = {
  SITE_URL: 'https://kangopenbanking.com',
  BASE_URL: 'https://api.kangopenbanking.com/functions/v1',
  BASE_URL_FALLBACK: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1',
  DOCS_URL: 'https://kangopenbanking.com/documentation',
  EXPLORER_URL: 'https://kangopenbanking.com/developer/api-explorer',
  OPENAPI_SPEC: 'https://api.kangopenbanking.com/functions/v1/public-api-spec',
  POSTMAN_COLLECTION: 'https://api.kangopenbanking.com/functions/v1/postman-collection',
  /** Static spec files served from /public — no edge function cold-start */
  OPENAPI_JSON: '/openapi.json',
  OPENAPI_YAML: '/openapi.yaml',
  OPENAPI_SANDBOX_JSON: '/openapi-sandbox.json',
  OPENAPI_SANDBOX_YAML: '/openapi-sandbox.yaml',
} as const;

/**
 * Runtime API base URL — uses the working Supabase functions URL as primary,
 * falling back to custom domain. This ensures code examples and SDK calls
 * work even before custom domain DNS is configured.
 */
export const API_RUNTIME_BASE_URL = API_CONFIG.BASE_URL_FALLBACK;

/**
 * Display-facing API base URL for documentation and code examples.
 * Uses the canonical custom domain so examples look professional,
 * but developers can swap to API_RUNTIME_BASE_URL for immediate testing.
 */
export const API_EXAMPLE_BASE_URL = 'https://api.kangopenbanking.com';

/**
 * Returns a canonical public URL for the given path.
 * Always uses kangopenbanking.com regardless of the current browser origin.
 */
export const getCanonicalUrl = (path: string) => `${API_CONFIG.SITE_URL}${path}`;

/**
 * Attempts to call the custom domain first, falls back to Supabase URL.
 * Use for runtime API calls in the application.
 */
export async function fetchWithFallback(
  path: string,
  init?: RequestInit
): Promise<Response> {
  try {
    const res = await fetch(`${API_CONFIG.BASE_URL}/${path}`, init);
    if (res.ok) return res;
  } catch {
    // Custom domain unavailable — fall through to fallback
  }
  return fetch(`${API_CONFIG.BASE_URL_FALLBACK}/${path}`, init);
}
