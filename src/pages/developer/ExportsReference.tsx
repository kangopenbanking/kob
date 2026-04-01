import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function ExportsReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Transaction Exports API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Export transaction data in CSV, JSON, or PDF formats for reporting and reconciliation
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Export requests are processed asynchronously. Use the status endpoint or webhooks to know when your file is ready for download.
        </AlertDescription>
      </Alert>

      {/* Create Export */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Request Transaction Export</h2>

        <ApiEndpoint
          method="POST"
          endpoint="/v1/exports/transactions"
          description="Request an export of transaction data. Requires Idempotency-Key header."
          requestBody={`{
  "from_date": "2026-01-01",
  "to_date": "2026-02-16",
  "format": "csv",
  "transaction_types": ["payment", "refund", "transfer"],
  "status_filter": ["completed", "failed"],
  "include_fees": true
}`}
          response={`{
  "export_id": "exp_001",
  "status": "processing",
  "format": "csv",
  "estimated_completion": "2026-02-16T10:05:00Z",
  "created_at": "2026-02-16T10:00:00Z"
}`}
        />
      </div>

      {/* Check Export Status */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Check Export Status</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/exports/{exportId}"
          description="Check the status of an export request and get the download URL when ready"
          parameters={[
            { name: "exportId", type: "string", required: true, description: "Unique export identifier" }
          ]}
          response={`{
  "export_id": "exp_001",
  "status": "completed",
  "format": "csv",
  "download_url": "https://storage.kangopenbanking.com/exports/exp_001.csv",
  "download_expires_at": "2026-02-17T10:00:00Z",
  "file_size_bytes": 245760,
  "total_records": 1250,
  "created_at": "2026-02-16T10:00:00Z",
  "completed_at": "2026-02-16T10:03:00Z"
}`}
        />
      </div>

      {/* List Exports */}
      <div>
        <h2 className="text-2xl font-bold mb-4">List Exports</h2>

        <ApiEndpoint
          method="GET"
          endpoint="/v1/exports"
          description="List all export requests for the authenticated user or institution"
          parameters={[
            { name: "status", type: "string", required: false, description: "Filter by status (processing, completed, failed)" },
            { name: "limit", type: "integer", required: false, description: "Items per page (default 25, max 100)" },
            { name: "offset", type: "integer", required: false, description: "Number of items to skip" }
          ]}
          response={`{
  "data": [
    {
      "export_id": "exp_001",
      "status": "completed",
      "format": "csv",
      "total_records": 1250,
      "created_at": "2026-02-16T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 25,
    "offset": 0,
    "has_more": false
  }
}`}
        />
      </div>

      {/* Supported Formats */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Export Formats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline">CSV</Badge>
              <span className="text-sm text-muted-foreground">Comma-separated values, ideal for spreadsheet import and data analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">JSON</Badge>
              <span className="text-sm text-muted-foreground">Structured JSON array, suitable for programmatic processing</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">PDF</Badge>
              <span className="text-sm text-muted-foreground">Formatted PDF report with summary statistics, ready for sharing</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        previousPage={{
          title: "Disputes & Chargebacks",
          path: "/developer/api/disputes"
        }}
        nextPage={{
          title: "Risk & Audit APIs",
          path: "/developer/api/risk-audit"
        }}
      />
    </div>
  );
}
