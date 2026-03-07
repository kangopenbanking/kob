import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { RefreshCw, Building2, MapPin, Plus, MoreHorizontal, Pencil, Users, Power, Search, Phone, Mail, Globe } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function InstitutionBranches() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detailBranch, setDetailBranch] = useState<any>(null);
  const [form, setForm] = useState({ branch_name: "", branch_code: "", branch_type: "main", phone: "", email: "", address_line: "", city: "", country: "Cameroon" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { instId = institution.id; }
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);
      const { data } = await supabase.from("branches").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setBranches(data || []);
      const { data: staff } = await supabase.from("staff_assignments").select("branch_id").eq("institution_id", instId).eq("is_active", true);
      const counts: Record<string, number> = {};
      (staff || []).forEach(s => { if (s.branch_id) counts[s.branch_id] = (counts[s.branch_id] || 0) + 1; });
      setStaffCounts(counts);
    } catch (error) { console.error("Error loading branches:", error); }
    finally { setLoading(false); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return branches;
    const q = search.toLowerCase();
    return branches.filter(b => b.branch_name?.toLowerCase().includes(q) || b.branch_code?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q));
  }, [branches, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const activeBranches = branches.filter(b => b.is_active);
  const totalStaff = Object.values(staffCounts).reduce((a, b) => a + b, 0);

  const resetForm = () => setForm({ branch_name: "", branch_code: "", branch_type: "main", phone: "", email: "", address_line: "", city: "", country: "Cameroon" });

  const handleCreate = async () => {
    if (!institutionId || !form.branch_name || !form.branch_code) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branches").insert({
        institution_id: institutionId, branch_name: form.branch_name, branch_code: form.branch_code,
        branch_type: form.branch_type, phone: form.phone || null, email: form.email || null,
        address: { line: form.address_line, city: form.city, country: form.country },
      });
      if (error) throw error;
      toast({ title: "Branch created successfully" });
      setCreateOpen(false); resetForm(); loadData();
    } catch (e: any) { toast({ title: "Error creating branch", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editBranch) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branches").update({
        branch_name: form.branch_name, branch_type: form.branch_type, phone: form.phone || null, email: form.email || null,
        address: { line: form.address_line, city: form.city, country: form.country },
      }).eq("id", editBranch.id);
      if (error) throw error;
      toast({ title: "Branch updated successfully" });
      setEditBranch(null); resetForm(); loadData();
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
    setForm({ branch_name: branch.branch_name, branch_code: branch.branch_code, branch_type: branch.branch_type, phone: branch.phone || "", email: branch.email || "", address_line: addr.line || "", city: addr.city || "", country: addr.country || "Cameroon" });
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
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><MapPin className="h-5 w-5 text-primary" /></div>
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
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Branches" value={loading ? "..." : branches.length} icon={<Building2 className="h-4 w-4" />} />
        <StatCard title="Active Branches" value={loading ? "..." : activeBranches.length} icon={<MapPin className="h-4 w-4" />} />
        <StatCard title="Total Staff" value={loading ? "..." : totalStaff} icon={<Users className="h-4 w-4" />} />
        <StatCard title="Inactive" value={loading ? "..." : branches.length - activeBranches.length} icon={<Power className="h-4 w-4" />} />
      </motion.div>

      {/* Table */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search branches..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : branches.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No branches found</p></div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/40">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Branch Name</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Staff</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Location</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>{paginated.map(branch => {
                    const addr = branch.address || {};
                    return (
                      <TableRow key={branch.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setDetailBranch(branch)}>
                        <TableCell className="font-medium text-sm">{branch.branch_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{branch.branch_code}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-medium capitalize">{branch.branch_type}</Badge></TableCell>
                        <TableCell className="text-sm font-medium">{staffCounts[branch.id] || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{[addr.city, addr.country].filter(Boolean).join(', ') || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={branch.is_active ? "default" : "secondary"} className="text-[10px]">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${branch.is_active ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                            {branch.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{branch.created_at ? format(new Date(branch.created_at), 'PP') : '—'}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
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
                    );
                  })}</TableBody>
                </Table>
                <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Branch Detail Sheet */}
      <Sheet open={!!detailBranch} onOpenChange={o => { if (!o) setDetailBranch(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Branch Details</SheetTitle></SheetHeader>
          {detailBranch && (() => {
            const addr = detailBranch.address || {};
            return (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-lg font-bold">{detailBranch.branch_name}</p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">{detailBranch.branch_code}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px] capitalize">{detailBranch.branch_type}</Badge>
                    <Badge variant={detailBranch.is_active ? "default" : "secondary"} className="text-[10px]">{detailBranch.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  {detailBranch.phone && <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{detailBranch.phone}</span></div>}
                  {detailBranch.email && <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{detailBranch.email}</span></div>}
                  {(addr.line || addr.city) && <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{[addr.line, addr.city, addr.country].filter(Boolean).join(', ')}</span></div>}
                  <div className="flex items-center gap-3"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{staffCounts[detailBranch.id] || 0} staff assigned</span></div>
                </div>
                <Separator />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setDetailBranch(null); openEdit(detailBranch); }}><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/fi-portal/staff?branch=${detailBranch.id}`)}><Users className="h-3.5 w-3.5 mr-1.5" />Staff</Button>
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      <Dialog open={!!editBranch} onOpenChange={o => { if (!o) { setEditBranch(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-[550px]"><DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader><BranchForm onSubmit={handleEdit} isEdit={true} /></DialogContent>
      </Dialog>
    </motion.div>
  );
}
