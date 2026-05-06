# API v4.31.0 — Partner-Mode QR Acceptance

**Released:** 2026-05-06
**Type:** Minor (additive)
**Breaking:** None

## Summary

External virtual-card issuers (Visa, Mastercard, fintech apps) can now
discover KOB merchants and push card-funded payments through the existing
KOB PISP rail using their own OAuth2 `client_credentials` access tokens.

Fully additive — no operationId, path, or schema renames (Standing Orders 1, 2, 4).

## New Endpoints

| Method | Path | operationId |
|---|---|---|
| GET | `/v1/merchants/qr-directory` | `merchantsQrDirectoryList` |
| GET | `/v1/merchants/qr-directory/{id}` | `merchantsQrGet` |

## Updated Endpoints

- `POST /v1/payments/qr-initiate` (`paymentsQrInitiate`)
  - New header `X-Partner-Cardholder-Ref` triggers partner-mode auth.
  - New body fields `partner_card_token_id` + `auth_evidence`.
  - New error codes:
    - `QR_007` (403) — access token missing scope `payments:qr`.
    - `QR_008` (404) — partner card token unknown / revoked.
    - `QR_009` (412) — PSD2 RTS Art. 18 SCA evidence missing or expired.

## Database

- New table `public.partner_card_tokens` (network token + last4 only — **no PAN**).
- New columns on `public.qr_card_payments`:
  `source`, `partner_client_id`, `partner_cardholder_ref`,
  `partner_card_token_id`, `auth_evidence`.
- New view `public.merchant_qr_directory` (KYB-approved active merchants).
- `get_admin_qr_payments_audit()` exposes the new partner columns.

## Admin

- **QR Payments Audit** gains a **Source** column distinguishing
  `user` vs `partner:<client_id>` originated payments.

## Standards

- EMVCo MPM Specification v1.1 §4 (TLV) + §6 (CRC16-CCITT/FALSE)
- PSD2 RTS Article 18 (Transaction Risk Analysis / SCA delegation)
- PSD2 RTS Article 36(1)(b) (Idempotent retries)
- FAPI 1.0 Advanced §5.2.2 (Bearer for inter-service)
- RFC 6749 §4.4 (Client Credentials Grant)
- RFC 7807 (Problem Details for HTTP APIs)
- ISO 4217, ISO 18245, ISO 3166-1 alpha-2
