import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, FileDown, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const TEMPLATES = [
  { type: "accounts", desc: "Account number, holder name, type, currency, status, opened date", columns: ["account_number", "account_holder_name", "account_type", "currency", "status", "opened_date"] },
  { type: "balances", desc: "Account number, balance type, amount, currency, balance date", columns: ["account_number", "balance_type", "amount", "currency", "balance_date"] },
  { type: "transactions", desc: "Account number, transaction ID, amount, currency, credit/debit, date, description, reference", columns: ["account_number", "transaction_id", "amount", "currency", "credit_debit", "date", "description", "reference"] },
  { type: "beneficiaries", desc: "Account number, beneficiary name, bank code, reference", columns: ["account_number", "beneficiary_name", "bank_code", "reference"] },
];

const COMMON_ERRORS = [
  { error: "Missing required field", fix: "Ensure all required columns have values. Check for empty rows at the end of the file." },
  { error: "Invalid date format", fix: "Use ISO 8601 format (YYYY-MM-DD) or configure a custom date format in your mapping profile." },
  { error: "Duplicate row detected", fix: "The system deduplicates by hash. Remove duplicate entries or update the source data." },
  { error: "Amount parsing error", fix: "Use numeric values without currency symbols. Decimal separator should be a period (.)." },
  { error: "Invalid currency code", fix: "Use ISO 4217 codes (e.g., XAF, EUR, USD). Default is XAF if not specified." },
];

function downloadTemplate(type: string, columns: string[]) {
  const header = columns.join(",");
  const sampleRow = columns.map((c) => {
    if (c === "amount") return "10000";
    if (c === "currency") return "XAF";
    if (c.includes("date")) return "2026-01-15";
    if (c === "credit_debit") return "Credit";
    if (c === "status") return "active";
    if (c === "account_type") return "current";
    return `sample_${c}`;
  }).join(",");
  const csv = `${header}\n${sampleRow}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${type}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConnectorTemplates() {
  const { loading: bankLoading } = useBankConnector();

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={BookOpen} title="Templates & Guides" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={BookOpen} title="Templates & Guides" description="Download CSV templates, view required fields, and troubleshoot common errors" />

      {/* Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATES.map((t) => (
          <Card key={t.type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">{t.type}</CardTitle>
              <CardDescription className="text-xs">{t.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {t.columns.map((c) => (
                  <span key={c} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{c}</span>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate(t.type, t.columns)}>
                <FileDown className="h-4 w-4 mr-2" /> Download Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Common Errors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="h-5 w-5 text-orange-500" /> Common Errors & Fixes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {COMMON_ERRORS.map((e, i) => (
              <div key={i} className="flex gap-3 items-start border-b border-border/50 pb-3 last:border-0">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{e.error}</p>
                  <p className="text-xs text-muted-foreground">{e.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li><strong>Download</strong> the CSV template for your file type</li>
            <li><strong>Fill</strong> the template with your bank's data, ensuring all required fields are present</li>
            <li><strong>Create a mapping profile</strong> if your column names differ from the canonical schema</li>
            <li><strong>Upload</strong> the CSV via the Uploads & Imports page</li>
            <li><strong>Review</strong> the ingestion results — fix any errors and re-upload if needed</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
