// Phase 3 — Admin KYB Review Queue
// Lists submitted/under-review merchants with approve / reject / suspend / reinstate
// actions wired to gateway-merchant-kyb-review (additive suspend/reinstate handlers).
// Notifications are dispatched server-side via notifyUser().
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck, ShieldX, ShieldAlert, RotateCcw, RefreshCw, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

type ActionKind = "approve" | "reject" | "suspend" | "reinstate";

const REASON_CODES: Record<ActionKind, { value: string; label: string }[]> = {
  approve:   [{ value: "documents_verified", label: "Documents verified" }],
  reject:    [
    { value: "documents_unclear",   label: "Documents unclear or unreadable" },
    { value: "name_mismatch",       label: "Name mismatch with registry" },
    { value: "ownership_unverified",label: "Beneficial ownership unverified" },
    { value: "high_risk_industry",  label: "Industry on prohibited list" },
    { value: "fraud_suspected",     label: "Fraud suspected" },
  ],
  suspend:   [
    { value: "compliance_violation",  label: "Compliance / AML violation" },
    { value: "elevated_chargebacks",  label: "Elevated chargebacks" },
    { value: "merchant_request",      label: "Merchant requested" },
    { value: "regulatory_order",      label: "Regulatory order" },
  ],
  reinstate: [{ value: "issue_resolved", label: "Issue resolved" }],
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "secondary", under_review: "secondary", verified: "default",
  rejected: "destructive", VERIFIED: "default", SUSPENDED: "destructive",
};

export default function AdminKybReviewQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("submitted");
  const [active, setActive] = useState<{ row: any; kind: ActionKind } | null>(null);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [reasonText, setReasonText] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);

  useEffect(() => { load(); }, [statusFilter]);

  const isMissingKybTimestampError = (err: any): boolean => {
    if (!err) return false;
    // Postgres "undefined column" code is 42703; PostgREST surfaces it via code/message
    const code = err.code || err?.details?.code;
    const msg = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();
    return code === "42703" || (msg.includes("kyb_submitted_at") || msg.includes("kyb_reviewed_at")) && msg.includes("does not exist");
  };

  const runQuery = async (withKybTimestamps: boolean) => {
    const cols = withKybTimestamps
      ? "id, business_name, status, kyb_status, kyb_submitted_at, kyb_reviewed_at, user_id, created_at, updated_at"
      : "id, business_name, status, kyb_status, user_id, created_at, updated_at";
    let q = supabase.from("gateway_merchants").select(cols).limit(200);
    q = withKybTimestamps
      ? q.order("kyb_submitted_at", { ascending: false, nullsFirst: false })
      : q.order("created_at", { ascending: false });
    if (statusFilter !== "all") q = q.eq("kyb_status", statusFilter);
    return q;
  };

  const load = async () => {
    setLoading(true);
    setSchemaWarning(null);
    let { data, error } = await runQuery(true);
    if (error && isMissingKybTimestampError(error)) {
      // Graceful fallback — KYB timestamp columns missing or migration pending.
      setSchemaWarning(
        "KYB timestamp columns are not available yet (database migration pending). " +
        "Showing review queue with submission/review dates derived from record timestamps. " +
        "Run the latest migration to enable accurate KYB submission tracking."
      );
      const fallback = await runQuery(false);
      data = fallback.data as any;
      error = fallback.error;
    }
    if (error) {
      toast.error(extractEdgeFunctionError(error));
      setRows([]);
    } else {
      // Normalize rows so the UI always has the timestamp keys, falling back to created/updated.
      setRows((data ?? []).map((r: any) => ({
        ...r,
        kyb_submitted_at: r.kyb_submitted_at ?? r.created_at ?? null,
        kyb_reviewed_at: r.kyb_reviewed_at ?? (
          ["verified", "rejected", "VERIFIED", "SUSPENDED"].includes(r.kyb_status) ? r.updated_at : null
        ),
      })));
    }
    setLoading(false);
  };

  const openAction = (row: any, kind: ActionKind) => {
    setActive({ row, kind });
    setReasonCode(REASON_CODES[kind][0]?.value ?? "");
    setReasonText("");
  };

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const { kind, row } = active;
      const fnAction = kind === "approve" || kind === "reject" ? "review" : kind;
      const body: Record<string, unknown> = { action: fnAction, merchant_id: row.id };
      if (kind === "approve" || kind === "reject") {
        body.decision = kind === "approve" ? "approve" : "reject";
        if (kind === "reject") body.reason = reasonText || REASON_CODES.reject.find(r => r.value === reasonCode)?.label || reasonCode;
      } else {
        body.reason_code = reasonCode;
        if (reasonText) body.reason = reasonText;
      }
      const { data, error } = await supabase.functions.invoke("gateway-merchant-kyb-review", { body });
      if (error) throw error;
      if ((data as any)?.title && (data as any)?.status >= 400) throw new Error((data as any).detail);
      toast.success(`Merchant ${kind} successful — owner notified.`);
      setActive(null);
      await load();
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e));
    } finally { setBusy(false); }
  };

  const codes = useMemo(() => active ? REASON_CODES[active.kind] : [], [active]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">KYB review queue</h1>
          <p className="text-muted-foreground">Approve, reject, suspend or reinstate merchant accounts. Each action is audit-logged and notifies the owner.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} merchant{rows.length === 1 ? "" : "s"}</CardTitle>
          <CardDescription>Reason codes are required for suspend and reject actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">No merchants match this filter.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>KYB</TableHead>
                  <TableHead>Account status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.business_name || "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[r.kyb_status] ?? "secondary"}>{r.kyb_status}</Badge></TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.kyb_submitted_at ? format(new Date(r.kyb_submitted_at), "MMM d, yyyy HH:mm") : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {(r.kyb_status === "submitted" || r.kyb_status === "under_review") && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAction(r, "approve")}>
                            <ShieldCheck className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAction(r, "reject")}>
                            <ShieldX className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {r.status !== "SUSPENDED" && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAction(r, "suspend")}>
                          <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                        </Button>
                      )}
                      {r.status === "SUSPENDED" && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openAction(r, "reinstate")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reinstate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active?.kind === "approve" && "Approve KYB"}
              {active?.kind === "reject" && "Reject KYB"}
              {active?.kind === "suspend" && "Suspend merchant"}
              {active?.kind === "reinstate" && "Reinstate merchant"}
            </DialogTitle>
            <DialogDescription>
              {active?.row?.business_name}. The owner will be notified by email and in-app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Reason code</Label>
              <Select value={reasonCode} onValueChange={setReasonCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {codes.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Additional context for the merchant…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
