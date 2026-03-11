import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Shield, Edit2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  teller: "Teller",
  assistant_manager: "Assistant Manager",
  branch_manager: "Branch Manager",
  general_manager: "General Manager",
};

export default function InstitutionWithdrawalPolicies() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    role_type: "teller",
    single_txn_limit: "",
    daily_total_limit: "",
    auto_approve_threshold: "",
    requires_dual_approval_above: "",
    escalation_target_role: "branch_manager",
    currency: "XAF",
    channel: "",
    status: "active",
  });

  useEffect(() => { resolveAndLoad(); }, []);

  const resolveAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
    let id = inst?.id;
    if (!id) {
      const { data: staffId } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
      id = staffId;
    }
    if (id) { setInstitutionId(id); loadPolicies(id); }
    else setLoading(false);
  };

  const loadPolicies = async (instId: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("banking-ops", {
      body: { action: "list-withdrawal-policies", institution_id: instId },
    });
    if (error || data?.error) toast({ title: "Error", description: data?.error || "Failed to load policies", variant: "destructive" });
    else setPolicies(data?.policies || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institutionId) return;
    const payload: any = {
      action: editingId ? "update-withdrawal-policy" : "create-withdrawal-policy",
      institution_id: institutionId,
      role_type: form.role_type,
      single_txn_limit: Number(form.single_txn_limit),
      daily_total_limit: Number(form.daily_total_limit),
      auto_approve_threshold: Number(form.auto_approve_threshold) || 0,
      requires_dual_approval_above: form.requires_dual_approval_above ? Number(form.requires_dual_approval_above) : null,
      escalation_target_role: form.escalation_target_role,
      currency: form.currency,
      channel: form.channel || null,
      status: form.status,
    };
    if (editingId) payload.policy_id = editingId;

    const { data, error } = await supabase.functions.invoke("banking-ops", { body: payload });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Success", description: editingId ? "Policy updated" : "Policy created" });
      setDialogOpen(false);
      setEditingId(null);
      loadPolicies(institutionId);
    }
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setForm({
      role_type: p.role_type, single_txn_limit: String(p.single_txn_limit),
      daily_total_limit: String(p.daily_total_limit), auto_approve_threshold: String(p.auto_approve_threshold || ""),
      requires_dual_approval_above: p.requires_dual_approval_above ? String(p.requires_dual_approval_above) : "",
      escalation_target_role: p.escalation_target_role || "branch_manager",
      currency: p.currency || "XAF", channel: p.channel || "", status: p.status || "active",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ role_type: "teller", single_txn_limit: "", daily_total_limit: "", auto_approve_threshold: "", requires_dual_approval_above: "", escalation_target_role: "branch_manager", currency: "XAF", channel: "", status: "active" });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-amber/10 border border-fi-amber/20">
            <Shield className="h-5 w-5 text-fi-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Withdrawal Policies</h1>
            <p className="text-sm text-muted-foreground">Configure role-based withdrawal limits and escalation rules</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => institutionId && loadPolicies(institutionId)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Policy</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Edit" : "Create"} Withdrawal Policy</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Role</Label>
                    <Select value={form.role_type} onValueChange={v => setForm({ ...form, role_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Single Txn Limit</Label><Input type="number" value={form.single_txn_limit} onChange={e => setForm({ ...form, single_txn_limit: e.target.value })} placeholder="e.g. 500000" /></div>
                  <div><Label>Daily Total Limit</Label><Input type="number" value={form.daily_total_limit} onChange={e => setForm({ ...form, daily_total_limit: e.target.value })} placeholder="e.g. 2000000" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Auto-Approve Threshold</Label><Input type="number" value={form.auto_approve_threshold} onChange={e => setForm({ ...form, auto_approve_threshold: e.target.value })} /></div>
                  <div><Label>Dual Approval Above</Label><Input type="number" value={form.requires_dual_approval_above} onChange={e => setForm({ ...form, requires_dual_approval_above: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Escalation Target</Label>
                    <Select value={form.escalation_target_role} onValueChange={v => setForm({ ...form, escalation_target_role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Channel (optional)</Label><Input value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} placeholder="branch, mobile..." /></div>
                </div>
                <Button onClick={handleSave}>{editingId ? "Update" : "Create"} Policy</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Active Policies</CardTitle>
          <CardDescription className="text-xs">{policies.length} policies configured</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : policies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No withdrawal policies configured yet. Add a policy to control withdrawal limits by role.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Single Txn Limit</TableHead>
                  <TableHead>Daily Limit</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{ROLE_LABELS[p.role_type] || p.role_type}</TableCell>
                    <TableCell>{Number(p.single_txn_limit).toLocaleString()} {p.currency}</TableCell>
                    <TableCell>{Number(p.daily_total_limit).toLocaleString()} {p.currency}</TableCell>
                    <TableCell>{ROLE_LABELS[p.escalation_target_role] || p.escalation_target_role || "—"}</TableCell>
                    <TableCell>{p.currency}</TableCell>
                    <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
