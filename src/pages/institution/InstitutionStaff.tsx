import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Users, Plus, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionStaff() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", position: "", department: "", branch_id: "", employment_type: "full-time" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
      const [staffRes, branchRes] = await Promise.all([
        supabase.from("staff_assignments").select("*").eq("institution_id", institution.id).order("assigned_at", { ascending: false }),
        supabase.from("branches").select("id, branch_name").eq("institution_id", institution.id),
      ]);
      setStaff(staffRes.data || []);
      setBranches(branchRes.data || []);
    } catch (error) { console.error("Error loading staff:", error); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!institutionId || !form.user_id || !form.position) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("staff_assignments").insert({
        institution_id: institutionId,
        user_id: form.user_id,
        position: form.position,
        department: form.department || null,
        branch_id: form.branch_id || null,
        employment_type: form.employment_type,
        start_date: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: "Staff member assigned" });
      setDialogOpen(false);
      setForm({ user_id: "", position: "", department: "", branch_id: "", employment_type: "full-time" });
      loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><Users className="h-5 w-5 text-muted-foreground" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-xs text-muted-foreground">Manage staff assignments across branches</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Assign Staff</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Staff Member</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>User ID</Label><Input placeholder="User UUID" value={form.user_id} onChange={e => setForm(f => ({...f, user_id: e.target.value}))} /></div>
                <div><Label>Position</Label><Input placeholder="e.g. Branch Manager" value={form.position} onChange={e => setForm(f => ({...f, position: e.target.value}))} /></div>
                <div><Label>Department</Label><Input placeholder="e.g. Operations" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} /></div>
                <div><Label>Branch</Label>
                  <Select value={form.branch_id} onValueChange={v => setForm(f => ({...f, branch_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Employment Type</Label>
                  <Select value={form.employment_type} onValueChange={v => setForm(f => ({...f, employment_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={saving || !form.user_id || !form.position}>{saving ? "Assigning..." : "Assign Staff"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Staff", value: staff.length, icon: Users },
          { label: "Active", value: staff.filter(s => s.is_active).length, icon: Briefcase },
          { label: "Departments", value: new Set(staff.map(s => s.department).filter(Boolean)).size, icon: Users },
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
        <CardHeader><CardTitle className="text-sm font-semibold">Staff Assignments</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : staff.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Users className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No staff assignments</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Position</TableHead><TableHead className="text-xs">Department</TableHead><TableHead className="text-xs">Employment</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Start Date</TableHead></TableRow></TableHeader>
              <TableBody>{staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-sm">{s.position}</TableCell>
                  <TableCell className="text-sm">{s.department || '--'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{s.employment_type || '--'}</Badge></TableCell>
                  <TableCell><Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.start_date ? format(new Date(s.start_date), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
