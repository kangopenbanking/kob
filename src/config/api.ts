/**
 * Centralized API configuration for Kang Open Banking
 * All API URLs and endpoints should be referenced from here
 * 
 * Note: Currently using direct Supabase URLs until custom domain 
 * routing is configured for edge functions in Supabase dashboard.
 */
export const API_CONFIG = {
  BASE_URL: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1',
  DOCS_URL: 'https://kangopenbanking.com/documentation',
  EXPLORER_URL: 'https://kangopenbanking.com/developer/api-explorer',
  OPENAPI_SPEC: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/public-api-spec',
  POSTMAN_COLLECTION: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/postman-collection',
} as const;
