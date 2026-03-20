# Bank Connector Authentication

## mTLS (Mutual TLS)

All production connector traffic requires mutual TLS authentication.

### Certificate Requirements
- X.509 v3 certificate
- RSA 2048-bit or ECDSA P-256 minimum
- Valid `notBefore` and `notAfter` dates
- SHA-256 thumbprint registered with KOB

### Certificate Lifecycle
1. **Upload**: Register certificate via `upload_certificate` action
2. **Validate**: KOB stores thumbprint and validity period
3. **Enforce**: All connector calls validated against stored thumbprint
4. **Rotate**: Upload new cert before old expires; revoke old cert
5. **Revoke**: Set `revoked_at` to immediately invalidate

## OAuth2 Scopes

| Scope | Access |
|---|---|
| `bank:read` | Read bank directory |
| `bank:admin` | Manage bank registration and connectors |
| `bank:ingest` | Push account/transaction data |
| `bank:payments` | Initiate and manage bank payments |
| `aisp:accounts` | Read connector-backed accounts |
| `pisp:payments` | Initiate payments via bank rail |

## HMAC Payload Signing (Optional)

For additional integrity verification:

```
X-Webhook-Signature: sha256=<hex(HMAC-SHA256(payload, secret))>
```

The HMAC secret is stored as a hash in `bank_connector_instances.hmac_secret_hash`.
