import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function RiskAuditReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Risk Rules, Limits & Audit Trail API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Configure transaction risk rules, manage limits, and query immutable audit trails
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Risk rule management requires <code className="bg-muted px-2 py-1 rounded">admin</code> or <code className="bg-muted px-2 py-1 rounded">institution</code> role. Audit trail endpoints are read-only.
        </AlertDescription>
      </Alert>

      {/* Transaction Limits */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Transaction Limits</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/risk/limits"
          description="Retrieve current transaction limits for the authenticated institution or user"
          response={`{
  "limits": {
    "single_transaction": {
      "mobile_money": 500000,
      "bank_transfer": 5000000,
      "card_payment": 2000000
    },
    "daily_aggregate": {
      "mobile_money": 2000000,
      "bank_transfer": 20000000,
      "card_payment": 10000000
    },
    "monthly_aggregate": {
      "all_channels": 50000000
    }
  },
  "currency": "XAF"
}`}
        />

        <ApiEndpoint
          method="PUT"
          endpoint="/v1/risk/limits"
          description="Update transaction limits for an institution. Requires admin role."
          requestBody={`{
  "institution_id": "inst_001",
  "limits": {
    "single_transaction": {
      "mobile_money": 1000000,
      "bank_transfer": 10000000
    },
    "daily_aggregate": {
      "mobile_money": 5000000
    }
  }
}`}
          response={`{
  "status": "success",
  "message": "Limits updated",
  "effective_from": "2026-02-16T10:00:00Z"
}`}
        />
      </div>

      {/* Risk Rules */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Risk Rules</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/risk/rules"
          description="List all active risk rules for the authenticated institution"
          parameters={[
            { name: "category", type: "string", required: false, description: "Filter by category (velocity, geo, amount, fraud)" }
          ]}
          response={`{
  "data": [
    {
      "rule_id": "rule_001",
      "name": "High-value mobile money",
      "category": "amount",
      "condition": "amount > 500000 AND channel = 'mobile_money'",
      "action": "flag_for_review",
      "is_active": true
    },
    {
      "rule_id": "rule_002",
      "name": "Velocity check",
      "category": "velocity",
      "condition": "tx_count_1h > 10",
      "action": "block",
      "is_active": true
    }
  ]
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/risk/rules"
          description="Create a new risk rule. Requires admin role. Requires Idempotency-Key header."
          requestBody={`{
  "name": "Suspicious cross-border",
  "category": "geo",
  "condition": "recipient_country != 'CM' AND amount > 1000000",
  "action": "flag_for_review",
  "is_active": true
}`}
          response={`{
  "rule_id": "rule_003",
  "name": "Suspicious cross-border",
  "status": "active",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />
      </div>

      {/* Audit Trail */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Audit Trail</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/audit/logs"
          description="Query the immutable audit trail for all platform actions"
          parameters={[
            { name: "entity_type", type: "string", required: false, description: "Filter by entity (payment, consent, user, account, loan)" },
            { name: "action_type", type: "string", required: false, description: "Filter by action (create, update, delete, login, approve)" },
            { name: "performed_by", type: "string", required: false, description: "Filter by user ID" },
            { name: "from_date", type: "string", required: false, description: "Start datetime (ISO 8601)" },
            { name: "to_date", type: "string", required: false, description: "End datetime (ISO 8601)" },
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "id": "audit_001",
      "entity_type": "payment",
      "entity_id": "pay_abc123",
      "action_type": "create",
      "performed_by": "user_xyz",
      "ip_address": "192.168.1.1",
      "user_agent": "KOB-SDK/1.0",
      "details": {
        "amount": 50000,
        "currency": "XAF",
        "status": "pending"
      },
      "created_at": "2026-02-16T10:05:00Z"
    }
  ],
  "pagination": {
    "total": 1500,
    "limit": 25,
    "offset": 0,
    "has_more": true
  }
}`}
        />
      </div>

      {/* Admin APIs */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Admin Operations</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/admin/create-user"
          description="Create a new platform user (admin only). Requires Idempotency-Key header."
          requestBody={`{
  "email": "user@institution.com",
  "role": "staff",
  "institution_id": "inst_001",
  "full_name": "Jane Doe",
  "phone": "237670000000"
}`}
          response={`{
  "user_id": "usr_new_001",
  "email": "user@institution.com",
  "role": "staff",
  "status": "active",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />

        <ApiEndpoint
          method="POST"
          endpoint="/v1/admin/create-client"
          description="Register a new API client for an institution (admin only). Requires Idempotency-Key header."
          requestBody={`{
  "client_name": "Example Bank Production",
  "institution_id": "inst_001",
  "grant_types": ["client_credentials", "authorization_code"],
  "scopes": ["accounts", "payments"],
  "redirect_uris": ["https://example-bank.com/callback"],
  "rate_limit_tier": "premium"
}`}
          response={`{
  "client_id": "cli_new_001",
  "client_secret": "sec_*****",
  "client_name": "Example Bank Production",
  "scopes": ["accounts", "payments"],
  "rate_limit_tier": "premium",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />
      </div>

      <DocNavigation
        previousPage={{
          title: "Transaction Exports",
          path: "/developer/api/exports"
        }}
        nextPage={{
          title: "Webhooks",
          path: "/developer/api/webhooks"
        }}
      />
    </div>
  );
}
