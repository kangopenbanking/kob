import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Receipt, Store, MapPin, Package, BarChart3, Plus, Pencil, Trash2, Eye, ToggleLeft, ChevronRight, Wallet, Building2, Smartphone, CreditCard, Globe, Star } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const invoke = async (action: string, body: Record<string, any> = {}) => {
  const { data, error } = await supabase.functions.invoke("api-bills-v2", {
    body: { action, ...body },
  });
  if (error) {
    let msg = error.message || "Request failed";
    try {
      const ctx = typeof error.context?.body === "string" ? JSON.parse(error.context.body) : error.context?.body;
      if (ctx?.error) msg = ctx.error;
    } catch {}
    throw new Error(msg);
  }
  return data;
};

// ─── Stats Overview ───
function BillStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-bill-stats"],
    queryFn: () => invoke("admin_bill_stats"),
  });

  const stats = [
    { label: "Categories", value: data?.categories ?? 0, icon: BarChart3, color: "bg-primary/10 text-primary" },
    { label: "Providers", value: data?.providers ?? 0, icon: Store, color: "bg-blue-500/10 text-blue-600" },
    { label: "Total Payments", value: data?.total_payments ?? 0, icon: Receipt, color: "bg-green-500/10 text-green-600" },
    { label: "Total Volume (XAF)", value: Number(data?.total_volume ?? 0).toLocaleString(), icon: BarChart3, color: "bg-amber-500/10 text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              {isLoading ? <Skeleton className="h-6 w-16" /> : <p className="text-xl font-bold">{s.value}</p>}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Categories Tab ───
function CategoriesTab() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-bill-categories"],
    queryFn: () => invoke("admin_list_categories"),
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: any) => invoke("admin_upsert_category", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bill-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-bill-stats"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Category saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke("admin_delete_category", { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bill-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-bill-stats"] });
      toast({ title: "Category deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    upsertMutation.mutate({
      id: editItem?.id,
      name: fd.get("name") as string,
      slug: fd.get("slug") as string,
      icon: fd.get("icon") as string,
      color: fd.get("color") as string,
      description: fd.get("description") as string,
      sort_order: Number(fd.get("sort_order")) || 0,
      is_active: editItem ? editItem.is_active : true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bill Categories</h3>
        <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditItem(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditItem(null)}><Plus className="h-4 w-4 mr-1" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Name</Label><Input name="name" defaultValue={editItem?.name} required /></div>
              <div><Label>Slug</Label><Input name="slug" defaultValue={editItem?.slug} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Icon</Label><Input name="icon" defaultValue={editItem?.icon || "receipt"} /></div>
                <div><Label>Color</Label><Input name="color" defaultValue={editItem?.color || "#3B82F6"} /></div>
              </div>
              <div><Label>Description</Label><Textarea name="description" defaultValue={editItem?.description} rows={2} /></div>
              <div><Label>Sort Order</Label><Input name="sort_order" type="number" defaultValue={editItem?.sort_order || 0} /></div>
              <Button type="submit" disabled={upsertMutation.isPending} className="w-full">
                {upsertMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Icon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : (categories || []).map((cat: any) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell className="text-muted-foreground">{cat.slug}</TableCell>
                <TableCell>{cat.icon}</TableCell>
                <TableCell><Badge variant={cat.is_active ? "default" : "secondary"}>{cat.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell>{cat.sort_order}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditItem(cat); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete category?")) deleteMutation.mutate(cat.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Providers Tab ───
function ProvidersTab() {
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: categories } = useQuery({
    queryKey: ["admin-bill-categories"],
    queryFn: () => invoke("admin_list_categories"),
  });

  const { data: providersResp, isLoading } = useQuery({
    queryKey: ["admin-bill-providers", filterCategory],
    queryFn: () => invoke("admin_list_providers", { category_id: filterCategory === "all" ? undefined : filterCategory, limit: 100 }),
  });
  const providers = providersResp?.data || [];

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => invoke("admin_toggle_provider", { id, is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bill-providers"] });
      toast({ title: "Provider updated" });
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: any) => invoke("admin_upsert_provider", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bill-providers"] });
      qc.invalidateQueries({ queryKey: ["admin-bill-stats"] });
      setEditOpen(false);
      setEditItem(null);
      toast({ title: "Provider saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    upsertMutation.mutate({
      id: editItem?.id,
      name: fd.get("name") as string,
      short_name: fd.get("short_name") as string,
      category_id: fd.get("category_id") as string,
      icon: fd.get("icon") as string || "building",
      description: fd.get("description") as string,
      country: "CM",
      is_active: editItem ? editItem.is_active : true,
    });
  };

  if (selectedProvider) {
    return <ProviderDetail provider={selectedProvider} onBack={() => setSelectedProvider(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="flex gap-2 items-center">
          <h3 className="text-lg font-semibold">Bill Providers</h3>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditItem(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditItem(null)}><Plus className="h-4 w-4 mr-1" /> Add Provider</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editItem ? "Edit Provider" : "New Provider"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Name</Label><Input name="name" defaultValue={editItem?.name} required /></div>
              <div><Label>Short Name</Label><Input name="short_name" defaultValue={editItem?.short_name} /></div>
              <div><Label>Category</Label>
                <Select name="category_id" defaultValue={editItem?.category_id}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {(categories || []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Icon</Label><Input name="icon" defaultValue={editItem?.icon || "building"} /></div>
                <div><Label>Contact Email</Label><Input name="contact_email" type="email" defaultValue={editItem?.contact_email} /></div>
              </div>
              <div><Label>Contact Phone</Label><Input name="contact_phone" defaultValue={editItem?.contact_phone} /></div>
              <div><Label>Description</Label><Textarea name="description" defaultValue={editItem?.description} rows={2} /></div>
              <p className="text-xs text-muted-foreground">Settlement accounts are managed in the provider detail view after creation.</p>
              <Button type="submit" disabled={upsertMutation.isPending} className="w-full">
                {upsertMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Settlement</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : providers.map((prov: any) => (
              <TableRow key={prov.id} className="cursor-pointer" onClick={() => setSelectedProvider(prov)}>
                <TableCell className="font-medium">{prov.name}</TableCell>
                <TableCell className="text-muted-foreground">{prov.bill_categories?.name || "—"}</TableCell>
                <TableCell><Badge variant="outline">{prov.settlement_type || "—"}</Badge></TableCell>
                <TableCell>
                  <Switch checked={prov.is_active} onCheckedChange={(v) => { toggleMutation.mutate({ id: prov.id, is_active: v }); }} onClick={(e) => e.stopPropagation()} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditItem(prov); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <ChevronRight className="h-4 w-4 inline text-muted-foreground ml-1" />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && providers.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No providers found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Settlement Accounts Card ───
const SETTLEMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
  { value: "kang_wallet", label: "Kang Wallet", icon: Wallet },
  { value: "paypal", label: "PayPal", icon: Globe },
  { value: "card", label: "Card (Visa Direct / MC Send)", icon: CreditCard },
  { value: "rtgs_wire", label: "RTGS / Wire", icon: Building2 },
] as const;

function SettlementAccountsCard({ providerId }: { providerId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [method, setMethod] = useState<string>("bank_transfer");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-bill-settlement-accounts", providerId],
    queryFn: () => invoke("admin_list_settlement_accounts", { provider_id: providerId }),
  });

  const upsertMutation = useMutation({
    mutationFn: (payload: any) => invoke("admin_upsert_settlement_account", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-settlement-accounts", providerId] }); setDialogOpen(false); setEditAccount(null); toast({ title: "Settlement account saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoke("admin_delete_settlement_account", { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-settlement-accounts", providerId] }); toast({ title: "Settlement account deleted" }); },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      id: editAccount?.id,
      provider_id: providerId,
      method,
      label: fd.get("label") as string,
      is_primary: fd.get("is_primary") === "on",
      is_active: true,
      currency: fd.get("currency") as string || "XAF",
      split_percentage: Number(fd.get("split_percentage")) || 100,
    };
    // Method-specific fields
    if (method === "bank_transfer") {
      payload.bank_name = fd.get("bank_name") as string;
      payload.bank_code = fd.get("bank_code") as string;
      payload.branch_code = fd.get("branch_code") as string;
      payload.account_number = fd.get("account_number") as string;
      payload.account_name = fd.get("account_name") as string;
      payload.swift_bic = fd.get("swift_bic") as string;
    } else if (method === "mobile_money") {
      payload.momo_provider = fd.get("momo_provider") as string;
      payload.momo_phone = fd.get("momo_phone") as string;
      payload.momo_name = fd.get("momo_name") as string;
    } else if (method === "kang_wallet") {
      payload.wallet_account_id = fd.get("wallet_account_id") as string;
      payload.wallet_user_id = fd.get("wallet_user_id") as string;
    } else if (method === "paypal") {
      payload.paypal_email = fd.get("paypal_email") as string;
      payload.paypal_merchant_id = fd.get("paypal_merchant_id") as string;
    } else if (method === "card") {
      payload.card_last4 = fd.get("card_last4") as string;
      payload.card_token = fd.get("card_token") as string;
      payload.card_network = fd.get("card_network") as string;
    } else if (method === "rtgs_wire") {
      payload.rtgs_account_number = fd.get("rtgs_account_number") as string;
      payload.rtgs_bank_name = fd.get("rtgs_bank_name") as string;
      payload.rtgs_swift_code = fd.get("rtgs_swift_code") as string;
      payload.rtgs_routing_number = fd.get("rtgs_routing_number") as string;
    }
    upsertMutation.mutate(payload);
  };

  const openEdit = (acct: any) => {
    setEditAccount(acct);
    setMethod(acct.method);
    setDialogOpen(true);
  };

  const methodLabel = (m: string) => SETTLEMENT_METHODS.find(sm => sm.value === m)?.label || m;

  const renderMethodFields = () => {
    const ea = editAccount;
    switch (method) {
      case "bank_transfer": return (<>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Bank Name</Label><Input name="bank_name" defaultValue={ea?.bank_name} required /></div>
          <div><Label>Bank Code</Label><Input name="bank_code" defaultValue={ea?.bank_code} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Branch Code</Label><Input name="branch_code" defaultValue={ea?.branch_code} /></div>
          <div><Label>Account Number</Label><Input name="account_number" defaultValue={ea?.account_number} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Account Name</Label><Input name="account_name" defaultValue={ea?.account_name} /></div>
          <div><Label>SWIFT/BIC</Label><Input name="swift_bic" defaultValue={ea?.swift_bic} /></div>
        </div>
      </>);
      case "mobile_money": return (<>
        <div><Label>Provider</Label>
          <Select name="momo_provider" defaultValue={ea?.momo_provider || "mtn"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtn">MTN MoMo</SelectItem>
              <SelectItem value="orange">Orange Money</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Phone Number</Label><Input name="momo_phone" defaultValue={ea?.momo_phone} required placeholder="+237..." /></div>
        <div><Label>Account Name</Label><Input name="momo_name" defaultValue={ea?.momo_name} /></div>
      </>);
      case "kang_wallet": return (<>
        <div><Label>Wallet Account ID</Label><Input name="wallet_account_id" defaultValue={ea?.wallet_account_id} required /></div>
        <div><Label>Wallet User ID</Label><Input name="wallet_user_id" defaultValue={ea?.wallet_user_id} /></div>
      </>);
      case "paypal": return (<>
        <div><Label>PayPal Email</Label><Input name="paypal_email" type="email" defaultValue={ea?.paypal_email} required /></div>
        <div><Label>PayPal Merchant ID</Label><Input name="paypal_merchant_id" defaultValue={ea?.paypal_merchant_id} /></div>
      </>);
      case "card": return (<>
        <div><Label>Card Network</Label>
          <Select name="card_network" defaultValue={ea?.card_network || "visa"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="visa">Visa Direct</SelectItem>
              <SelectItem value="mastercard">MC Send</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Card Last 4</Label><Input name="card_last4" defaultValue={ea?.card_last4} maxLength={4} /></div>
        <div><Label>Card Token</Label><Input name="card_token" defaultValue={ea?.card_token} required /></div>
      </>);
      case "rtgs_wire": return (<>
        <div><Label>Bank Name</Label><Input name="rtgs_bank_name" defaultValue={ea?.rtgs_bank_name} required /></div>
        <div><Label>Account Number</Label><Input name="rtgs_account_number" defaultValue={ea?.rtgs_account_number} required /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>SWIFT Code</Label><Input name="rtgs_swift_code" defaultValue={ea?.rtgs_swift_code} /></div>
          <div><Label>Routing Number</Label><Input name="rtgs_routing_number" defaultValue={ea?.rtgs_routing_number} /></div>
        </div>
      </>);
      default: return null;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Settlement Accounts</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditAccount(null); setMethod("bank_transfer"); } }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditAccount(null); setMethod("bank_transfer"); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editAccount ? "Edit Settlement Account" : "New Settlement Account"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><Label>Label</Label><Input name="label" defaultValue={editAccount?.label} placeholder="e.g. Primary Bank Account" /></div>
              <div><Label>Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {renderMethodFields()}
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Currency</Label><Input name="currency" defaultValue={editAccount?.currency || "XAF"} /></div>
                <div><Label>Split %</Label><Input name="split_percentage" type="number" min={0} max={100} step={0.01} defaultValue={editAccount?.split_percentage ?? 100} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_primary" id="is_primary" defaultChecked={editAccount?.is_primary} className="h-4 w-4" />
                <Label htmlFor="is_primary">Primary settlement account</Label>
              </div>
              <Button type="submit" disabled={upsertMutation.isPending} className="w-full">{upsertMutation.isPending ? "Saving..." : "Save"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-16 w-full" /> : (accounts || []).length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">No settlement accounts configured. Add one to enable provider payouts.</p>
        ) : (
          <div className="space-y-2">
            {(accounts || []).map((acct: any) => {
              const MethodIcon = SETTLEMENT_METHODS.find(m => m.value === acct.method)?.icon || Building2;
              return (
                <div key={acct.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background border"><MethodIcon className="h-4 w-4 text-primary" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{acct.label || methodLabel(acct.method)}</span>
                        {acct.is_primary && <Badge variant="default" className="text-[10px] px-1.5 py-0"><Star className="h-3 w-3 mr-0.5" />Primary</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {acct.method === "bank_transfer" && `${acct.bank_name || ""} • ${acct.account_number || ""}`}
                        {acct.method === "mobile_money" && `${(acct.momo_provider || "").toUpperCase()} • ${acct.momo_phone || ""}`}
                        {acct.method === "kang_wallet" && `Wallet: ${acct.wallet_account_id || ""}`}
                        {acct.method === "paypal" && `${acct.paypal_email || ""}`}
                        {acct.method === "card" && `${(acct.card_network || "").toUpperCase()} •••• ${acct.card_last4 || ""}`}
                        {acct.method === "rtgs_wire" && `${acct.rtgs_bank_name || ""} • ${acct.rtgs_account_number || ""}`}
                        {acct.split_percentage < 100 ? ` · ${acct.split_percentage}%` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acct)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this settlement account?")) deleteMutation.mutate(acct.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Provider Detail (Locations + Products) ───
function ProviderDetail({ provider, onBack }: { provider: any; onBack: () => void }) {
  const qc = useQueryClient();
  const [locDialogOpen, setLocDialogOpen] = useState(false);
  const [editLoc, setEditLoc] = useState<any>(null);
  const [prodDialogOpen, setProdDialogOpen] = useState(false);
  const [editProd, setEditProd] = useState<any>(null);

  const { data: locations, isLoading: locsLoading } = useQuery({
    queryKey: ["admin-bill-locations", provider.id],
    queryFn: () => invoke("admin_list_locations", { provider_id: provider.id }),
  });

  const { data: products, isLoading: prodsLoading } = useQuery({
    queryKey: ["admin-bill-products", provider.id],
    queryFn: () => invoke("admin_list_products", { provider_id: provider.id }),
  });

  const locUpsert = useMutation({
    mutationFn: (payload: any) => invoke("admin_upsert_location", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-locations", provider.id] }); setLocDialogOpen(false); setEditLoc(null); toast({ title: "Location saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const locDelete = useMutation({
    mutationFn: (id: string) => invoke("admin_delete_location", { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-locations", provider.id] }); toast({ title: "Location deleted" }); },
  });

  const prodUpsert = useMutation({
    mutationFn: (payload: any) => invoke("admin_upsert_product", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-products", provider.id] }); setProdDialogOpen(false); setEditProd(null); toast({ title: "Product saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const prodToggle = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => invoke("admin_toggle_product", { id, is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-products", provider.id] }); toast({ title: "Product updated" }); },
  });

  const handleLocSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    locUpsert.mutate({
      id: editLoc?.id,
      provider_id: provider.id,
      name: fd.get("name") as string,
      city: fd.get("city") as string,
      address: fd.get("address") as string,
      sort_order: Number(fd.get("sort_order")) || 0,
      is_active: true,
    });
  };

  const handleProdSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    prodUpsert.mutate({
      id: editProd?.id,
      provider_id: provider.id,
      name: fd.get("name") as string,
      description: fd.get("description") as string,
      amount_type: fd.get("amount_type") as string,
      fixed_amount: Number(fd.get("fixed_amount")) || null,
      min_amount: Number(fd.get("min_amount")) || null,
      max_amount: Number(fd.get("max_amount")) || null,
      currency: "XAF",
      sort_order: Number(fd.get("sort_order")) || 0,
      is_active: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h3 className="text-lg font-semibold">{provider.name}</h3>
        <Badge variant={provider.is_active ? "default" : "secondary"}>{provider.is_active ? "Active" : "Inactive"}</Badge>
      </div>

      {/* Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Locations</CardTitle>
          <Dialog open={locDialogOpen} onOpenChange={(o) => { setLocDialogOpen(o); if (!o) setEditLoc(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditLoc(null)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editLoc ? "Edit Location" : "New Location"}</DialogTitle></DialogHeader>
              <form onSubmit={handleLocSubmit} className="space-y-3">
                <div><Label>Name</Label><Input name="name" defaultValue={editLoc?.name} required /></div>
                <div><Label>City</Label><Input name="city" defaultValue={editLoc?.city} /></div>
                <div><Label>Address</Label><Input name="address" defaultValue={editLoc?.address} /></div>
                <div><Label>Sort Order</Label><Input name="sort_order" type="number" defaultValue={editLoc?.sort_order || 0} /></div>
                <Button type="submit" disabled={locUpsert.isPending} className="w-full">{locUpsert.isPending ? "Saving..." : "Save"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>City</TableHead><TableHead>Address</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {locsLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow> : (locations || []).map((loc: any) => (
                <TableRow key={loc.id}>
                  <TableCell className="font-medium">{loc.name}</TableCell>
                  <TableCell>{loc.city}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.address}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditLoc(loc); setLocDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete?")) locDelete.mutate(loc.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!locsLoading && (!locations || locations.length === 0) && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No locations</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Settlement Accounts */}
      <SettlementAccountsCard providerId={provider.id} />

      {/* Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Products</CardTitle>
          <Dialog open={prodDialogOpen} onOpenChange={(o) => { setProdDialogOpen(o); if (!o) setEditProd(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => setEditProd(null)}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editProd ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
              <form onSubmit={handleProdSubmit} className="space-y-3">
                <div><Label>Name</Label><Input name="name" defaultValue={editProd?.name} required /></div>
                <div><Label>Description</Label><Textarea name="description" defaultValue={editProd?.description} rows={2} /></div>
                <div><Label>Amount Type</Label>
                  <Select name="amount_type" defaultValue={editProd?.amount_type || "fixed"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="variable">Variable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Fixed Amount</Label><Input name="fixed_amount" type="number" defaultValue={editProd?.fixed_amount || ""} /></div>
                  <div><Label>Min Amount</Label><Input name="min_amount" type="number" defaultValue={editProd?.min_amount || ""} /></div>
                  <div><Label>Max Amount</Label><Input name="max_amount" type="number" defaultValue={editProd?.max_amount || ""} /></div>
                </div>
                <div><Label>Sort Order</Label><Input name="sort_order" type="number" defaultValue={editProd?.sort_order || 0} /></div>
                <Button type="submit" disabled={prodUpsert.isPending} className="w-full">{prodUpsert.isPending ? "Saving..." : "Save"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead>Amount (XAF)</TableHead><TableHead>Fields</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {prodsLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow> : (products || []).map((prod: any) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium">{prod.name}</TableCell>
                  <TableCell><Badge variant="outline">{prod.amount_type}</Badge></TableCell>
                  <TableCell>{prod.amount_type === "fixed" ? Number(prod.fixed_amount).toLocaleString() : `${Number(prod.min_amount || 0).toLocaleString()} – ${Number(prod.max_amount || 0).toLocaleString()}`}</TableCell>
                  <TableCell>{(prod.bill_product_fields || []).length} fields</TableCell>
                  <TableCell><Switch checked={prod.is_active} onCheckedChange={(v) => prodToggle.mutate({ id: prod.id, is_active: v })} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditProd(prod); setProdDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!prodsLoading && (!products || products.length === 0) && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No products</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payments Tab ───
function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: resp, isLoading } = useQuery({
    queryKey: ["admin-bill-payments", statusFilter],
    queryFn: () => invoke("admin_list_payments", { status: statusFilter === "all" ? undefined : statusFilter, limit: 50 }),
  });
  const payments = resp?.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">Bill Payments</h3>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Receipt #</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Amount (XAF)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : payments.map((p: any) => (
              <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b transition-colors hover:bg-muted/50">
                <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                <TableCell>{p.bill_providers?.name || "—"}</TableCell>
                <TableCell>{p.bill_products?.name || "—"}</TableCell>
                <TableCell className="font-medium">{Number(p.total_amount).toLocaleString()}</TableCell>
                <TableCell><Badge variant={p.status === "completed" ? "default" : "destructive"}>{p.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.paid_at ? format(new Date(p.paid_at), "MMM dd, yyyy HH:mm") : "—"}</TableCell>
              </motion.tr>
            ))}
            {!isLoading && payments.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      {resp?.pagination && (
        <p className="text-xs text-muted-foreground text-right">Showing {payments.length} of {resp.pagination.total} payments</p>
      )}
    </div>
  );
}

// ─── Settlements Tab ───
function SettlementsTab() {
  const qc = useQueryClient();
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const { data: resp, isLoading } = useQuery({
    queryKey: ["admin-bill-settlements"],
    queryFn: () => invoke("admin_list_settlements", { limit: 50 }),
  });
  const settlements = resp?.data || [];

  const { data: providersResp } = useQuery({
    queryKey: ["admin-bill-providers-all"],
    queryFn: () => invoke("admin_list_providers", { limit: 200 }),
  });
  const allProviders = providersResp?.data || [];

  const initiateMutation = useMutation({
    mutationFn: (payload: any) => invoke("admin_initiate_settlement", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-settlements"] }); setInitiateOpen(false); toast({ title: "Settlement initiated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const processMutation = useMutation({
    mutationFn: (settlement_id: string) => invoke("admin_process_settlement", { settlement_id }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-bill-settlements"] });
      const failed = (data?.transfer_results || []).filter((r: any) => r.status === "failed").length;
      toast({ title: data?.status === "settled" ? "Settlement completed" : `Settlement processed (${failed} failed)`, description: `Net: ${Number(data?.net_amount).toLocaleString()} ${data?.currency}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (settlement_id: string) => invoke("admin_cancel_settlement", { settlement_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bill-settlements"] }); toast({ title: "Settlement cancelled" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusVariant = (s: string) => {
    if (s === "settled") return "default";
    if (s === "processing") return "secondary";
    if (s === "partial") return "outline";
    if (s === "cancelled" || s === "failed") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bill Settlements</h3>
        <Dialog open={initiateOpen} onOpenChange={setInitiateOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Initiate Settlement</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Initiate Provider Settlement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Provider</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger><SelectValue placeholder="Select provider..." /></SelectTrigger>
                  <SelectContent>
                    {allProviders.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>From Date (optional)</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
                <div><Label>To Date (optional)</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
              </div>
              <p className="text-xs text-muted-foreground">This will aggregate all completed, unsettled payments for this provider and create a pending settlement record. You can then process it to execute bank/mobile money/wallet transfers.</p>
              <Button
                className="w-full"
                disabled={!selectedProvider || initiateMutation.isPending}
                onClick={() => initiateMutation.mutate({ provider_id: selectedProvider, from_date: fromDate || undefined, to_date: toDate || undefined })}
              >
                {initiateMutation.isPending ? "Initiating..." : "Initiate Settlement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Net Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payments</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : settlements.length > 0 ? settlements.map((s: any) => {
              const details = (s.settlement_details || {}) as any;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.bill_providers?.name || "—"}</TableCell>
                  <TableCell>{s.currency} {Number(s.net_amount).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.settlement_type?.replace("_", " ")}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{s.payment_ids?.length || details.payment_count || 0}</TableCell>
                  <TableCell className="text-muted-foreground">{s.created_at ? format(new Date(s.created_at), "MMM dd, yyyy HH:mm") : "—"}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" variant="default" disabled={processMutation.isPending} onClick={() => { if (confirm(`Process settlement of ${s.currency} ${Number(s.net_amount).toLocaleString()} to ${s.bill_providers?.name}?`)) processMutation.mutate(s.id); }}>
                          {processMutation.isPending ? "..." : "Process"}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={cancelMutation.isPending} onClick={() => { if (confirm("Cancel this settlement?")) cancelMutation.mutate(s.id); }}>Cancel</Button>
                      </>
                    )}
                    {s.status === "partial" && (
                      <Button size="sm" variant="outline" onClick={() => toast({ title: "Transfer Details", description: JSON.stringify(details.transfer_results?.map((r: any) => `${r.method}: ${r.status}`)) })}>
                        <Eye className="h-4 w-4 mr-1" /> Details
                      </Button>
                    )}
                    {s.status === "settled" && s.settled_at && (
                      <span className="text-xs text-muted-foreground">{format(new Date(s.settled_at), "MMM dd HH:mm")}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No settlements yet. Initiate one to pay providers.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Main Page ───
export default function AdminBillManagement() {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-background/95 to-transparent border p-6 md:p-8">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Bill Management</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">Manage bill categories, providers, products, payment fields, and oversee all bill payments and settlements.</p>
        </div>
      </div>

      <BillStats />

      <Tabs defaultValue="categories" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="settlements">Settlements</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="settlements"><SettlementsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
