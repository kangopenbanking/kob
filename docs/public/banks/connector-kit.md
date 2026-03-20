# Bank Connector Kit — Overview

The KOB Bank Connector Kit enables financial institutions to connect to the KOB Interbank Engine without building public APIs.

## Integration Modes

| Mode | Description | When to Use |
|---|---|---|
| **HTTPS Push** | KOB pushes pacs.008 to bank's connector endpoint | Bank has API capability |
| **File** | KOB generates CSV/pain.001 instruction files; bank uploads status CSV | Bank has no API |
| **Message Queue** | KOB publishes to shared queue (future) | High-volume banks |

## BankCoreAdapter Interface

Banks implement this interface to connect their core banking system:

```typescript
interface BankCoreAdapter {
  validateAccount(accountRef: string): Promise<{ valid: boolean; name?: string }>;
  postDebit(accountRef: string, amount: number, currency: string): Promise<{ success: boolean; reference?: string }>;
  postCredit(accountRef: string, amount: number, currency: string): Promise<{ success: boolean; reference?: string }>;
  getStatus(externalPaymentId: string): Promise<{ status: 'pending' | 'completed' | 'failed'; reason?: string }>;
}
```

## Connector Endpoints

Banks receive payment instructions and send status updates:

| Endpoint | Direction | Message |
|---|---|---|
| `POST /connector/instructions/pacs008` | KOB → Bank | Receive credit transfer instruction |
| `POST /internal/connectors/{bankId}/iso20022/pacs002` | Bank → KOB | Send payment status report |
| `POST /internal/connectors/{bankId}/iso20022/camt054` | Bank → KOB | Send settlement notification |

## Security

- **mTLS**: All connector traffic requires mutual TLS certificates
- **HMAC Signatures**: Optional payload signing for integrity verification
- **Certificate Management**: Upload, rotate, and revoke certificates via API
