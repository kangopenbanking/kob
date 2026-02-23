import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Building2, Smartphone, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

export default function MerchantSettlementAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ account_type: "bank_account", bank_name: "", account_number: "", account_name: "", momo_number: "", momo_provider: "", currency: "XAF" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_merchant_settlement_accounts").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_merchant_settlement_accounts").insert({
        merchant_id: merchantId,
        account_type: form.account_type,
        bank_name: form.account_type === "bank_account" ? form.bank_name : null,
        account_number: form.account_type === "bank_account" ? form.account_number : null,
        account_name: form.account_name || null,
        momo_number: form.account_type === "mobile_money" ? form.momo_number : null,
        momo_provider: form.account_type === "mobile_money" ? form.momo_provider : null,
        currency: form.currency,
        is_default: accounts.length === 0,
      });
      if (error) throw error;
      toast.success("Settlement account added");
      setDialogOpen(false);
      setForm({ account_type: "bank_account", bank_name: "", account_number: "", account_name: "", momo_number: "", momo_provider: "", currency: "XAF" });
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const setDefault = async (id: string) => {
    if (!merchantId) return;
    await supabase.from("gateway_merchant_settlement_accounts").update({ is_default: false }).eq("merchant_id", merchantId);
    await supabase.from("gateway_merchant_settlement_accounts").update({ is_default: true }).eq("id", id);
    toast.success("Default account updated");
    loadData();
  };

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from("gateway_merchant_settlement_accounts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Account removed"); loadData(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Settlement Accounts</h1><p className="text-muted-foreground">Manage bank accounts and mobile money for payouts</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Account</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Settlement Account</DialogTitle>
              <DialogDescription>Add a bank account or mobile money number for receiving payouts</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">Bank Account</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.account_type === "bank_account" ? (
                <>
                  <div className="space-y-2"><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g., Afriland First Bank" /></div>
                  <div className="space-y-2"><Label>Account Number</Label><Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Account Holder Name</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Provider</Label>
                    <Select value={form.momo_provider} onValueChange={v => setForm(f => ({ ...f, momo_provider: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mtn">MTN Mobile Money</SelectItem>
                        <SelectItem value="orange">Orange Money</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Phone Number</Label><Input value={form.momo_number} onChange={e => setForm(f => ({ ...f, momo_number: e.target.value }))} placeholder="+237 6XX XXX XXX" /></div>
                  <div className="space-y-2"><Label>Account Name</Label><Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} /></div>
                </>
              )}
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem><SelectItem value="XOF">XOF</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem><SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No settlement accounts configured</p>
          <p className="text-sm text-muted-foreground mt-1">Add a bank account or mobile money to receive your payouts</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map(a => (
            <Card key={a.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {a.account_type === "mobile_money" ? <Smartphone className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    <CardTitle className="text-base">{a.account_name || a.bank_name || "Account"}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.is_default && <Badge>Default</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Type:</span> {a.account_type === "mobile_money" ? "Mobile Money" : "Bank Account"}</p>
                  {a.bank_name && <p><span className="text-muted-foreground">Bank:</span> {a.bank_name}</p>}
                  {a.account_number && <p><span className="text-muted-foreground">Account:</span> ****{a.account_number?.slice(-4)}</p>}
                  {a.momo_number && <p><span className="text-muted-foreground">MoMo:</span> {a.momo_number}</p>}
                  {a.momo_provider && <p><span className="text-muted-foreground">Provider:</span> {a.momo_provider.toUpperCase()}</p>}
                  <p><span className="text-muted-foreground">Currency:</span> {a.currency}</p>
                </div>
                <div className="flex gap-2">
                  {!a.is_default && <Button variant="outline" size="sm" className="gap-1" onClick={() => setDefault(a.id)}><Star className="h-3 w-3" /> Set Default</Button>}
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteAccount(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
