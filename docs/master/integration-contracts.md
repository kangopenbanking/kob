# KOB v1 — Integration Contracts

> Generated: 2026-03-15 | Version: 6.0.0

## 1. Institution Integration Contract

### Prerequisites
| Requirement | Detail |
|---|---|
| Registration | `POST /v1/institutions/register` with legal entity details |
| KYB Verification | Submit KYB docs → admin approval via `admin-kyb-verify` |
| OAuth Client | DCR (`POST /v1/dcr/register`) or admin-provisioned `api_clients` |
| mTLS Certificate | Upload via `POST /v1/certificates` (production only) |
| Sandbox Credentials | Auto-issued on registration; gated prod keys on KYB approval |

### Auth Method
- **OAuth 2.0** with `client_credentials` + `authorization_code` grants
- PKCE required (S256 only)
- PAR required (`POST /v1/oauth/par`)
- Certificate-bound tokens (FAPI) in production
- Token endpoint: `POST /v1/oauth/token`
- Introspection: `POST /v1/oauth/introspect`
- Revocation: `POST /v1/oauth/revoke`

### Required Endpoints (AISP)
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/aisp/consents` | Create account-information consent |
| POST | `/v1/consents/:id/authorize` | PSU authorization |
| GET | `/v1/aisp/accounts` | List authorized accounts |
| GET | `/v1/aisp/accounts/:id` | Account detail |
| GET | `/v1/aisp/accounts/:id/balances` | Balance queries |
| GET | `/v1/aisp/accounts/:id/transactions` | Transaction history (paginated) |
| GET | `/v1/aisp/accounts/:id/beneficiaries` | Beneficiary list |
| GET | `/v1/aisp/accounts/:id/standing-orders` | Standing orders |
| GET | `/v1/aisp/accounts/:id/direct-debits` | Direct debits |

### Required Endpoints (PISP)
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/pisp/consents` | Create payment consent |
| POST | `/v1/pisp/domestic-payment` | Initiate domestic payment |
| POST | `/v1/pisp/payment-submission` | Submit payment for processing |
| GET | `/v1/pisp/payments/:id` | Payment status |

### Webhook Requirements
- Register via `POST /v1/webhooks`
- Events: `payment.completed`, `payment.failed`, `consent.revoked`, `consent.expired`
- HMAC-SHA256 signature verification required
- Retry policy: 7 attempts with exponential backoff

### Error Contract
All errors follow:
```json
{
  "error": "machine_code",
  "error_code": "DOMAIN_NNN",
  "message": "Human-readable description",
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-03-15T10:00:00Z"
}
```
HTTP status codes: 400, 401, 403, 404, 409, 422, 429, 500.

---

### Dynamic Client Registration (DCR)

Endpoint: `POST /v1/dcr/register` (RFC 7591, FAPI 1.0 ADV Section 5.2.2)

#### Request Body (`DcrRegistrationRequest`)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `software_statement` | string (JWT) | Yes | -- | Signed SSA from KOB Directory. Must contain `software_id`, `software_client_name`, `software_roles` claims |
| `redirect_uris` | array of URI | Yes | -- | OAuth 2.0 redirect endpoints. HTTPS required in production |
| `client_name` | string | No | From SSA | Human-readable client name |
| `token_endpoint_auth_method` | string enum | No | `tls_client_auth` | One of: `tls_client_auth`, `private_key_jwt`, `client_secret_basic`, `client_secret_post`, `none` |
| `grant_types` | array of string | No | `["authorization_code", "refresh_token"]` | Supported grant types |
| `response_types` | array of string | No | `["code"]` | Supported response types |
| `scope` | string | No | `accounts payments` | Space-delimited scopes |
| `jwks_uri` | string (URI) | No | -- | JWKS endpoint for client keys (mutually exclusive with `jwks`) |
| `jwks` | object | No | -- | Inline JWKS (mutually exclusive with `jwks_uri`) |
| `application_type` | string enum | No | `web` | `web` or `native` |
| `id_token_signed_response_alg` | string enum | No | `PS256` | `PS256`, `ES256`, or `RS256` |
| `request_object_signing_alg` | string enum | No | `PS256` | `PS256` or `ES256` |

#### Response Body (`DcrRegistrationResponse`)

| Field | Type | Description |
|---|---|---|
| `client_id` | string | Unique client identifier (format: `tpp_{uuid}`) |
| `client_secret` | string | Plaintext secret -- returned ONLY at registration time |
| `client_name` | string | Registered client name |
| `software_id` | string | Software identifier from SSA |
| `software_roles` | array | Granted roles (e.g., `["AISP", "PISP"]`) |
| `redirect_uris` | array | Registered redirect URIs |
| `grant_types` | array | Granted grant types |
| `response_types` | array | Granted response types |
| `token_endpoint_auth_method` | string | Registered auth method |
| `jwks_uri` | string | Registered JWKS endpoint (if provided) |
| `scope` | string | Granted scopes |
| `environment` | string | `sandbox` or `production` |
| `client_id_issued_at` | integer | Unix timestamp of issuance |

#### SSA Required Claims

The `software_statement` JWT must contain these claims:
- `software_id` -- unique identifier for the software
- `software_client_name` -- display name
- `software_roles` -- array of authorized roles (`AISP`, `PISP`, `CBPII`)
- `software_redirect_uris` -- fallback redirect URIs (used if `redirect_uris` not provided in request body)

