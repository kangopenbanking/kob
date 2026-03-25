import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function RemittanceErrorReference() {
  const errors = [
    { code: "REM_001", status: 400, error: "missing_fields", message: "Required fields missing from request" },
    { code: "REM_002", status: 404, error: "corridor_not_found", message: "No active corridor found for the specified route" },
    { code: "REM_003", status: 409, error: "quote_expired", message: "The quote has expired. Create a new quote" },
    { code: "REM_004", status: 409, error: "invalid_status", message: "Transfer is not in the correct status for this operation" },
    { code: "REM_005", status: 403, error: "compliance_blocked", message: "Transfer blocked by compliance rules" },
    { code: "REM_006", status: 429, error: "velocity_limit", message: "Daily/monthly transfer limit exceeded for this sender" },
    { code: "REM_007", status: 409, error: "idempotency_conflict", message: "Idempotency key already used with a different payload" },
    { code: "REM_008", status: 404, error: "remittance_not_found", message: "Remittance transfer not found" },
    { code: "REM_009", status: 403, error: "forbidden", message: "You do not have access to this resource" },
    { code: "REM_010", status: 409, error: "intent_already_processed", message: "Pay-in intent has already been processed" },
    { code: "REM_011", status: 503, error: "provider_unavailable", message: "Payment provider is temporarily unavailable" },
    { code: "REM_012", status: 400, error: "invalid_events", message: "One or more webhook event types are not supported" },
    { code: "REM_013", status: 400, error: "invalid_phone", message: "Recipient phone number is not valid for the destination country" },
    { code: "REM_014", status: 409, error: "transfer_not_cancellable", message: "Transfer can only be cancelled in 'created' status" },
    { code: "REM_015", status: 500, error: "payout_failed", message: "Payout delivery failed. Check transfer events for details" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-3">
        <Badge variant="outline" className="text-xs font-mono">Reference</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Error Reference</h1>
        <p className="text-lg text-muted-foreground">
          All remittance-specific error codes follow the KOB standard error envelope format.
        </p>
      </div>

      {/* Error Format */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Error Response Format</h2>
        <CodeBlock
          title="Standard Error Envelope"
          examples={[{
            language: "json",
            code: JSON.stringify({
              error: "quote_expired",
              error_code: "REM_003",
              message: "The quote has expired. Create a new quote",
              error_id: "err_a1b2c3d4",
              timestamp: "2026-03-25T19:00:00Z",
            }, null, 2),
          }]}
        />
      </div>

      {/* Error Table */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Error Codes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium">Code</th>
                <th className="text-left py-3 px-2 font-medium">HTTP</th>
                <th className="text-left py-3 px-2 font-medium">Error</th>
                <th className="text-left py-3 px-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {errors.map((e) => (
                <tr key={e.code}>
                  <td className="py-2 px-2 font-mono text-xs text-primary">{e.code}</td>
                  <td className="py-2 px-2">
                    <Badge variant={e.status < 500 ? "outline" : "destructive"} className="text-xs">
                      {e.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">{e.error}</td>
                  <td className="py-2 px-2 text-muted-foreground">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Handling Errors */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Handling Errors</h2>
        <CodeBlock
          title="Node.js Error Handling"
          examples={[{
            language: "javascript",
            code: `const response = await fetch(url, { method: 'POST', body, headers });
const data = await response.json();

if (!response.ok) {
  console.error(\`[\${data.error_id}] \${data.error_code}: \${data.message}\`);
  
  switch (data.error_code) {
    case 'REM_003': // quote_expired
      // Fetch a new quote and retry
      break;
    case 'REM_006': // velocity_limit
      // Show limit exceeded message to user
      break;
    case 'REM_007': // idempotency_conflict
      // Different payload sent with same key — generate new key
      break;
    default:
      // Log error_id for support
      break;
  }
}`,
          }]}
        />
      </div>

      {/* XAF-specific */}
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Cameroon / XAF Notes</h2>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
          <li>XAF is a zero-decimal currency — amounts are always integers (no cents)</li>
          <li>Phone numbers must start with <code className="text-xs bg-muted px-1 py-0.5 rounded">+237</code> for Cameroon</li>
          <li>MTN MoMo numbers: <code className="text-xs bg-muted px-1 py-0.5 rounded">+23767x</code> or <code className="text-xs bg-muted px-1 py-0.5 rounded">+23768x</code></li>
          <li>Orange Money numbers: <code className="text-xs bg-muted px-1 py-0.5 rounded">+23769x</code></li>
          <li>BEAC bank codes are used for bank transfers (5-digit format)</li>
        </ul>
      </div>
    </div>
  );
}
