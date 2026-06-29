# KOB Bank Connector — Partner Onboarding Checklist

Use this checklist to drive your engineering kickoff with the Kang Open Banking
(KOB) integration team. Owner = your team unless otherwise marked. Send the
completed file to `partners@kangopenbanking.com` before scheduling the
go-live review.

Partner bank: ______________________________________________________
Integration mode (file_https | file_sftp | db_pull | queue_stream | realtime_api): _______
Target go-live date: ______________________________________________

---

## 1. Network & connectivity
- [ ] Egress allowlist updated for `*.kangopenbanking.com` (443/TCP)
- [ ] Static source IP range registered with KOB (provide CIDR list)
- [ ] If SFTP: bank firewall opens 22/TCP to `sftp.kangopenbanking.com`
- [ ] mTLS terminator (NGINX/Envoy/F5) identified and version recorded
- [ ] Time sync (NTP) within ±2 seconds of UTC

## 2. mTLS — certificate request & rotation
- [ ] Generate 2048-bit RSA (or P-256 ECDSA) key pair on a hardware/HSM-backed store
- [ ] CSR submitted to KOB with SAN = `<bank-slug>.connector.kangopenbanking.com`
- [ ] Receive signed client cert + intermediate CA from KOB ops
- [ ] Install cert chain on connector terminator; verify with `openssl s_client -connect ...`
- [ ] Record SHA-256 thumbprint in `bank_connector_instances.cert_thumbprint`
- [ ] Calendar a rotation reminder **30 days** before `notAfter`
- [ ] Document revocation contact (24×7 PagerDuty / email)

## 3. SFTP file-feed (if applicable)
- [ ] Host: `sftp.kangopenbanking.com`  Port: `22`  User: `<bank-slug>-prod`
- [ ] Auth: ed25519 public key uploaded via the Portal → Connectors → Keys
- [ ] Inbound directory: `/inbound/<bank-slug>/YYYY/MM/DD/`
- [ ] Filename pattern: `<bank-slug>_<feed>_<UTC-yyyymmddHHMMSS>.csv` (UTF-8, LF)
- [ ] Polling schedule confirmed (default every 5 minutes, max file 250 MB)
- [ ] Failure folder `/error/` monitored by bank ops (24-hour SLA)

## 4. Data model & schema
- [ ] Account export columns mapped to KOB Connector Contract (see runbook)
- [ ] Currency code is ISO-4217 alpha (XAF, XOF, EUR, USD)
- [ ] Amount precision matches zero-decimal rules for XAF/XOF
- [ ] Dedupe key = `(bank_id, account_iban, posting_datetime, amount, tx_ref)`
- [ ] Sample file (10 rows, sanitized) attached to onboarding ticket

## 5. Webhook receiver (your endpoint)
- [ ] Public HTTPS URL registered (TLS 1.2+, no self-signed certs)
- [ ] HMAC-SHA256 signature verification implemented (`X-Webhook-Signature`)
- [ ] Idempotent on `event_id` (store 14-day dedupe window)
- [ ] Returns `2xx` within 5 seconds; processes async
- [ ] Subscribed events listed (`connector.file.accepted`, `connector.file.rejected`, …)

## 6. Compliance & security
- [ ] Bank DPO sign-off on data classes shared (PII, KYC, transactional)
- [ ] Encryption at rest confirmed on KOB side (AES-256, customer-managed key optional)
- [ ] Penetration test report shared (most recent within 12 months)
- [ ] DPIA / risk register entry created on bank side

## 7. Go-live gating (KOB will sign off)
- [ ] 100 sandbox files processed end-to-end with zero `partially_accepted`
- [ ] Reconciliation report matches bank GL for 3 consecutive business days
- [ ] Runbook escalation path (P1/P2/P3) acknowledged by bank on-call
- [ ] Production credentials issued (separate from sandbox)
- [ ] Cutover window booked with both ops teams

---

Document version: 1.0  •  Last reviewed: 2026-06-29
Questions: `partners@kangopenbanking.com`  •  Runbook: https://kangopenbanking.com/developer/connectors/bank-connector-runbook
