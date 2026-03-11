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
} as const;

/**
 * Returns a canonical public URL for the given path.
 * Always uses kangopenbanking.com regardless of the current browser origin.
 */
export const getCanonicalUrl = (path: string) => `${API_CONFIG.SITE_URL}${path}`;
