import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Pill, UtensilsCrossed } from "lucide-react";

interface Store {
  id: string; name: string; vertical: "food" | "pharmacy"; status: string;
}
interface Category { id: string; name: string; position: number; }
interface Product {
  id: string; name: string; description: string | null; price_xaf: number;
  stock: number | null; is_available: boolean; is_otc: boolean;
  requires_prescription: boolean; category_id: string | null; source: string;
}

export default function MerchantDailyNeedsMenu() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [catDialog, setCatDialog] = useState<{ open: boolean; editing?: Category | null }>({ open: false });
  const [catName, setCatName] = useState("");
  const [prodDialog, setProdDialog] = useState<{ open: boolean; editing?: Product | null }>({ open: false });
  const [prodForm, setProdForm] = useState<Partial<Product>>({});

  useEffect(() => {
    if (!storeId) return;
    void load();
  }, [storeId]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("daily_needs_stores").select("id,name,vertical,status").eq("id", storeId!).maybeSingle(),
      supabase.from("daily_needs_categories").select("*").eq("store_id", storeId!).order("position"),
      supabase.from("daily_needs_products").select("*").eq("store_id", storeId!).order("created_at", { ascending: false }),
    ]);
    setStore(s as Store | null);
    setCategories((c ?? []) as Category[]);
    setProducts((p ?? []) as Product[]);
    setLoading(false);
  }

  const isPharmacy = store?.vertical === "pharmacy";

  async function saveCategory() {
    if (!catName.trim() || !storeId) return;
    const editing = catDialog.editing;
    const { error } = editing
      ? await supabase.from("daily_needs_categories").update({ name: catName.trim() }).eq("id", editing.id)
      : await supabase.from("daily_needs_categories").insert({
          store_id: storeId, name: catName.trim(), position: categories.length,
        });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Category updated" : "Category added" });
    setCatDialog({ open: false }); setCatName("");
    void load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Products will become uncategorized.")) return;
    const { error } = await supabase.from("daily_needs_categories").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Category deleted" });
    if (activeCat === id) setActiveCat("all");
    void load();
  }

  function openProdDialog(editing?: Product) {
    setProdForm(editing ?? {
      name: "", description: "", price_xaf: 0, stock: null, is_available: true,
      is_otc: !isPharmacy ? true : true, requires_prescription: false,
      category_id: activeCat === "all" ? (categories[0]?.id ?? null) : activeCat,
    });
    setProdDialog({ open: true, editing });
  }

  async function saveProduct() {
    if (!storeId || !prodForm.name?.trim() || prodForm.price_xaf == null) {
      toast({ title: "Name and price required", variant: "destructive" }); return;
    }
    const editing = prodDialog.editing;
    const payload = {
      store_id: storeId,
      category_id: prodForm.category_id ?? null,
      name: prodForm.name.trim(),
      description: prodForm.description ?? null,
      price_xaf: Number(prodForm.price_xaf),
      stock: prodForm.stock != null && prodForm.stock !== ('' as any) ? Number(prodForm.stock) : null,
      is_available: prodForm.is_available ?? true,
      is_otc: isPharmacy ? (prodForm.is_otc ?? true) : true,
      requires_prescription: isPharmacy ? (prodForm.requires_prescription ?? false) : false,
    };
    const { error } = editing
      ? await supabase.from("daily_needs_products").update(payload).eq("id", editing.id)
      : await supabase.from("daily_needs_products").insert(payload);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing ? "Item updated" : "Item added" });
    setProdDialog({ open: false }); setProdForm({});
    void load();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("daily_needs_products").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Item deleted" });
    void load();
  }

  async function toggleAvailable(p: Product) {
    const { error } = await supabase.from("daily_needs_products")
      .update({ is_available: !p.is_available }).eq("id", p.id);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    void load();
  }

  if (loading) {
    return <div className="p-6 space-y-4 max-w-5xl"><Skeleton className="h-12 w-64" /><Skeleton className="h-64" /></div>;
  }

  if (!store) {
    return (
      <div className="p-6 max-w-3xl">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Store not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/merchant/daily-needs")}>Back</Button>
        </Card>
      </div>
    );
  }

  const visibleProducts = activeCat === "all" ? products : products.filter(p => p.category_id === activeCat);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/merchant/daily-needs")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              {isPharmacy ? <Pill className="size-5" /> : <UtensilsCrossed className="size-5" />}
              {store.name}
            </h1>
            <p className="text-sm text-muted-foreground capitalize">
              {store.vertical} menu · {products.length} item{products.length === 1 ? "" : "s"} · {categories.length} categor{categories.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={catDialog.open} onOpenChange={(o) => { setCatDialog({ open: o }); if (!o) setCatName(""); }}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => { setCatDialog({ open: true }); setCatName(""); }}>
                <Plus className="size-4 mr-2" /> Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{catDialog.editing ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Burgers, Cold remedies" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCatDialog({ open: false })}>Cancel</Button>
                <Button onClick={saveCategory}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => openProdDialog()} disabled={categories.length === 0}>
            <Plus className="size-4 mr-2" /> Item
          </Button>
        </div>
      </header>

      {categories.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <p className="font-medium">No categories yet</p>
          <p className="text-sm text-muted-foreground">Start by creating a category — items live inside categories.</p>
          <Button className="mt-2" onClick={() => setCatDialog({ open: true })}>
            <Plus className="size-4 mr-2" /> Create first category
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          {/* Category sidebar */}
          <aside className="space-y-1">
            <button
              onClick={() => setActiveCat("all")}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${activeCat === "all" ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
            >
              All items <span className="text-xs text-muted-foreground">({products.length})</span>
            </button>
            {categories.map((c) => (
              <div key={c.id} className={`group flex items-center justify-between rounded-md ${activeCat === c.id ? "bg-muted" : "hover:bg-muted/50"}`}>
                <button onClick={() => setActiveCat(c.id)} className={`flex-1 text-left px-3 py-2 text-sm ${activeCat === c.id ? "font-medium" : ""}`}>
                  {c.name} <span className="text-xs text-muted-foreground">({products.filter(p => p.category_id === c.id).length})</span>
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex pr-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setCatDialog({ open: true, editing: c }); setCatName(c.name); }}>
                    <Pencil className="size-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(c.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </aside>

          {/* Products list */}
          <div className="space-y-2">
            {visibleProducts.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground">
                No items in this category yet.
              </Card>
            ) : visibleProducts.map((p) => (
              <Card key={p.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium truncate">{p.name}</h4>
                    {!p.is_available && <Badge variant="secondary">Hidden</Badge>}
                    {p.source === "woocommerce" && <Badge variant="outline">Woo</Badge>}
                    {isPharmacy && p.requires_prescription && <Badge variant="destructive">Rx</Badge>}
                    {isPharmacy && p.is_otc && !p.requires_prescription && <Badge variant="outline">OTC</Badge>}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
                  <p className="text-sm mt-1 tabular-nums">
                    {p.price_xaf.toLocaleString()} XAF
                    {p.stock != null && <span className="text-muted-foreground"> · {p.stock} in stock</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={p.is_available} onCheckedChange={() => toggleAvailable(p)} aria-label="Available" />
                  <Button size="icon" variant="ghost" onClick={() => openProdDialog(p)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteProduct(p.id)}><Trash2 className="size-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Product dialog */}
      <Dialog open={prodDialog.open} onOpenChange={(o) => { setProdDialog({ open: o }); if (!o) setProdForm({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{prodDialog.editing ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" value={prodForm.name ?? ""} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" rows={2} value={prodForm.description ?? ""} onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-price">Price (XAF)</Label>
                <Input id="p-price" type="number" min={0} value={prodForm.price_xaf ?? 0} onChange={(e) => setProdForm({ ...prodForm, price_xaf: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="p-stock">Stock <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input id="p-stock" type="number" min={0} value={prodForm.stock ?? ""} onChange={(e) => setProdForm({ ...prodForm, stock: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label htmlFor="p-cat">Category</Label>
              <select
                id="p-cat"
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={prodForm.category_id ?? ""}
                onChange={(e) => setProdForm({ ...prodForm, category_id: e.target.value || null })}
              >
                <option value="">— Uncategorized —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {isPharmacy && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-otc">Available OTC</Label>
                  <Switch id="p-otc" checked={prodForm.is_otc ?? true} onCheckedChange={(v) => setProdForm({ ...prodForm, is_otc: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="p-rx">Requires prescription</Label>
                  <Switch id="p-rx" checked={prodForm.requires_prescription ?? false} onCheckedChange={(v) => setProdForm({ ...prodForm, requires_prescription: v })} />
                </div>
              </>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <Label htmlFor="p-avail">Visible to customers</Label>
              <Switch id="p-avail" checked={prodForm.is_available ?? true} onCheckedChange={(v) => setProdForm({ ...prodForm, is_available: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProdDialog({ open: false })}>Cancel</Button>
            <Button onClick={saveProduct}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
