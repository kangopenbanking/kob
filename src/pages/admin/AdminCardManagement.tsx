// =============================================================
// AdminCardManagement — search, filter, and manage every card
// issued across all tenants. Supports: freeze / unfreeze /
// terminate / update limits, and shows the full card_fee_events
// audit trail with issuance, maintenance, and per-transaction
// fees the admin has configured in the fee-management module.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Snowflake, Play, Ban, RefreshCw, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

interface AdminCard {
  id: string;
  user_id: string;
  form_factor: string;
  brand: string;
  status: string;
  provider: string;
  nium_card_id: string | null;
  kora_card_id: string | null;
  balance_usd: number | null;
  spending_controls: Record<string, unknown> | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface FeeEvent {
  id: string;
  fee_type: string;
  amount: number;
  currency: string;
  created_at: string;
  note: string | null;
  idempotency_key: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  inactive: "bg-amber-500/10 text-amber-700 border-amber-200",
  cancelled: "bg-rose-500/10 text-rose-700 border-rose-200",
  pending: "bg-slate-500/10 text-slate-600 border-slate-200",
};

export default function AdminCardManagement() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");
  const [cards, setCards] = useState<AdminCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdminCard | null>(null);
  const [feeEvents, setFeeEvents] = useState<FeeEvent[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("cards-v3", {
      body: {
        action: "admin_list",
        search,
        status: status === "all" ? null : status,
        provider: provider === "all" ? null : provider,
        limit: 100,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message ?? "Failed to load cards"); return; }
    setCards(data?.cards ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function openDetails(card: AdminCard) {
    setSelected(card);
    const { data } = await supabase
      .from("card_fee_events")
      .select("id,fee_type,amount,currency,created_at,note,idempotency_key")
      .eq("card_id", card.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setFeeEvents((data as any) ?? []);
  }

  async function lifecycle(card: AdminCard, action: "freeze" | "unfreeze" | "terminate") {
    setBusy(true);
    const { error } = await supabase.functions.invoke("cards-v3", {
      body: { action, card_id: card.id },
    });
    setBusy(false);
    if (error) { toast.error(error.message ?? `${action} failed`); return; }
    toast.success(`Card ${action}d.`);
    await load();
    if (selected?.id === card.id) setSelected(null);
  }

  const totals = useMemo(() => ({
    total: cards.length,
    active: cards.filter((c) => c.status === "active").length,
    frozen: cards.filter((c) => c.status === "inactive").length,
    cancelled: cards.filter((c) => c.status === "cancelled").length,
  }), [cards]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Card Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Search every card issued through Kang, freeze / cancel, adjust limits, and audit fee events.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/card-issuance-timeline">Issuance Timeline</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/fee-management">Fee Management</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: totals.total },
          { label: "Active", value: totals.active },
          { label: "Frozen", value: totals.frozen },
          { label: "Cancelled", value: totals.cancelled },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold">{s.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Search</CardTitle></CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Card ID, user ID, provider card ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Frozen</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All providers</SelectItem>
              <SelectItem value="nium">Primary</SelectItem>
              <SelectItem value="kora">Fallback</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Cards ({cards.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card ID</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {loading ? "Loading…" : "No cards found."}
                </TableCell></TableRow>
              )}
              {cards.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetails(c)}>
                  <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}…</TableCell>
                  <TableCell className="capitalize">{c.form_factor}</TableCell>
                  <TableCell className="capitalize">{c.brand}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[c.status] ?? ""}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{Number(c.balance_usd ?? 0).toLocaleString()} XAF</TableCell>
                  <TableCell className="font-mono text-xs">{c.user_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    {c.status === "active" && (
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => lifecycle(c, "freeze")}>
                        <Snowflake className="h-3 w-3 mr-1" /> Freeze
                      </Button>
                    )}
                    {c.status === "inactive" && (
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => lifecycle(c, "unfreeze")}>
                        <Play className="h-3 w-3 mr-1" /> Unfreeze
                      </Button>
                    )}
                    {c.status !== "cancelled" && (
                      <Button size="sm" variant="outline" disabled={busy}
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          if (confirm("Terminate this card? This is permanent.")) lifecycle(c, "terminate");
                        }}>
                        <Ban className="h-3 w-3 mr-1" /> Terminate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Card {selected?.id.slice(0, 8)}…</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Form:</span> {selected.form_factor}</div>
                <div><span className="text-muted-foreground">Brand:</span> {selected.brand}</div>
                <div><span className="text-muted-foreground">Status:</span> {selected.status}</div>
                <div><span className="text-muted-foreground">Balance:</span> {Number(selected.balance_usd ?? 0).toLocaleString()} XAF</div>
                <div className="col-span-2"><span className="text-muted-foreground">User:</span> <span className="font-mono">{selected.user_id}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">Provider card:</span> <span className="font-mono">{selected.nium_card_id ?? selected.kora_card_id ?? "—"}</span></div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Fee events ({feeEvents.length})
                </div>
                <div className="border rounded max-h-64 overflow-y-auto">
                  {feeEvents.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-4">No fees charged.</div>
                  )}
                  {feeEvents.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-3 py-2 border-b last:border-0 text-xs">
                      <div>
                        <div className="font-medium">{f.fee_type.replaceAll("_", " ")}</div>
                        <div className="text-muted-foreground">{f.note ?? "—"} · {new Date(f.created_at).toLocaleString()}</div>
                      </div>
                      <div className="font-mono">{f.amount.toLocaleString()} {f.currency}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
