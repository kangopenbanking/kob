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
  const { data: resp, isLoading } = useQuery({
    queryKey: ["admin-bill-settlements"],
    queryFn: () => invoke("admin_list_settlements", { limit: 50 }),
  });
  const settlements = resp?.data || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Bill Settlements</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Amount (XAF)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
            )) : settlements.length > 0 ? settlements.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.bill_providers?.name || "—"}</TableCell>
                <TableCell className="font-medium">{Number(s.total_amount).toLocaleString()}</TableCell>
                <TableCell><Badge variant={s.status === "settled" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{s.period_start && s.period_end ? `${format(new Date(s.period_start), "MMM dd")} – ${format(new Date(s.period_end), "MMM dd")}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.created_at ? format(new Date(s.created_at), "MMM dd, yyyy") : "—"}</TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No settlements yet</TableCell></TableRow>
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
