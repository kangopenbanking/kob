import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FeeSettings {
  fee_amount: number;
  currency: string;
  is_enabled: boolean;
  updated_at: string;
}

interface FeeCharge {
  id: string;
  user_id: string;
  source: string;
  serial: string | null;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  idempotency_key: string | null;
}

interface FeeOverride {
  id: string;
  app_source: "customer" | "banking";
  institution_type: string | null;
  fee_amount: number;
  currency: string;
  is_enabled: boolean;
  is_free: boolean;
  updated_at: string;
}

const APP_OPTIONS = [
  { value: "customer", label: "Consumers app" },
  { value: "banking", label: "Banking app" },
];

export default function AdminStatementFees() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [feeAmount, setFeeAmount] = useState("500");
  const [isEnabled, setIsEnabled] = useState(true);
  const [recent, setRecent] = useState<FeeCharge[]>([]);
  const [overrides, setOverrides] = useState<FeeOverride[]>([]);
  const [institutionTypes, setInstitutionTypes] = useState<string[]>([]);

  // New override draft
  const [draftApp, setDraftApp] = useState<"customer" | "banking">("customer");
  const [draftInstType, setDraftInstType] = useState<string>("__all__");
  const [draftAmount, setDraftAmount] = useState("500");
  const [draftCurrency, setDraftCurrency] = useState("XAF");
  const [draftFree, setDraftFree] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: r }, { data: o }, { data: t }] = await Promise.all([
      supabase.from("statement_fee_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("statement_fee_charges").select("*").order("created_at", { ascending: false }).limit(25),
      supabase.from("statement_fee_overrides").select("*").order("app_source").order("institution_type"),
      supabase.from("institutions").select("institution_type").not("institution_type", "is", null),
    ]);
    if (s) {
      setSettings(s as FeeSettings);
      setFeeAmount(String(s.fee_amount));
      setIsEnabled(!!s.is_enabled);
    }
    if (r) setRecent(r as FeeCharge[]);
    if (o) setOverrides(o as FeeOverride[]);
    if (t) {
      const uniq = Array.from(new Set((t as Array<{ institution_type: string }>).map((x) => x.institution_type).filter(Boolean)));
      setInstitutionTypes(uniq);
    }
    setLoading(false);
  }

  async function save() {
    const n = Number(feeAmount);
    if (Number.isNaN(n) || n < 0) {
      toast.error("Enter a valid non-negative fee amount.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("statement_fee_settings")
      .update({ fee_amount: n, is_enabled: isEnabled, updated_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", true);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Global statement fee updated.");
    void load();
  }

  async function addOverride() {
    const n = Number(draftAmount);
    if (!draftFree && (Number.isNaN(n) || n < 0)) {
      toast.error("Enter a valid non-negative fee amount.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      app_source: draftApp,
      institution_type: draftInstType === "__all__" ? null : draftInstType,
      fee_amount: draftFree ? 0 : n,
      currency: draftCurrency || "XAF",
      is_free: draftFree,
      is_enabled: true,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("statement_fee_overrides")
      .upsert(payload, { onConflict: "app_source,institution_type" });
    if (error) { toast.error(error.message); return; }
    toast.success("Fee override saved.");
    setDraftAmount("500"); setDraftFree(false);
    void load();
  }

  async function toggleOverrideEnabled(o: FeeOverride, next: boolean) {
    const { error } = await supabase
      .from("statement_fee_overrides")
      .update({ is_enabled: next, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    if (error) { toast.error(error.message); return; }
    void load();
  }

  async function deleteOverride(id: string) {
    const { error } = await supabase.from("statement_fee_overrides").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Override removed.");
    void load();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Statement download fees
        </h1>
        <p className="text-muted-foreground text-sm">
          Set the fee charged when a customer downloads a statement PDF. Viewing previews is always free.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global default</CardTitle>
          <CardDescription>
            Used when no app- or institution-type override matches. Disable or set to 0 to make all downloads free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border p-4">
                <div>
                  <p className="font-semibold">Charge a fee per download</p>
                  <p className="text-xs text-muted-foreground">When off, all statement downloads are free.</p>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fee-amount">Fee amount</Label>
                  <Input
                    id="fee-amount"
                    type="number"
                    min={0}
                    step={1}
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    disabled={!isEnabled}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={settings?.currency || "XAF"} disabled />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Last updated: {settings ? new Date(settings.updated_at).toLocaleString("en-GB") : "—"}
                </p>
                <Button onClick={save} disabled={saving} className="gap-2 rounded-xl">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-app & per-institution-type overrides</CardTitle>
          <CardDescription>
            Override the global default for a specific app, and optionally for a specific institution type. Most specific match wins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 rounded-xl border p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">App</Label>
              <Select value={draftApp} onValueChange={(v) => setDraftApp(v as "customer" | "banking")}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Institution type</Label>
              <Select value={draftInstType} onValueChange={setDraftInstType}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  {institutionTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fee amount</Label>
              <Input
                type="number" min={0} step={1}
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                disabled={draftFree}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Input value={draftCurrency} onChange={(e) => setDraftCurrency(e.target.value.toUpperCase())} />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 items-center justify-between rounded-xl border px-3 py-2">
                <Label className="text-xs">Free</Label>
                <Switch checked={draftFree} onCheckedChange={setDraftFree} />
              </div>
              <Button onClick={addOverride} className="gap-2 rounded-xl">
                <Plus className="h-4 w-4" /> Save
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Institution type</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No overrides yet. Global default applies to all downloads.
                  </TableCell>
                </TableRow>
              ) : overrides.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="capitalize">{o.app_source === "customer" ? "Consumers" : "Banking"}</TableCell>
                  <TableCell className="text-xs">{o.institution_type || "All types"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {o.is_free ? "Free" : `${Number(o.fee_amount).toLocaleString()} ${o.currency}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={o.is_free ? "secondary" : "default"}>
                      {o.is_free ? "Free" : "Paid"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={o.is_enabled} onCheckedChange={(v) => toggleOverrideEnabled(o, v)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => deleteOverride(o.id)} className="gap-1">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent fee charges</CardTitle>
          <CardDescription>Last 25 statement download fee events. Idempotency key shown when present.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Idem. key</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                    No charges recorded yet.
                  </TableCell>
                </TableRow>
              ) : recent.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{new Date(c.created_at).toLocaleString("en-GB")}</TableCell>
                  <TableCell className="capitalize">{c.source}</TableCell>
                  <TableCell className="font-mono text-xs">{c.serial || "—"}</TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {c.idempotency_key ? c.idempotency_key.slice(0, 8) + "…" : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {Number(c.amount).toLocaleString()} {c.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === "charged" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
