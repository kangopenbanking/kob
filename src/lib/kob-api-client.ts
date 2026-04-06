/**
 * KOB API Client — Shared singleton for all three apps (Consumer, Business, Banking)
 * 
 * Provides:
 * - OIDC Discovery bootstrap (cached)
 * - HTTP client with interceptors (Authorization, Idempotency-Key, x-fapi-interaction-id)
 * - 401 silent token refresh with retry
 * - RFC 7807 (ProblemDetails) error parsing
 * - In-memory token store (never localStorage)
 * - Health check guard
 * 
 * Standards: FAPI 1.0 Advanced, RFC 7591, RFC 7807, RFC 7234
 */

const SANDBOX_BASE = 'https://sandbox.kangopenbanking.com/v1';
const PROD_BASE = 'https://api.kangopenbanking.com/v1';

// Use sandbox for development, prod for production
const BASE_URL = import.meta.env.DEV ? SANDBOX_BASE : PROD_BASE;

// ─── RFC 7807 ProblemDetails ──────────────────────────────────
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  error_id?: string;
  timestamp?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

export class KOBApiError extends Error {
  public readonly problem: ProblemDetails;
  public readonly status: number;

  constructor(problem: ProblemDetails, status: number) {
    super(problem.detail || problem.title || 'API Error');
    this.name = 'KOBApiError';
    this.problem = problem;
    this.status = status;
  }
}

// ─── OIDC Discovery Cache ─────────────────────────────────────
interface OIDCDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  pushed_authorization_request_endpoint: string;
  revocation_endpoint: string;
  introspection_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

// ─── In-Memory Token Store ────────────────────────────────────
interface TokenState {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp ms
  client_id: string;
}

let _tokenState: TokenState | null = null;
let _discovery: OIDCDiscovery | null = null;
let _discoveryPromise: Promise<OIDCDiscovery> | null = null;
let _refreshPromise: Promise<boolean> | null = null;

// ─── Token Store API ──────────────────────────────────────────
export const tokenStore = {
  setTokens(tokens: { access_token: string; refresh_token: string; expires_in: number; client_id: string }) {
    _tokenState = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      client_id: tokens.client_id,
    };
  },

  getAccessToken(): string | null {
    return _tokenState?.access_token ?? null;
  },

  getRefreshToken(): string | null {
    return _tokenState?.refresh_token ?? null;
  },

  getClientId(): string | null {
    return _tokenState?.client_id ?? null;
  },

  isExpired(): boolean {
    if (!_tokenState) return true;
    return Date.now() >= _tokenState.expires_at - 30_000; // 30s buffer
  },

  clear() {
    _tokenState = null;
  },
};

