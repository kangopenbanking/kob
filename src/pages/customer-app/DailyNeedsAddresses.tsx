import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, MapPin, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Address = {
  id: string;
  label: string;
  full_address: string | null;
  is_primary: boolean | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
};

export default function DailyNeedsAddresses() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", full_address: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("user_addresses")
      .select("id,label,full_address,is_primary,latitude,longitude,notes")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false });
    if (error) toast({ title: "Failed to load addresses", variant: "destructive" });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.label.trim() || !form.full_address.trim()) {
      toast({ title: "Label and address are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_addresses").insert({
      user_id: user!.id, label: form.label, full_address: form.full_address, notes: form.notes,
      is_primary: items.length === 0,
    });
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    setForm({ label: "", full_address: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("user_addresses").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", variant: "destructive" }); return; }
    load();
  };

  const setPrimary = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_addresses").update({ is_primary: false }).eq("user_id", user.id);
    await supabase.from("user_addresses").update({ is_primary: true }).eq("id", id);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="size-5" />
          </Button>
          <h1 className="text-xl font-semibold">Delivery Addresses</h1>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add</Button>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-6 text-muted-foreground" />}
          title="No saved addresses"
          description="Add a delivery address to speed up checkout."
          action={{ label: "Add address", onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-start gap-2">
                <MapPin className="size-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{a.label}</p>
                    {a.is_primary && <Star className="size-3 fill-primary text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.full_address}</p>
                  {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)} aria-label="Delete">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              {!a.is_primary && (
                <Button variant="link" size="sm" className="px-0 h-auto mt-2" onClick={() => setPrimary(a.id)}>
                  Set as primary
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Address</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Label (e.g. Home)</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><Label>Full address</Label><Input value={form.full_address} onChange={(e) => setForm({ ...form, full_address: e.target.value })} /></div>
            <div><Label>Notes (optional)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Apt 4B, blue gate" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
