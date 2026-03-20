# Interbank Error Codes

## INTERBANK_* Errors

| Code | Error | HTTP | Description |
|---|---|---|---|
| INTERBANK_001 | `invalid_amount` | 400 | Amount must be > 0 |
| INTERBANK_002 | `participant_not_found` | 404 | Debtor or creditor participant not found |
| INTERBANK_003 | `participant_inactive` | 422 | Both participants must be in active status |
| INTERBANK_004 | `invalid_transition` | 422 | Payment status transition not allowed |
| INTERBANK_005 | `reversal_failed` | 422 | Payment cannot be reversed from current status |
| INTERBANK_006 | `dispatch_failed` | 502 | Failed to dispatch message to bank connector |
| INTERBANK_007 | `duplicate_message` | 409 | Message ID already processed (deduplicated) |
| INTERBANK_008 | `connector_not_found` | 404 | No active connector for participant |
| INTERBANK_009 | `reconciliation_mismatch` | 422 | Expected and actual totals do not match |
| INTERBANK_010 | `file_parse_error` | 400 | Status file CSV parsing failed |

## AUTH_MTLS_* Errors

| Code | Error | HTTP | Description |
|---|---|---|---|
| AUTH_MTLS_001 | `certificate_invalid` | 401 | Client certificate validation failed |
| AUTH_MTLS_002 | `certificate_required` | 401 | Client certificate or authorization required |
| AUTH_MTLS_003 | `certificate_revoked` | 401 | Client certificate has been revoked |
| AUTH_MTLS_004 | `certificate_expired` | 401 | Client certificate has expired |

## ISO_* Errors

| Code | Error | HTTP | Description |
|---|---|---|---|
| ISO_001 | `invalid_pacs008` | 400 | pacs.008 XML validation failed |
| ISO_002 | `invalid_pacs002` | 400 | pacs.002 XML parsing failed |
| ISO_003 | `invalid_camt054` | 400 | camt.054 XML parsing failed |
| ISO_004 | `unknown_message_type` | 400 | Unsupported ISO 20022 message type |
| ISO_005 | `xml_signature_invalid` | 401 | XML digital signature verification failed |
