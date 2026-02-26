import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const errorCodes = [
  { code: "AISP_001", status: 401, message: "Invalid or expired consent", retryable: false },
  { code: "AISP_002", status: 403, message: "Insufficient consent permissions", retryable: false },
  { code: "AISP_003", status: 404, message: "Account not found", retryable: false },
  { code: "PISP_001", status: 400, message: "Invalid payment request", retryable: false },
  { code: "PISP_002", status: 409, message: "Duplicate payment (idempotency)", retryable: false },
  { code: "PISP_003", status: 402, message: "Insufficient funds", retryable: false },
  { code: "GW_001", status: 400, message: "Invalid charge parameters", retryable: false },
  { code: "GW_002", status: 402, message: "Payment declined by processor", retryable: true },
  { code: "GW_003", status: 409, message: "Charge already processed", retryable: false },
  { code: "GW_004", status: 422, message: "Refund exceeds charge amount", retryable: false },
  { code: "GW_005", status: 503, message: "Processor temporarily unavailable", retryable: true },
  { code: "AUTH_001", status: 401, message: "Invalid or expired token", retryable: false },
  { code: "AUTH_002", status: 401, message: "Invalid client credentials", retryable: false },
  { code: "AUTH_003", status: 403, message: "Insufficient scope", retryable: false },
  { code: "RATE_001", status: 429, message: "Rate limit exceeded", retryable: true },
  { code: "SYS_001", status: 500, message: "Internal server error", retryable: true },
  { code: "SYS_002", status: 503, message: "Service maintenance", retryable: true },
];

export default function ErrorCodes() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">Error Code Registry</h1>
        <p className="text-xl text-muted-foreground">Complete error code reference following RFC 7807 problem detail format.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>Error Response Format</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs text-muted-foreground">{`{
  "error": {
    "code": "GW_002",
    "message": "Payment declined by processor",
    "details": "Card issuer declined the transaction",
    "request_id": "req_abc123",
    "timestamp": "2026-02-26T10:30:00Z"
  }
}`}</pre></div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Error Codes</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Code</th><th className="text-left p-3 font-semibold">HTTP</th><th className="text-left p-3 font-semibold">Message</th><th className="text-left p-3 font-semibold">Retryable</th></tr></thead>
                <tbody className="text-muted-foreground">
                  {errorCodes.map((e) => (
                    <tr key={e.code} className="border-b">
                      <td className="p-3 font-mono text-xs">{e.code}</td>
                      <td className="p-3"><Badge variant={e.status >= 500 ? "destructive" : "secondary"}>{e.status}</Badge></td>
                      <td className="p-3">{e.message}</td>
                      <td className="p-3">{e.retryable ? "✅ Yes" : "❌ No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
