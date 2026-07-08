/**
 * Admin KYC Dashboard
 *
 * Search consumers, view Didit session details and recent webhook events,
 * and re-trigger verification when needed. Re-trigger sets the user's
 * kyc_verifications row back to `pending` and drops an in-app notification
 * so the customer sees the "Resume verification" prompt on next launch.
 * All verification traffic continues to flow through unified-kyc-gateway.
 */
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

interface KycRow {
  id: string;
  user_id: string;
  status: string;
  verification_type: string;
  didit_session_id: string | null;
  youverify_session_id: string | null;
  verification_method: string | null;
  document_type: string | null;
  document_country: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  profile?: { full_name: string | null; email: string | null } | null;
}

interface WebhookEvent {
  id: string;
  event_id: string;
  webhook_type: string;
  status: string | null;
  processed: boolean;
  retry_count: number;
  duplicate_count: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
  payload: any;
}

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  approved: "default",
  pending: "secondary",
  manual_review: "secondary",
  rejected: "destructive",
  requires_resubmission: "destructive",
};

export default function AdminKycDashboard() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<KycRow | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [retriggering, setRetriggering] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from("kyc_verifications")
        .select(
          "id,user_id,status,verification_type,didit_session_id,youverify_session_id,verification_method,document_type,document_country,rejection_reason,created_at,updated_at,profile:profiles!kyc_verifications_user_id_profiles_fkey(full_name,email)"
        )
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(50);
      const trimmed = query.trim();
      if (trimmed) {
        // Match by session id or user id directly; otherwise filter profile fields client-side.
        if (/^[0-9a-f-]{20,}$/i.test(trimmed)) {
          q = q.or(`user_id.eq.${trimmed},didit_session_id.eq.${trimmed}`);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      let list = (data ?? []) as unknown as KycRow[];
      if (trimmed && !/^[0-9a-f-]{20,}$/i.test(trimmed)) {
        const needle = trimmed.toLowerCase();
        list = list.filter((r) => {
          const fn = r.profile?.full_name?.toLowerCase() ?? "";
          const em = r.profile?.email?.toLowerCase() ?? "";
          return fn.includes(needle) || em.includes(needle);
        });
      }
      setRows(list);
    } catch (err: any) {
      toast.error(err.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { search(); }, []);

  const openDetails = async (row: KycRow) => {
    setSelected(row);
    setEvents([]);
    if (!row.didit_session_id) return;
    setEventsLoading(true);
    try {
      const { data, error } = await supabase
        .from("didit_webhook_events")
        .select("id,event_id,webhook_type,status,processed,retry_count,duplicate_count,last_error,received_at,processed_at,payload")
        .eq("session_id", row.didit_session_id)
        .order("received_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setEvents((data ?? []) as WebhookEvent[]);
    } catch (err: any) {
      toast.error(err.message ?? "Could not load webhook events");
    } finally {
      setEventsLoading(false);
    }
  };

  const retrigger = async (row: KycRow) => {
    if (!confirm(`Re-trigger Didit verification for ${row.profile?.email ?? row.user_id}? The user will see a "Resume verification" prompt.`)) return;
    setRetriggering(true);
    try {
      const { error: upErr } = await supabase
        .from("kyc_verifications")
        .update({
          status: "pending",
          rejection_reason: "Admin re-triggered verification. Please complete Didit again.",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", row.id);
      if (upErr) throw upErr;

      await supabase.from("app_notifications").insert({
        user_id: row.user_id,
        title: "Resume identity verification",
        message: "Your KOB administrator has asked you to redo identity verification. Tap to resume with Didit.",
        category: "kyc",
        action_url: "/app/kyc/resume",
      } as any);

      toast.success("Verification re-triggered — user notified");
      await search();
    } catch (err: any) {
      toast.error(err.message ?? "Re-trigger failed");
    } finally {
      setRetriggering(false);
    }
  };

  const exportCsv = () => {
    const headers = ["user_id", "email", "name", "status", "type", "didit_session_id", "updated_at"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.user_id, r.profile?.email ?? "", r.profile?.full_name ?? "",
        r.status, r.verification_type, r.didit_session_id ?? "", r.updated_at ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyc-queue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const s = { total: rows.length, approved: 0, pending: 0, rejected: 0, review: 0 };
    rows.forEach((r) => {
      if (r.status === "approved") s.approved++;
      else if (r.status === "rejected" || r.status === "requires_resubmission") s.rejected++;
      else if (r.status === "manual_review") s.review++;
      else s.pending++;
    });
    return s;
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        icon={ShieldCheck}
        title="KYC Dashboard"
        description="Search consumers, review Didit session activity, and re-trigger verifications."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Loaded", stats.total],
          ["Approved", stats.approved],
          ["Pending", stats.pending],
          ["Needs action", stats.rejected + stats.review],
        ].map(([label, value]) => (
          <Card key={label as string}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold">{value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search by name, email, user ID or Didit session ID"
              className="pl-9"
            />
          </div>
          <Button onClick={search} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consumer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Didit session</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No verifications found.
                  </TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const tone = STATUS_TONE[r.status] ?? "outline";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.profile?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.profile?.email ?? r.user_id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell><Badge variant={tone}>{r.status}</Badge></TableCell>
                      <TableCell className="text-sm">{r.verification_type}</TableCell>
                      <TableCell>
                        {r.didit_session_id ? (
                          <code className="rounded bg-muted px-2 py-0.5 text-xs">{r.didit_session_id.slice(0, 12)}…</code>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.updated_at ? format(new Date(r.updated_at), "PP p") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openDetails(r)}>
                          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Details
                        </Button>
                        <Button size="sm" variant="outline" className="ml-2"
                          onClick={() => retrigger(r)} disabled={retriggering}>
                          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Re-trigger
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Session details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-muted-foreground">User</div><div>{selected.profile?.email ?? selected.user_id}</div></div>
                <div><div className="text-xs text-muted-foreground">Status</div><Badge variant={STATUS_TONE[selected.status] ?? "outline"}>{selected.status}</Badge></div>
                <div><div className="text-xs text-muted-foreground">Didit session</div><code className="break-all text-xs">{selected.didit_session_id ?? "—"}</code></div>
                <div><div className="text-xs text-muted-foreground">Method</div><div>{selected.verification_method ?? "—"}</div></div>
                <div><div className="text-xs text-muted-foreground">Document</div><div>{selected.document_type ?? "—"} ({selected.document_country ?? "—"})</div></div>
                <div><div className="text-xs text-muted-foreground">Updated</div><div>{selected.updated_at ? format(new Date(selected.updated_at), "PP p") : "—"}</div></div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Webhook events</div>
                {eventsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                ) : events.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No webhook events recorded for this session.</div>
                ) : (
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Received</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Retries</TableHead>
                          <TableHead>Dup</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {events.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">{format(new Date(e.received_at), "PP p")}</TableCell>
                            <TableCell className="text-xs">{e.webhook_type}</TableCell>
                            <TableCell><Badge variant={e.processed ? "default" : "secondary"}>{e.status ?? (e.processed ? "processed" : "pending")}</Badge></TableCell>
                            <TableCell className="text-xs">{e.retry_count}</TableCell>
                            <TableCell className="text-xs">{e.duplicate_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => retrigger(selected)} disabled={retriggering}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Re-trigger verification
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
