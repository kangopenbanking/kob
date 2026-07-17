import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Globe, Smartphone, Building2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface CountryRow {
  id: string;
  code: string;
  country: string;
  flag: string;
  dial_code: string;
  enabled_consumer_app: boolean;
  enabled_banking_app: boolean;
  enabled_desktop_app: boolean;
  sort_order: number;
}

const emptyForm = { code: "", country: "", flag: "", dial_code: "", enabled_consumer_app: true, enabled_banking_app: true, enabled_desktop_app: true, sort_order: 0 };

export default function SupportedCountriesManagement() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CountryRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: countries = [], isLoading } = useQuery({
    queryKey: ["admin-supported-countries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supported_countries")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as CountryRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase.from("supported_countries").update({
          code: values.code, country: values.country, flag: values.flag, dial_code: values.dial_code,
          enabled_consumer_app: values.enabled_consumer_app, enabled_banking_app: values.enabled_banking_app,
          enabled_desktop_app: values.enabled_desktop_app, sort_order: values.sort_order, updated_at: new Date().toISOString(),
        }).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("supported_countries").insert({
          code: values.code, country: values.country, flag: values.flag, dial_code: values.dial_code,
          enabled_consumer_app: values.enabled_consumer_app, enabled_banking_app: values.enabled_banking_app,
          enabled_desktop_app: values.enabled_desktop_app, sort_order: values.sort_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-supported-countries"] });
      qc.invalidateQueries({ queryKey: ["supported-countries"] });
      toast.success(editing ? "Country updated" : "Country added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(extractEdgeFunctionError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supported_countries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-supported-countries"] });
      qc.invalidateQueries({ queryKey: ["supported-countries"] });
      toast.success("Country removed");
    },
    onError: (e: Error) => toast.error(extractEdgeFunctionError(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("supported_countries").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-supported-countries"] });
      qc.invalidateQueries({ queryKey: ["supported-countries"] });
    },
    onError: (e: Error) => toast.error(extractEdgeFunctionError(e)),
  });

  const openAdd = () => { setEditing(null); setForm({ ...emptyForm, sort_order: countries.length + 1 }); setDialogOpen(true); };
  const openEdit = (c: CountryRow) => { setEditing(c); setForm({ code: c.code, country: c.country, flag: c.flag, dial_code: c.dial_code, enabled_consumer_app: c.enabled_consumer_app, enabled_banking_app: c.enabled_banking_app, enabled_desktop_app: c.enabled_desktop_app, sort_order: c.sort_order }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSave = () => saveMutation.mutate(editing ? { ...form, id: editing.id } : form);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Globe} title="Supported Countries" description="Manage supported countries, currencies, and regional settings" />

      <div className="flex items-center justify-end">
        <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Country</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold">{countries.length}</p><p className="text-xs text-muted-foreground">Total Countries</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-green-600">{countries.filter(c => c.enabled_consumer_app).length}</p><p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Smartphone className="h-3 w-3" /> Consumer App</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-blue-600">{countries.filter(c => c.enabled_banking_app).length}</p><p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Building2 className="h-3 w-3" /> Banking App</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-3xl font-bold text-purple-600">{countries.filter(c => c.enabled_desktop_app).length}</p><p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Monitor className="h-3 w-3" /> Desktop App</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Country List</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>ISO Code</TableHead>
                <TableHead>Dial Code</TableHead>
                <TableHead className="text-center">Consumer App</TableHead>
                <TableHead className="text-center">Banking App</TableHead>
                <TableHead className="text-center">Desktop App</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : countries.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.sort_order}</TableCell>
                  <TableCell className="text-xl">{c.flag}</TableCell>
                  <TableCell className="font-medium">{c.country}</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono">{c.code}</Badge></TableCell>
                  <TableCell className="font-mono">{c.dial_code}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.enabled_consumer_app} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, field: "enabled_consumer_app", value: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.enabled_banking_app} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, field: "enabled_banking_app", value: v })} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={c.enabled_desktop_app} onCheckedChange={(v) => toggleMutation.mutate({ id: c.id, field: "enabled_desktop_app", value: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm(`Remove ${c.country}?`)) deleteMutation.mutate(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Country" : "Add Country"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Country Name</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Canada" /></div>
              <div><Label>ISO Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="CA" maxLength={2} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Dial Code</Label><Input value={form.dial_code} onChange={e => setForm(f => ({ ...f, dial_code: e.target.value }))} placeholder="+1" /></div>
              <div><Label>Flag Emoji</Label><Input value={form.flag} onChange={e => setForm(f => ({ ...f, flag: e.target.value }))} placeholder="🇨🇦" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Sort Order</Label><Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled in Consumer App</Label>
              <Switch checked={form.enabled_consumer_app} onCheckedChange={v => setForm(f => ({ ...f, enabled_consumer_app: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled in Banking App</Label>
              <Switch checked={form.enabled_banking_app} onCheckedChange={v => setForm(f => ({ ...f, enabled_banking_app: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled in Desktop App</Label>
              <Switch checked={form.enabled_desktop_app} onCheckedChange={v => setForm(f => ({ ...f, enabled_desktop_app: v }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || !form.country || !form.code || !form.dial_code}>
                {saveMutation.isPending ? "Saving..." : editing ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
