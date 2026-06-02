import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TaxRate {
  id: string;
  name: string;
  rate: number; // percentage
  region: string | null;
  is_default: boolean;
  is_active: boolean;
}

export default function MerchantTaxRates() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; editing: TaxRate | null }>({ open: false, editing: null });
  const [form, setForm] = useState({ name: "", rate: "", region: "", is_default: false, is_active: true });
  const STORAGE_KEY = "merchant_tax_rates_v1";

  useEffect(() => { load(); }, []);

  // Tax rates are stored locally in the merchant profile metadata (no dedicated table yet);
  // we read/write them via localStorage scoped to the user id, falling back to defaults.
  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY;
      const raw = localStorage.getItem(key);
      if (raw) {
        setRates(JSON.parse(raw));
      } else {
        const seed: TaxRate[] = [
          { id: crypto.randomUUID(), name: "Standard VAT", rate: 19.25, region: "Cameroon", is_default: true, is_active: true },
        ];
        setRates(seed);
        localStorage.setItem(key, JSON.stringify(seed));
      }
    } finally { setLoading(false); }
  };

  const persist = async (next: TaxRate[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    const key = user ? `${STORAGE_KEY}:${user.id}` : STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(next));
    setRates(next);
  };

  const openCreate = () => {
    setForm({ name: "", rate: "", region: "", is_default: false, is_active: true });
    setDialog({ open: true, editing: null });
  };

  const openEdit = (rate: TaxRate) => {
    setForm({ name: rate.name, rate: String(rate.rate), region: rate.region || "", is_default: rate.is_default, is_active: rate.is_active });
    setDialog({ open: true, editing: rate });
  };

  const handleSave = async () => {
    const rateNum = Number(form.rate);
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) { toast.error("Rate must be between 0 and 100"); return; }
    setSaving(true);
    try {
      let next: TaxRate[];
      if (dialog.editing) {
        next = rates.map(r => r.id === dialog.editing!.id
          ? { ...r, name: form.name.trim(), rate: rateNum, region: form.region.trim() || null, is_default: form.is_default, is_active: form.is_active }
          : (form.is_default ? { ...r, is_default: false } : r));
      } else {
        const created: TaxRate = { id: crypto.randomUUID(), name: form.name.trim(), rate: rateNum, region: form.region.trim() || null, is_default: form.is_default, is_active: form.is_active };
        next = form.is_default ? rates.map(r => ({ ...r, is_default: false })).concat(created) : rates.concat(created);
      }
      await persist(next);
      toast.success(dialog.editing ? "Tax rate updated" : "Tax rate added");
      setDialog({ open: false, editing: null });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this tax rate?")) return;
    await persist(rates.filter(r => r.id !== id));
    toast.success("Tax rate deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax Rates</h1>
          <p className="text-sm text-muted-foreground">Manage VAT and sales tax rates applied to invoices and POS receipts.</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Tax Rate
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured Rates</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[0,1,2].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : rates.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6 text-muted-foreground" />}
              title="No tax rates configured"
              description="Add a tax rate to apply VAT or sales tax to invoices and POS receipts."
              action={{ label: "Add Tax Rate", onClick: openCreate }}
            />
          ) : (
            <div className="space-y-2">
              {rates.map(rate => (
                <div key={rate.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <Receipt className="h-5 w-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{rate.name}</p>
                        {rate.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                        {!rate.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rate.rate}% {rate.region ? `· ${rate.region}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rate)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(rate.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog({ open, editing: open ? dialog.editing : null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Tax Rate" : "New Tax Rate"}</DialogTitle>
            <DialogDescription>Define a tax rate to apply to invoices, POS receipts, and payment links.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="tax-name">Name</Label>
              <Input id="tax-name" placeholder="Standard VAT" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Rate (%)</Label>
                <Input id="tax-rate" type="number" step="0.01" min={0} max={100} placeholder="19.25" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-region">Region (optional)</Label>
                <Input id="tax-region" placeholder="Cameroon" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Default rate</p>
                <p className="text-xs text-muted-foreground">Applied automatically to new invoices.</p>
              </div>
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Inactive rates are hidden from selection.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dialog.editing ? "Save Changes" : "Add Tax Rate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