// ─── OIDC Bootstrap ───────────────────────────────────────────
export async function bootstrapOIDC(): Promise<OIDCDiscovery> {
  if (_discovery) return _discovery;
  if (_discoveryPromise) return _discoveryPromise;

  _discoveryPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/oidc/.well-known/openid-configuration`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
      _discovery = await res.json();
      return _discovery!;
    } catch (err) {
      _discoveryPromise = null;
      throw err;
    }
  })();

  return _discoveryPromise;
}

export function getDiscovery(): OIDCDiscovery | null {
  return _discovery;
}

// ─── Silent Token Refresh ─────────────────────────────────────
async function silentRefresh(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const refreshToken = tokenStore.getRefreshToken();
      const clientId = tokenStore.getClientId();
      if (!refreshToken || !clientId) return false;

      const tokenEndpoint = _discovery?.token_endpoint || `${BASE_URL}/oauth/token`;

      const res = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        }),
      });

      if (!res.ok) {
        // Refresh failed — revoke and clear
        try {
          const revokeEndpoint = _discovery?.revocation_endpoint || `${BASE_URL}/oauth/revoke`;
          await fetch(revokeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: refreshToken, client_id: clientId }),
          });
        } catch { /* best effort */ }
        tokenStore.clear();
        return false;
      }

      const data = await res.json();
      tokenStore.setTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 900,
        client_id: clientId,
      });
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ─── RFC 7807 Parser ──────────────────────────────────────────
async function parseProblemDetails(res: Response): Promise<ProblemDetails | null> {
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/problem+json') || ct.includes('application/json')) {
    try {
      const body = await res.json();
      if (body.type || body.detail || body.error_id || body.title) {
        return body as ProblemDetails;
      }
    } catch { /* not JSON */ }
  }
  return null;
}

// ─── Main HTTP Client ─────────────────────────────────────────
export interface KOBRequestOptions extends Omit<RequestInit, 'body'> {
  /** Skip auto-attaching Authorization header */
  skipAuth?: boolean;
  /** Skip auto-generating Idempotency-Key */
  skipIdempotency?: boolean;
  /** JSON body (auto-serialized) */
  body?: unknown;
  /** Custom base URL override */
  baseUrl?: string;
}

export async function kobRequest<T = unknown>(
  path: string,
  options: KOBRequestOptions = {}
): Promise<T> {
  const { skipAuth, skipIdempotency, body, baseUrl, ...fetchOptions } = options;

  const url = `${baseUrl || BASE_URL}/${path.replace(/^\//, '')}`;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Build headers
  const headers = new Headers(fetchOptions.headers);

  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  // x-fapi-interaction-id on every request
  headers.set('x-fapi-interaction-id', crypto.randomUUID());

  // Authorization
  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Idempotency-Key on mutating methods
  if (!skipIdempotency && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (!headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', crypto.randomUUID());
    }
  }

  const init: RequestInit = {
    ...fetchOptions,
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let res = await fetch(url, init);

  // 401 — attempt silent refresh and retry once
  if (res.status === 401 && !skipAuth) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set('Authorization', `Bearer ${tokenStore.getAccessToken()}`);
      // New interaction ID for retry
      retryHeaders.set('x-fapi-interaction-id', crypto.randomUUID());

      res = await fetch(url, { ...init, headers: retryHeaders });
    } else {
      // Dispatch event for app-level redirect to login
      window.dispatchEvent(new CustomEvent('kob:session-expired'));
      const problem = await parseProblemDetails(res);
      throw new KOBApiError(
        problem || { title: 'Session Expired', detail: 'Please sign in again', status: 401 },
        401
      );
    }
  }

  // Error handling
  if (!res.ok) {
    const problem = await parseProblemDetails(res);
    if (problem) {
      throw new KOBApiError(problem, res.status);
    }
    throw new KOBApiError(
      { title: 'Request Failed', detail: `HTTP ${res.status}`, status: res.status },
      res.status
    );
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// ─── Health Check ─────────────────────────────────────────────
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthResponse {
  status: string;
  version?: string;
  uptime?: number;
}

export async function checkHealth(): Promise<HealthStatus> {
  // Primary: use our own edge function which is always reachable
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/api-health`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'operational') return 'healthy';
        if (data.status === 'degraded') return 'degraded';
      }
      // Non-ok but reachable = degraded, not unhealthy
      return 'degraded';
    } catch {
      // Edge function unreachable — fall through to external check
    }
  }

  // Fallback: external API health endpoint
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 503) return 'degraded';
    if (!res.ok) return 'degraded';

    const data: HealthResponse = await res.json();
    if (data.status === 'unhealthy') return 'degraded';
    if (data.status === 'degraded') return 'degraded';
    return 'healthy';
  } catch {
    // Both checks failed — still show degraded, NOT unhealthy
    // The full-screen block should only appear for explicit 503 maintenance mode
    return 'degraded';
  }
}

// ─── Convenience Methods ──────────────────────────────────────
export const kobApi = {
  get: <T = unknown>(path: string, opts?: KOBRequestOptions) =>
    kobRequest<T>(path, { ...opts, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, opts?: KOBRequestOptions) =>
    kobRequest<T>(path, { ...opts, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, opts?: KOBRequestOptions) =>
    kobRequest<T>(path, { ...opts, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, opts?: KOBRequestOptions) =>
    kobRequest<T>(path, { ...opts, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, opts?: KOBRequestOptions) =>
    kobRequest<T>(path, { ...opts, method: 'DELETE' }),
};
