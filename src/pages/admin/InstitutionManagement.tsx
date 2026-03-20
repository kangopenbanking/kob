import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Building2, CheckCircle, AlertCircle, Clock, Ban, Trash2, RotateCcw, Landmark} from "lucide-react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function InstitutionManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");
  const queryClient = useQueryClient();

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("institutions")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const manageMutation = useMutation({
    mutationFn: async ({ action, entityId, reason }: { action: string; entityId: string; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: { action, target_entity_id: entityId, reason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Institution ${vars.action.replace('_institution', '')} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-institutions"] });
      setSuspendDialogOpen(false);
      setDeleteDialogOpen(false);
      setActionReason("");
    },
    onError: (err: any) => toast.error(err.message || "Action failed"),
  });

  const filtered = (institutions || []).filter((i: any) => {
    const matchSearch = i.institution_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: institutions?.length || 0,
    active: institutions?.filter((i: any) => i.status === "active" || i.status === "approved").length || 0,
    pending: institutions?.filter((i: any) => i.status === "pending_review").length || 0,
    suspended: institutions?.filter((i: any) => i.status === "suspended").length || 0,
  };

  const statusColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "active" || s === "approved") return "default";
    if (s === "suspended") return "destructive";
    if (s === "pending_review") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Landmark} title="Institution Management" description="Manage banks, credit unions, and financial institutions" />


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Institutions</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div><p className="text-2xl font-bold">{stats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <Clock className="h-5 w-5 text-yellow-600" />
          <div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pending Review</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div><p className="text-2xl font-bold">{stats.suspended}</p><p className="text-xs text-muted-foreground">Suspended</p></div>
        </CardContent></Card>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Search institutions..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> All Institutions ({filtered.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No institutions found</TableCell></TableRow>
              ) : filtered.map((inst: any) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.institution_name}</TableCell>
                  <TableCell><Badge variant="outline">{inst.institution_type?.replace("_", " ")}</Badge></TableCell>
                  <TableCell><Badge variant={statusColor(inst.status)}>{inst.status?.replace("_", " ")}</Badge></TableCell>
                  <TableCell>{inst.country || "—"}</TableCell>
                  <TableCell>{new Date(inst.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-1">
                    {inst.status === 'suspended' ? (
                      <Button size="sm" variant="outline" onClick={() => manageMutation.mutate({ action: 'unsuspend_institution', entityId: inst.id })} disabled={manageMutation.isPending}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Unsuspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setSelectedInstitution(inst); setSuspendDialogOpen(true); }}>
                        <Ban className="h-3.5 w-3.5 mr-1" /> Suspend
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => { setSelectedInstitution(inst); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend Institution</DialogTitle>
            <DialogDescription>
              This will suspend "{selectedInstitution?.institution_name}" and ban all associated staff from logging in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason for Suspension</Label>
              <Textarea placeholder="Enter reason..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!actionReason.trim() || manageMutation.isPending}
              onClick={() => manageMutation.mutate({ action: 'suspend_institution', entityId: selectedInstitution?.id, reason: actionReason })}>
              Suspend Institution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently Delete Institution</DialogTitle>
            <DialogDescription>
              This will permanently delete "{selectedInstitution?.institution_name}" and ALL associated data including accounts, transactions, staff assignments, fee structures, and API credentials. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-semibold mb-1">The following data will be permanently deleted:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>All bank accounts and balances</li>
                <li>All transactions and beneficiaries</li>
                <li>Staff assignments and permissions</li>
                <li>Fee structures and invoices</li>
                <li>API clients and credentials</li>
                <li>Branches and connections</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Reason for Deletion</Label>
              <Textarea placeholder="Enter reason..." value={actionReason} onChange={(e) => setActionReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!actionReason.trim() || manageMutation.isPending}
              onClick={() => manageMutation.mutate({ action: 'delete_institution', entityId: selectedInstitution?.id, reason: actionReason })}>
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
