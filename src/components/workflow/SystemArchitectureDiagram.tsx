export function SystemArchitectureDiagram() {
  return (
    <div className="my-8 bg-muted p-6 rounded-lg overflow-x-auto">
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
{`System Architecture

┌─────────────────────────────────────────────┐
│         Client Applications                  │
│  - Financial Institutions                    │
│  - Third Party Providers (TPPs)              │
│  - Developers                                │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         API Gateway Layer                    │
│  → Load Balancer                             │
│  → Authentication (OAuth 2.0 + FAPI)         │
│  → Rate Limiting                             │
│  → Response Cache                            │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Core Services                        │
│  → AISP Service (Account Information)        │
│  → PISP Service (Payments)                   │
│  → Mobile Money Service                      │
│  → Banking Ops Service                       │
│  → KYC/AML Service                           │
│  → Fee Management Service                    │
└──────────────────┬──────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Data Layer                           │
│  → PostgreSQL Database                       │
│  → File Storage (Documents)                  │
│  → Analytics (Time-series DB)                │
└─────────────────────────────────────────────┘

External Integrations:
  - Cameroonian Banks
  - MTN/Orange Money
  - Stripe (Card Payments)
  - Flutterwave (Bank Transfers)
  - COBAC/BEAC (Regulatory)`}
      </pre>
    </div>
  );
}
