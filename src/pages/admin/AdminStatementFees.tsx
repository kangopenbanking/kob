import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

export default function AdminStatementFees() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FeeSettings | null>(null);
  const [feeAmount, setFeeAmount] = useState("500");
  const [isEnabled, setIsEnabled] = useState(true);
  const [recent, setRecent] = useState<FeeCharge[]>([]);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase.from("statement_fee_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("statement_fee_charges").select("*").order("created_at", { ascending: false }).limit(25),
    ]);
    if (s) {
      setSettings(s as FeeSettings);
      setFeeAmount(String(s.fee_amount));
      setIsEnabled(!!s.is_enabled);
    }
    if (r) setRecent(r as FeeCharge[]);
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
    toast.success("Statement fee settings updated.");
    void load();
  }

  return (
    <div className="space-y-6 p-6">
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
          <CardTitle>Fee configuration</CardTitle>
          <CardDescription>
            Applies to both the Consumers app and the Banking app. Set to disabled or 0 to make statements free.
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
                  <p className="text-xs text-muted-foreground">
                    When off, all statement downloads are free.
                  </p>
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
          <CardTitle>Recent fee charges</CardTitle>
          <CardDescription>Last 25 statement download fee events.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                    No charges recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{new Date(c.created_at).toLocaleString("en-GB")}</TableCell>
                    <TableCell className="capitalize">{c.source}</TableCell>
                    <TableCell className="font-mono text-xs">{c.serial || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(c.amount).toLocaleString()} {c.currency}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status === "charged" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
