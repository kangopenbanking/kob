import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, RefreshCw, XCircle, Calendar, Shield } from "lucide-react";
import PtpWebhookHealth from "@/components/admin/ptp/PtpWebhookHealth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Promise = {
  id: string;
  user_id: string;
  loan_account_id: string;
  promised_amount: number;
  promised_date: string;
  currency: string;
  status: string;
  kept_amount: number;
  created_at: string;
  profiles?: { email?: string; full_name?: string };
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-900 border-blue-200",
  partially_kept: "bg-amber-100 text-amber-900 border-amber-200",
  kept: "bg-green-100 text-green-900 border-green-200",
  broken: "bg-red-100 text-red-900 border-red-200",
  cancelled: "bg-gray-100 text-gray-900 border-gray-200",
  rescheduled: "bg-purple-100 text-purple-900 border-purple-200",
};

const FN = `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/ptp-admin-ops`;

async function callAdmin(action: string, body: Record<string, unknown> = {}, qs: Record<string, string> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const params = new URLSearchParams({ action, ...qs }).toString();
  const r = await fetch(`${FN}?${params}`, {
    method: action === "list" ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: action === "list" ? undefined : JSON.stringify({ action, ...body }),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error || "request failed");
  return json;
}

export default function PromiseToPayAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Promise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<Promise | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const qs: Record<string, string> = {};
      if (status !== "all") qs.status = status;
      if (search.trim()) qs.search = search.trim();
      if (fromDate) qs.from = fromDate;
      if (toDate) qs.to = toDate;
      const { promises } = await callAdmin("list", {}, qs);
      setRows(promises ?? []);
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openDetail = async (p: Promise) => {
    setSelected(p);
    setDetail(null);
    try {
      const d = await callAdmin("detail", { promise_id: p.id });
      setDetail(d);
    } catch (e: any) {
      toast({ title: "Detail load failed", description: e.message, variant: "destructive" });
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Promise to Pay — Admin</h1>
          <p className="text-sm text-muted-foreground">Search, manage and audit customer promises.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {["scheduled","partially_kept","kept","broken","cancelled","rescheduled"].map(s => (
          <Card key={s} className="border-border/60">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground capitalize">{s.replace("_"," ")}</div>
              <div className="text-2xl font-semibold mt-1">{counts[s] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Promise / loan / user id" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          <div className="md:col-span-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setSearch(""); setStatus("all"); setFromDate(""); setToDate(""); setTimeout(load, 0); }}>Reset</Button>
            <Button onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Promise</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Kept</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(r)}>
                  <TableCell className="font-mono text-xs">{r.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.profiles?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.email ?? r.user_id.slice(0, 8)}</div>
                  </TableCell>
                  <TableCell>{Number(r.promised_amount).toLocaleString()} {r.currency}</TableCell>
                  <TableCell>{Number(r.kept_amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell>{r.promised_date}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[r.status] ?? ""}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "yyyy-MM-dd")}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <RowActions promise={r} onDone={load} />
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">No promises match the filter.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PtpWebhookHealth />

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Promise detail</SheetTitle>
            <SheetDescription className="font-mono text-xs">{selected?.id}</SheetDescription>
          </SheetHeader>
          {!detail && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}
          {detail && (
            <div className="space-y-5 mt-4">
              <Card><CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Customer: </span>{detail.promise.profiles?.email ?? detail.promise.user_id}</div>
                <div><span className="text-muted-foreground">Loan: </span><span className="font-mono text-xs">{detail.promise.loan_account_id.slice(0, 12)}</span></div>
                <div><span className="text-muted-foreground">Amount: </span>{Number(detail.promise.promised_amount).toLocaleString()} {detail.promise.currency}</div>
                <div><span className="text-muted-foreground">Kept: </span>{Number(detail.promise.kept_amount ?? 0).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Due: </span>{detail.promise.promised_date}</div>
                <div><span className="text-muted-foreground">Status: </span><Badge variant="outline" className={STATUS_COLORS[detail.promise.status]}>{detail.promise.status}</Badge></div>
              </CardContent></Card>

              <div>
                <h3 className="text-sm font-semibold mb-2">Promise events</h3>
                <div className="space-y-2">
                  {(detail.events ?? []).map((e: any) => (
                    <div key={e.id} className="border border-border/60 rounded-md p-3 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{e.event_type.replace(/_/g," ")}</span>
                        <span className="text-muted-foreground">{format(new Date(e.created_at), "yyyy-MM-dd HH:mm")}</span>
                      </div>
                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                        <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(e.metadata, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Linked credit events</h3>
                <div className="space-y-2">
                  {(detail.credit_events ?? []).map((c: any) => (
                    <div key={c.id} className="border border-border/60 rounded-md p-3 text-xs flex justify-between">
                      <span className="font-medium">{c.event_type}</span>
                      <span className="text-muted-foreground">{format(new Date(c.created_at), "yyyy-MM-dd")}</span>
                    </div>
                  ))}
                  {(!detail.credit_events || detail.credit_events.length === 0) && <p className="text-xs text-muted-foreground">No credit events for this user.</p>}
                </div>
              </div>

              <OverrideCreditDialog promiseId={detail.promise.id} onDone={() => openDetail(detail.promise)} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RowActions({ promise, onDone }: { promise: Promise; onDone: () => void }) {
  const { toast } = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescOpen, setRescOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [newDate, setNewDate] = useState("");

  const doCancel = async () => {
    try {
      await callAdmin("cancel", { promise_id: promise.id, reason });
      toast({ title: "Promise cancelled" });
      setCancelOpen(false); setReason(""); onDone();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };
  const doResc = async () => {
    if (!newDate) return;
    try {
      await callAdmin("reschedule", { promise_id: promise.id, promised_date: newDate, reason });
      toast({ title: "Promise rescheduled" });
      setRescOpen(false); setReason(""); setNewDate(""); onDone();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  const canCancel = ["scheduled","partially_kept"].includes(promise.status);

  return (
    <div className="flex justify-end gap-1">
      <Dialog open={rescOpen} onOpenChange={setRescOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><Calendar className="h-3.5 w-3.5 mr-1" />Reschedule</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Reschedule promise</DialogTitle>
            <DialogDescription>Move the promised date. An audit row will be written.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>New date</Label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
            <div><Label>Reason</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for admin reschedule" /></div>
          </div>
          <DialogFooter><Button onClick={doResc} disabled={!newDate || !reason}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {canCancel && (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><XCircle className="h-3.5 w-3.5 mr-1" />Cancel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Cancel promise</DialogTitle>
              <DialogDescription>No credit impact applies. Audit row written.</DialogDescription></DialogHeader>
            <div><Label>Reason</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} /></div>
            <DialogFooter><Button variant="destructive" onClick={doCancel} disabled={!reason}>Cancel promise</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function OverrideCreditDialog({ promiseId, onDone }: { promiseId: string; onDone: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState("ptp_kept");
  const [reason, setReason] = useState("");

  const submit = async () => {
    try {
      await callAdmin("override_credit", { promise_id: promiseId, event_type: eventType, reason });
      toast({ title: "Credit event override recorded" });
      setOpen(false); setReason(""); onDone();
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full"><Shield className="h-4 w-4 mr-2" />Override credit event</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Override credit event</DialogTitle>
          <DialogDescription>Insert a manual credit event tied to this promise. All overrides are audited and tagged source = admin_override.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ptp_kept">ptp_kept</SelectItem>
                <SelectItem value="ptp_partial">ptp_partial</SelectItem>
                <SelectItem value="ptp_broken">ptp_broken (reverse)</SelectItem>
                <SelectItem value="ptp_rescheduled">ptp_rescheduled</SelectItem>
                <SelectItem value="admin_credit_reversal">admin_credit_reversal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Reason (required)</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={!reason}>Submit override</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