---

## 2. Merchant Integration Contract

### Prerequisites
| Requirement | Detail |
|---|---|
| Registration | Via `/auth` → "Accept Payments" track or `POST /v1/gateway/merchants` |
| KYB Verification | `POST /v1/gateway/merchant-kyb` → admin approval via `gateway-merchant-kyb-review` |
| API Keys | Auto-issued sandbox keys; prod keys gated on KYB approval |
| Webhook Endpoint | Register via Merchant Portal or `POST /v1/gateway/webhook-endpoints` |

### Auth Method
- **API Key** (Bearer token in `Authorization` header)
- Sandbox keys: `sk_test_*`
- Production keys: `sk_live_*`
- Keys managed via `gateway-merchant-keys` edge function

### Required Endpoints (Collections)
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/gateway/charges` | Create charge (MoMo, Card, USSD, PayPal) |
| GET | `/v1/gateway/charges/:id` | Retrieve charge |
| GET | `/v1/gateway/charges` | List charges |
| POST | `/v1/gateway/charges/:id/verify` | Verify charge status |
| POST | `/v1/gateway/charges/:id/cancel` | Cancel pending charge |
| GET | `/v1/gateway/fee-estimate` | Estimate fees before charge |

### Required Endpoints (Refunds)
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/gateway/refunds` | Create refund (full or partial) |
| GET | `/v1/gateway/refunds/:id` | Get refund status |
| GET | `/v1/gateway/refunds` | List refunds |

### Required Endpoints (Payouts)
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/gateway/payouts` | Create payout (bank, MoMo, PayPal) |
| GET | `/v1/gateway/payouts/:id` | Get payout status |
| GET | `/v1/gateway/payouts` | List payouts |
| POST | `/v1/gateway/payout-batches` | Batch payouts |

### Required Endpoints (Reporting)
| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/gateway/reports/transactions` | Transaction report |
| GET | `/v1/gateway/reports/settlements` | Settlement report |
| GET | `/v1/gateway/export/transactions` | CSV export |
| GET | `/v1/gateway/settlements` | List settlements |
| GET | `/v1/gateway/disputes` | List disputes |

### Webhook Events
| Event | Trigger |
|---|---|
| `charge.successful` | Payment completed |
| `charge.failed` | Payment failed |
| `refund.successful` | Refund processed |
| `refund.failed` | Refund failed |
| `payout.successful` | Payout completed |
| `payout.failed` | Payout failed |
| `dispute.created` | Dispute opened |
| `settlement.completed` | Settlement batch completed |

### Error Contract
Same as Institution (see above). Merchant-specific codes prefixed `GW_`.

---

## 3. Developer Integration Contract

### Prerequisites
| Requirement | Detail |
|---|---|
| Registration | Via `/auth` → "Build & Integrate" track |
| App Registration | `POST /v1/developers/register` |
| Sandbox Keys | Auto-issued on app registration |
| Production Access | Gated on KYB/compliance review |

### Auth Method
- **OAuth 2.0** `client_credentials` for server-to-server
- **OAuth 2.0** `authorization_code` + PKCE for user-delegated access
- Token endpoint: `POST /v1/oauth/token`

### Available Endpoints
All AISP, PISP, Gateway, and utility endpoints are available to developers based on granted scopes:
- `accounts`, `balances`, `transactions` — AISP access
- `payments` — PISP access
- `gateway` — Payment gateway access
- `openid`, `offline_access` — Identity and refresh tokens

### Sandbox Tools
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/sandbox/accounts` | Create test accounts |
| POST | `/v1/sandbox/api-keys` | Generate sandbox keys |
| POST | `/v1/sandbox/data/generate` | Seed test data |
| POST | `/v1/sandbox/webhooks` | Register test webhook endpoint |

### Webhook Requirements
Same HMAC-SHA256 verification as Merchant/Institution.

### Error Contract
Same unified error envelope. Developer-specific codes prefixed `DEV_`.

---

## 4. Onboarding Checklists

### Institution Onboarding Checklist
- [ ] Register institution (`/auth` → "Open Banking APIs")
- [ ] Submit KYB documents
- [ ] Wait for admin KYB approval
- [ ] Receive sandbox credentials
- [ ] Register OAuth client (DCR or admin-provisioned)
- [ ] Upload mTLS certificate (production)
- [ ] Test AISP consent flow in sandbox
- [ ] Test PISP payment flow in sandbox
- [ ] Register webhook endpoints
- [ ] Request production access

### Merchant Onboarding Checklist
- [ ] Register merchant account (`/auth` → "Accept Payments")
- [ ] Submit KYB documents
- [ ] Wait for admin approval
- [ ] Receive API keys (sandbox auto-issued)
- [ ] Integrate payment collection (MoMo/Card/USSD)
- [ ] Register webhook endpoint
- [ ] Test charge → verify → webhook flow
- [ ] Test refund flow
- [ ] Request production keys

### Developer Onboarding Checklist
- [ ] Register developer account (`/auth` → "Build & Integrate")
- [ ] Register developer app
- [ ] Obtain sandbox API keys
- [ ] Test health endpoint (`GET /v1/health`)
- [ ] Implement OAuth token exchange
- [ ] Test API calls in sandbox
- [ ] Register webhook endpoint
- [ ] Review rate limits and error codes
- [ ] Submit for production review
