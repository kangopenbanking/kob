// PERMANENT ADMIN ROUTE — QR Payments Audit
// Surfaces qr_card_payments joined with the qr_payment_idempotency replay
// cache so support/admin staff can inspect:
//   - request_hash + idempotency expiry
//   - merchant details (key/name/country/MCC, internal vs external)
//   - PISP consent / payment IDs and final status
//   - cancellation timestamp + actor
//
// Read-only. Backed by the SECURITY INVOKER view + RPC
// public.get_admin_qr_payments_audit().
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AuditRow {
  qr_payment_id: string;
  user_id: string | null;
  pisp_payment_id: string | null;
  source: string | null;
  partner_client_id: string | null;
  partner_cardholder_ref: string | null;
  partner_card_token_id: string | null;
  merchant_name: string | null;
  merchant_id: string | null;
  merchant_external: boolean;
  merchant_country: string | null;
  merchant_category_code: string | null;
  merchant_key: string | null;
  amount: number;
  currency: string;
  status: string;
  failure_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  idempotency_key: string;
  request_hash: string | null;
  idempotency_response_status: number | null;
  idempotency_expires_at: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  pending: "secondary",
  failed: "destructive",
  refunded: "outline",
  cancelled: "outline",
};

export default function QRPaymentsAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    // Use the RPC wrapper which enforces admin role server-side.
    const { data, error } = await supabase.rpc("get_admin_qr_payments_audit");
    if (error) setError(error.message);
    setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.merchant_name, r.merchant_key, r.pisp_payment_id, r.idempotency_key, r.request_hash, r.status, r.source, r.partner_client_id]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <ScrollText className="h-7 w-7 text-primary" />
            QR Payments Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Read-only audit of every QR-initiated card payment, joined with its idempotency replay record.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>Search merchant, PISP id, idempotency key, request hash, or status.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="e.g. mer_kob_demo, pay_abc123, 7c8e2f4a-..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Loading…" : `${filtered.length} entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>PISP Payment</TableHead>
                <TableHead>Idempotency Key</TableHead>
                <TableHead>Request Hash</TableHead>
                <TableHead>Cancelled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.qr_payment_id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>
                      {r.status}
                    </Badge>
                    {r.failure_reason && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate" title={r.failure_reason}>
                        {r.failure_reason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.source === 'partner' ? 'outline' : 'secondary'}>
                      {r.source === 'partner' ? `partner:${r.partner_client_id ?? '?'}` : 'user'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.merchant_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.merchant_key} · {r.merchant_country ?? "?"} · MCC {r.merchant_category_code ?? "—"}
                    </div>
                    <Badge variant={r.merchant_external ? "outline" : "secondary"} className="mt-1">
                      {r.merchant_external ? "external" : "internal"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {r.amount.toLocaleString()} {r.currency}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.pisp_payment_id ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.idempotency_key}</TableCell>
                  <TableCell className="font-mono text-xs max-w-[160px] truncate" title={r.request_hash ?? ""}>
                    {r.request_hash ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {r.cancelled_at ? new Date(r.cancelled_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    No QR payments found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
