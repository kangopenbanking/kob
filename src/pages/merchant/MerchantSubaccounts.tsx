import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, GitBranch, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MerchantSubaccounts() {
  const [subs, setSubs] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ business_name: "", split_type: "percentage", split_value: "", account_bank: "", account_number: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_subaccounts").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setSubs(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!merchantId || !form.business_name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_subaccounts").insert([{
        merchant_id: merchantId,
        subaccount_name: form.business_name,
        split_type: form.split_type,
        split_value: Number(form.split_value) || 0,
        settlement_bank: form.account_bank || null,
        account_number: form.account_number || null,
        is_active: true,
      }]);
      if (error) throw error;
      toast.success("Subaccount created");
      setDialogOpen(false);
      setForm({ business_name: "", split_type: "percentage", split_value: "", account_bank: "", account_number: "" });
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("gateway_subaccounts").update({ is_active: !current }).eq("id", id);
    toast.success(`Subaccount ${current ? "disabled" : "enabled"}`);
    loadData();
  };

  const deleteSubaccount = async (id: string) => {
    await supabase.from("gateway_subaccounts").delete().eq("id", id);
    toast.success("Subaccount deleted");
    loadData();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Subaccounts</h1><p className="text-muted-foreground">Set up split-payment subaccounts for marketplace flows</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Subaccount</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Subaccount</DialogTitle>
              <DialogDescription>Subaccounts receive an automatic split of every transaction</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Business Name *</Label><Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Partner Business" /></div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Split Type</Label>
                  <Select value={form.split_type} onValueChange={v => setForm(f => ({ ...f, split_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="flat">Flat Amount</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Split Value</Label><Input type="number" placeholder={form.split_type === "percentage" ? "e.g., 10" : "e.g., 500"} value={form.split_value} onChange={e => setForm(f => ({ ...f, split_value: e.target.value }))} /></div>
              </div>
              <div className="space-y-2"><Label>Settlement Bank</Label><Input value={form.account_bank} onChange={e => setForm(f => ({ ...f, account_bank: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.business_name}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {subs.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <GitBranch className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No subaccounts yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create subaccounts to split payments automatically with partners</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Name</th><th className="text-left py-3 px-4">Split</th><th className="text-left py-3 px-4">Bank</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Actions</th></tr></thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">{s.subaccount_name || s.id}</td>
                      <td className="py-3 px-4">{s.split_value}{s.split_type === "percentage" ? "%" : " flat"}</td>
                      <td className="py-3 px-4">{s.settlement_bank || "—"}</td>
                      <td className="py-3 px-4"><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(s.id, s.is_active)}>{s.is_active ? "Disable" : "Enable"}</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteSubaccount(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
