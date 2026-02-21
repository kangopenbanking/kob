import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Building2, MapPin, Plus, MoreHorizontal, Pencil, Users, Power } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionBranches() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    branch_name: "", branch_code: "", branch_type: "main", phone: "", email: "",
    address_line: "", city: "", country: "Cameroon",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
      const { data } = await supabase.from("branches").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setBranches(data || []);

      // Get staff counts per branch
      const { data: staff } = await supabase.from("staff_assignments").select("branch_id").eq("institution_id", institution.id).eq("is_active", true);
      const counts: Record<string, number> = {};
      (staff || []).forEach(s => { if (s.branch_id) counts[s.branch_id] = (counts[s.branch_id] || 0) + 1; });
      setStaffCounts(counts);
    } catch (error) { console.error("Error loading branches:", error); }
    finally { setLoading(false); }
  };

  const resetForm = () => setForm({ branch_name: "", branch_code: "", branch_type: "main", phone: "", email: "", address_line: "", city: "", country: "Cameroon" });

  const handleCreate = async () => {
    if (!institutionId || !form.branch_name || !form.branch_code) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branches").insert({
        institution_id: institutionId,
        branch_name: form.branch_name,
        branch_code: form.branch_code,
        branch_type: form.branch_type,
        phone: form.phone || null,
        email: form.email || null,
        address: { line: form.address_line, city: form.city, country: form.country },
      });
      if (error) throw error;
      toast({ title: "Branch created successfully" });
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) { toast({ title: "Error creating branch", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editBranch) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branches").update({
        branch_name: form.branch_name,
        branch_type: form.branch_type,
        phone: form.phone || null,
        email: form.email || null,
        address: { line: form.address_line, city: form.city, country: form.country },
      }).eq("id", editBranch.id);
      if (error) throw error;
      toast({ title: "Branch updated successfully" });
      setEditBranch(null);
      resetForm();
      loadData();
    } catch (e: any) { toast({ title: "Error updating branch", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (branch: any) => {
    try {
      const { error } = await supabase.from("branches").update({ is_active: !branch.is_active }).eq("id", branch.id);
      if (error) throw error;
      toast({ title: `Branch ${branch.is_active ? "deactivated" : "activated"}` });
      loadData();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const openEdit = (branch: any) => {
    const addr = branch.address || {};
    setForm({
      branch_name: branch.branch_name, branch_code: branch.branch_code, branch_type: branch.branch_type,
      phone: branch.phone || "", email: branch.email || "",
      address_line: addr.line || "", city: addr.city || "", country: addr.country || "Cameroon",
    });
    setEditBranch(branch);
  };

  const BranchForm = ({ onSubmit, isEdit }: { onSubmit: () => void; isEdit: boolean }) => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Branch Name *</Label><Input value={form.branch_name} onChange={e => setForm(f => ({ ...f, branch_name: e.target.value }))} placeholder="Main Branch" /></div>
        <div className="space-y-2"><Label>Branch Code *</Label><Input value={form.branch_code} onChange={e => setForm(f => ({ ...f, branch_code: e.target.value }))} placeholder="BR001" disabled={isEdit} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Type</Label>
          <Select value={form.branch_type} onValueChange={v => setForm(f => ({ ...f, branch_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="main">Main</SelectItem><SelectItem value="branch">Branch</SelectItem><SelectItem value="agency">Agency</SelectItem><SelectItem value="atm">ATM</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+237..." /></div>
      </div>
      <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="branch@bank.com" /></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Address</Label><Input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} /></div>
        <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
        <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
      </div>
      <DialogFooter><Button onClick={onSubmit} disabled={saving || !form.branch_name || !form.branch_code}>{saving ? "Saving..." : isEdit ? "Update Branch" : "Create Branch"}</Button></DialogFooter>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><MapPin className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Branches</h1>
            <p className="text-xs text-muted-foreground">Manage institution branches and locations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Create Branch</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[550px]"><DialogHeader><DialogTitle>Create New Branch</DialogTitle></DialogHeader><BranchForm onSubmit={handleCreate} isEdit={false} /></DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Branches", value: branches.length, icon: Building2 },
          { label: "Active Branches", value: branches.filter(b => b.is_active).length, icon: MapPin },
          { label: "Total Staff Assigned", value: Object.values(staffCounts).reduce((a, b) => a + b, 0), icon: Users },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">All Branches</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No branches found</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Branch Name</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Staff</TableHead><TableHead className="text-xs">Phone</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Created</TableHead><TableHead className="text-xs w-10"></TableHead></TableRow></TableHeader>
              <TableBody>{branches.map(branch => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium text-sm">{branch.branch_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{branch.branch_code}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{branch.branch_type}</Badge></TableCell>
                  <TableCell className="text-sm">{staffCounts[branch.id] || 0}</TableCell>
                  <TableCell className="text-sm">{branch.phone || '--'}</TableCell>
                  <TableCell className="text-sm">{branch.email || '--'}</TableCell>
                  <TableCell><Badge variant={branch.is_active ? "default" : "secondary"} className="text-[10px]">{branch.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{branch.created_at ? format(new Date(branch.created_at), 'PP') : '--'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(branch)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/fi-portal/staff?branch=${branch.id}`)}><Users className="h-3.5 w-3.5 mr-2" />View Staff</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(branch)}><Power className="h-3.5 w-3.5 mr-2" />{branch.is_active ? "Deactivate" : "Activate"}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editBranch} onOpenChange={o => { if (!o) { setEditBranch(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[550px]"><DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader><BranchForm onSubmit={handleEdit} isEdit={true} /></DialogContent>
      </Dialog>
    </div>
  );
}
