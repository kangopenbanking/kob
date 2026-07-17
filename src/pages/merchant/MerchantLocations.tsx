import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, MapPin, Users, Trash2, Save, X, Building2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const STAFF_ROLES = [
  { value: "merchant_admin", label: "Admin" },
  { value: "merchant_manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
];

export default function MerchantLocations() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Location dialog
  const [locDialog, setLocDialog] = useState(false);
  const [editingLoc, setEditingLoc] = useState<any>(null);
  const [locForm, setLocForm] = useState({ name: "", address: "", city: "", country: "CM", phone: "" });
  const [savingLoc, setSavingLoc] = useState(false);

  // Staff dialog
  const [staffDialog, setStaffDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({ user_id: "", location_id: "", role: "cashier", pin: "", full_name: "", email: "" });
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data: merchant } = await supabase
      .from("gateway_merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!merchant) return setLoading(false);
    setMerchantId(merchant.id);

    const [locsRes, staffRes] = await Promise.all([
      supabase.from("merchant_locations").select("*").eq("merchant_id", merchant.id).order("created_at"),
      supabase.from("merchant_pos_staff").select("*, merchant_locations(name)").eq("merchant_id", merchant.id).order("created_at", { ascending: false }),
    ]);

    setLocations(locsRes.data || []);
    setStaff(staffRes.data || []);
    setLoading(false);
  };

  // --- Location CRUD ---
  const openCreateLoc = () => {
    setEditingLoc(null);
    setLocForm({ name: "", address: "", city: "", country: "CM", phone: "" });
    setLocDialog(true);
  };

  const openEditLoc = (loc: any) => {
    setEditingLoc(loc);
    setLocForm({ name: loc.name || "", address: loc.address || "", city: loc.city || "", country: loc.country || "CM", phone: loc.phone || "" });
    setLocDialog(true);
  };

  const saveLoc = async () => {
    if (!merchantId || !locForm.name) return;
    setSavingLoc(true);
    try {
      const payload = { merchant_id: merchantId, name: locForm.name, address: locForm.address, city: locForm.city, country: locForm.country, phone: locForm.phone };
      if (editingLoc) {
        const { error } = await supabase.from("merchant_locations").update(payload as any).eq("id", editingLoc.id);
        if (error) throw error;
        toast.success("Location updated");
      } else {
        const { error } = await supabase.from("merchant_locations").insert(payload as any);
        if (error) throw error;
        toast.success("Location created");
      }
      setLocDialog(false);
      loadAll();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setSavingLoc(false);
    }
  };

  const deleteLoc = async (loc: any) => {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    const { error } = await supabase.from("merchant_locations").delete().eq("id", loc.id);
    if (error) return toast.error(extractEdgeFunctionError(error));
    toast.success("Location deleted");
    loadAll();
  };

  // --- Staff CRUD ---
  const openCreateStaff = () => {
    setEditingStaff(null);
    setStaffForm({ user_id: "", location_id: "", role: "cashier", pin: "", full_name: "", email: "" });
    setStaffDialog(true);
  };

  const openEditStaff = (s: any) => {
    setEditingStaff(s);
    setStaffForm({ user_id: s.user_id || "", location_id: s.location_id || "", role: s.role || "cashier", pin: "", full_name: s.full_name || "", email: s.email || "" });
    setStaffDialog(true);
  };

  const saveStaff = async () => {
    if (!merchantId) return;
    setSavingStaff(true);
    try {
      const payload: any = {
        merchant_id: merchantId,
        location_id: staffForm.location_id || null,
        role: staffForm.role,
        full_name: staffForm.full_name,
        email: staffForm.email,
      };
      if (staffForm.pin) payload.pin_hash = staffForm.pin; // Stored as-is; edge function should hash
      if (staffForm.user_id) payload.user_id = staffForm.user_id;

      if (editingStaff) {
        const { error } = await supabase.from("merchant_pos_staff").update(payload).eq("id", editingStaff.id);
        if (error) throw error;
        toast.success("Staff member updated");
      } else {
        const { error } = await supabase.from("merchant_pos_staff").insert(payload);
        if (error) throw error;
        toast.success("Staff member added");
      }
      setStaffDialog(false);
      loadAll();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setSavingStaff(false);
    }
  };

  const deleteStaff = async (s: any) => {
    if (!confirm(`Remove staff member "${s.full_name || s.email}"?`)) return;
    const { error } = await supabase.from("merchant_pos_staff").delete().eq("id", s.id);
    if (error) return toast.error(extractEdgeFunctionError(error));
    toast.success("Staff member removed");
    loadAll();
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "merchant_admin") return "default";
    if (role === "merchant_manager") return "secondary";
    return "outline";
  };

  const getRoleLabel = (role: string) => STAFF_ROLES.find(r => r.value === role)?.label || role;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Locations & Staff</h1>
        <p className="text-muted-foreground">Manage your business locations and POS staff access</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Locations</p>
                <p className="text-2xl font-bold">{locations.length}</p>
              </div>
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Staff Members</p>
                <p className="text-2xl font-bold">{staff.length}</p>
              </div>
              <Users className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Locations ({locations.length})</TabsTrigger>
          <TabsTrigger value="staff">Staff ({staff.length})</TabsTrigger>
        </TabsList>

        {/* Locations Tab */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateLoc} className="gap-2"><Plus className="h-4 w-4" /> Add Location</Button>
          </div>
          {locations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No locations yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first business location to manage POS inventory and staff</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {locations.map(loc => (
                <Card key={loc.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{loc.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLoc(loc)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteLoc(loc)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {loc.address && <p className="text-sm text-muted-foreground">{loc.address}</p>}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{[loc.city, loc.country].filter(Boolean).join(", ") || "No city set"}</span>
                    </div>
                    {loc.phone && <p className="text-sm text-muted-foreground">{loc.phone}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Staff: {staff.filter(s => s.location_id === loc.id).length}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateStaff} className="gap-2"><Plus className="h-4 w-4" /> Add Staff</Button>
          </div>
          {staff.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No staff members yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add staff to manage POS access and assign roles</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name / Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="w-20">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map(s => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{s.full_name || "—"}</div>
                          {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(s.role)}>{getRoleLabel(s.role)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.merchant_locations?.name || <span className="italic">All locations</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditStaff(s)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteStaff(s)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Location Dialog */}
      <Dialog open={locDialog} onOpenChange={setLocDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLoc ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Location Name *</Label>
              <Input placeholder="e.g. Main Store Douala" value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Street address" value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input placeholder="Douala" value={locForm.city} onChange={e => setLocForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input placeholder="CM" value={locForm.country} onChange={e => setLocForm(f => ({ ...f, country: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+237 6XX XXX XXX" value={locForm.phone} onChange={e => setLocForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLocDialog(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
            <Button onClick={saveLoc} disabled={savingLoc || !locForm.name}>
              {savingLoc ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingLoc ? "Update" : "Add Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Dialog */}
      <Dialog open={staffDialog} onOpenChange={setStaffDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input placeholder="Jean Dupont" value={staffForm.full_name} onChange={e => setStaffForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="jean@example.com" value={staffForm.email} onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background"
                value={staffForm.role}
                onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
              >
                {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <select
                className="w-full h-10 border border-input rounded-md px-3 text-sm bg-background"
                value={staffForm.location_id}
                onChange={e => setStaffForm(f => ({ ...f, location_id: e.target.value }))}
              >
                <option value="">All Locations</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>PIN {editingStaff ? "(leave blank to keep current)" : ""}</Label>
              <Input
                type="password"
                maxLength={6}
                placeholder="4–6 digit PIN"
                value={staffForm.pin}
                onChange={e => setStaffForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
              />
              <p className="text-xs text-muted-foreground">Used for quick POS authentication at the terminal</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStaffDialog(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
            <Button onClick={saveStaff} disabled={savingStaff}>
              {savingStaff ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingStaff ? "Update Staff" : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
