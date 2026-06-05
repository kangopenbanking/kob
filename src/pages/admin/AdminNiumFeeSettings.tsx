// Admin settings screen — Nium FX spread + MoMo withdrawal fee management.
// Edits are routed through edge function `admin-update-nium-fees` which writes
// audit_logs entries (entity_type='fee_structure_nium') for the change history.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, History, Percent } from "lucide-react";
import { toast } from "sonner";

interface FeeRow {
  id: string;
  transaction_type: string;
  percentage_rate: number | null;
  fixed_amount: number | null;
  min_fee_amount: number | null;
  max_fee_amount: number | null;
  effective_from: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  created_at: string;
  performed_by: string | null;
  details: any;
}

export default function AdminNiumFeeSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fxSpread, setFxSpread] = useState("0.75");           // %
  const [momoFixed, setMomoFixed] = useState("100");
  const [momoPct, setMomoPct] = useState("1.0");              // %
  const [momoMin, setMomoMin] = useState("200");
  const [momoMax, setMomoMax] = useState("");                 // blank = no cap
  const [reason, setReason] = useState("");
  const [current, setCurrent] = useState<Record<string, FeeRow | null>>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);

  async function load() {
    setLoading(true);
    const [{ data: fees }, { data: logs }] = await Promise.all([
      supabase.from("fee_structures").select("*")
        .in("transaction_type", ["nium_fx_spread", "nium_withdrawal"])
        .eq("fee_scope", "platform").eq("is_active", true),
      supabase.from("audit_logs").select("id, created_at, performed_by, details")
        .eq("entity_type", "fee_structure_nium").order("created_at", { ascending: false }).limit(50),
    ]);
    const byType: Record<string, FeeRow | null> = { nium_fx_spread: null, nium_withdrawal: null };
    (fees ?? []).forEach((r: any) => { byType[r.transaction_type] = r; });
    setCurrent(byType);
    if (byType.nium_fx_spread?.percentage_rate != null) {
      setFxSpread((Number(byType.nium_fx_spread.percentage_rate) * 100).toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
    }
    const mw = byType.nium_withdrawal;
    if (mw) {
      if (mw.fixed_amount != null) setMomoFixed(String(mw.fixed_amount));
      if (mw.percentage_rate != null) setMomoPct((Number(mw.percentage_rate) * 100).toString());
      if (mw.min_fee_amount != null) setMomoMin(String(mw.min_fee_amount));
      if (mw.max_fee_amount != null) setMomoMax(String(mw.max_fee_amount));
    }
    setAudit((logs ?? []) as AuditRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    setSaving(true);
    const body = {
      fx_spread_percentage: Number(fxSpread) / 100,
      momo_fixed_amount: Number(momoFixed),
      momo_percentage_rate: Number(momoPct) / 100,
      momo_min_fee_amount: Number(momoMin),
      momo_max_fee_amount: momoMax.trim() === "" ? null : Number(momoMax),
      reason: reason.trim() || null,
    };
    const { data, error } = await supabase.functions.invoke("admin-update-nium-fees", { body });
    setSaving(false);
    if (error || (data && (data as any).error)) {
      toast.error((data as any)?.message || error?.message || "Update failed");
      return;
    }
    toast.success("Nium fee parameters updated");
    setReason("");
    await load();
  }

  const fxBps = useMemo(() => Math.round((Number(fxSpread) || 0) * 100), [fxSpread]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nium Fee Management</h1>
        <p className="text-sm text-muted-foreground">
          Platform FX spread and Mobile Money withdrawal fee for Nium global accounts. All edits are audit-logged.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Percent className="h-4 w-4" /> Platform FX Spread</CardTitle>
          <CardDescription>
            Added on top of Nium's mid-market rate. Currently <Badge variant="secondary">{fxBps} bps</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fx">Spread (%)</Label>
            <Input id="fx" type="number" step="0.01" min="0" max="10" value={fxSpread} onChange={(e) => setFxSpread(e.target.value)} disabled={loading} />
            <p className="text-xs text-muted-foreground">Stored as decimal. 0.75 = 75 bps.</p>
          </div>
          <div className="space-y-2">
            <Label>Current effective from</Label>
            <div className="text-sm">
              {current.nium_fx_spread?.effective_from ?? "—"} ·
              {" "}{current.nium_fx_spread ? `${(Number(current.nium_fx_spread.percentage_rate) * 10000).toFixed(0)} bps` : "default 75 bps"}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mobile Money Withdrawal Fee</CardTitle>
          <CardDescription>Applied only when payout cascade routes incoming Nium funds to MoMo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="fix">Fixed (XAF)</Label>
            <Input id="fix" type="number" min="0" value={momoFixed} onChange={(e) => setMomoFixed(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pct">Percentage (%)</Label>
            <Input id="pct" type="number" step="0.01" min="0" max="20" value={momoPct} onChange={(e) => setMomoPct(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min">Minimum (XAF)</Label>
            <Input id="min" type="number" min="0" value={momoMin} onChange={(e) => setMomoMin(e.target.value)} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max">Maximum cap (XAF, blank = none)</Label>
            <Input id="max" type="number" min="0" value={momoMax} onChange={(e) => setMomoMax(e.target.value)} disabled={loading} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reason for change</CardTitle>
          <CardDescription>Recorded in the audit log alongside before/after values.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Q3 pricing review, BEAC margin alignment…" />
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Change history</CardTitle>
          <CardDescription>Last 50 edits.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Parameter</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No changes yet.</TableCell></TableRow>
              )}
              {audit.map((row) => {
                const d = row.details ?? {};
                const before = d.before ?? {};
                const after = d.after ?? {};
                const summary = (o: any) =>
                  d.transaction_type === "nium_fx_spread"
                    ? `${(Number(o?.percentage_rate ?? 0) * 10000).toFixed(0)} bps`
                    : `fixed ${o?.fixed_amount ?? "?"} XAF · ${(Number(o?.percentage_rate ?? 0) * 100).toFixed(2)}% · min ${o?.min_fee_amount ?? "?"}`;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{d.transaction_type}</Badge></TableCell>
                    <TableCell className="text-xs">{summary(before)}</TableCell>
                    <TableCell className="text-xs">{summary(after)}</TableCell>
                    <TableCell className="text-xs">{d.reason ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
