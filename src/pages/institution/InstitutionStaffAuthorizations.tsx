import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, UserCog, Edit2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_LABELS: Record<string, string> = {
  teller: "Teller", assistant_manager: "Assistant Manager",
  branch_manager: "Branch Manager", general_manager: "General Manager",
};

export default function InstitutionStaffAuthorizations() {
  const { toast } = useToast();
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [operationalRoles, setOperationalRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [form, setForm] = useState({
    user_id: "", role_type: "teller", max_override_limit: "",
    can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false,
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
    if (id) { setInstitutionId(id); loadData(id); }
    else setLoading(false);
  };

  const loadData = async (instId: string) => {
    setLoading(true);
    const [authRes, rolesRes, staffRes] = await Promise.all([
      supabase.functions.invoke("banking-ops", { body: { action: "list-staff-authorizations", institution_id: instId } }),
      supabase.functions.invoke("banking-ops", { body: { action: "list-operational-roles", institution_id: instId } }),
      supabase.from("staff_assignments").select("user_id, position, profiles(full_name, email)").eq("institution_id", instId).eq("is_active", true),
    ]);
    if (!authRes.error) setAuthorizations(authRes.data?.authorizations || []);
    if (!rolesRes.error) setOperationalRoles(rolesRes.data?.roles || []);
    setStaffList(staffRes.data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institutionId || !form.user_id) return;
    const { data, error } = await supabase.functions.invoke("banking-ops", {
      body: {
        action: "create-staff-authorization", institution_id: institutionId,
        user_id: form.user_id, role_type: form.role_type,
        max_override_limit: form.max_override_limit ? Number(form.max_override_limit) : null,
        can_approve_overdraft: form.can_approve_overdraft,
        can_approve_withdrawal_override: form.can_approve_withdrawal_override,
        can_suspend_overdraft: form.can_suspend_overdraft,
      },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || "Failed", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Staff authorization created" });
      setDialogOpen(false);
      loadData(institutionId);
    }
  };

  const getStaffName = (userId: string) => {
    const staff = staffList.find(s => s.user_id === userId);
    return (staff?.profiles as any)?.full_name || (staff?.profiles as any)?.email || userId.substring(0, 8);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-indigo/10 border border-fi-indigo/20">
            <UserCog className="h-5 w-5 text-fi-indigo" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Staff Authorizations</h1>
            <p className="text-sm text-muted-foreground">Manage operational roles and approval authority for staff</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => institutionId && loadData(institutionId)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setForm({ user_id: "", role_type: "teller", max_override_limit: "", can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Assign Authority
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Staff Authority</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Staff Member</Label>
                  <Select value={form.user_id} onValueChange={v => setForm({ ...form, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {(s.profiles as any)?.full_name || (s.profiles as any)?.email || s.user_id.substring(0, 8)} — {s.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operational Role</Label>
                  <Select value={form.role_type} onValueChange={v => setForm({ ...form, role_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max Override Limit (XAF)</Label>
                  <Input type="number" value={form.max_override_limit} onChange={e => setForm({ ...form, max_override_limit: e.target.value })} placeholder="Optional" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Can Approve Withdrawal Override</Label>
                    <Switch checked={form.can_approve_withdrawal_override} onCheckedChange={v => setForm({ ...form, can_approve_withdrawal_override: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Can Approve Overdraft</Label>
                    <Switch checked={form.can_approve_overdraft} onCheckedChange={v => setForm({ ...form, can_approve_overdraft: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Can Suspend Overdraft</Label>
                    <Switch checked={form.can_suspend_overdraft} onCheckedChange={v => setForm({ ...form, can_suspend_overdraft: v })} />
                  </div>
                </div>
                <Button onClick={handleSave}>Assign Authority</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Operational Roles Overview */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Active Operational Roles</CardTitle>
          <CardDescription className="text-xs">{operationalRoles.length} staff with operational roles</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-20 w-full" /> : operationalRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No operational roles assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {operationalRoles.map(r => (
                <Badge key={r.id} variant="outline" className="py-1.5 px-3">
                  {getStaffName(r.user_id)} — <span className="ml-1 font-semibold">{ROLE_LABELS[r.role_type] || r.role_type}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authorizations Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Staff Authorizations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : authorizations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No staff authorizations configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Override Limit</TableHead>
                  <TableHead>Withdrawal</TableHead>
                  <TableHead>Overdraft</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authorizations.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-xs">{getStaffName(a.user_id)}</TableCell>
                    <TableCell><Badge variant="outline">{ROLE_LABELS[a.role_type] || a.role_type}</Badge></TableCell>
                    <TableCell className="text-xs">{a.max_override_limit ? `${Number(a.max_override_limit).toLocaleString()} XAF` : "—"}</TableCell>
                    <TableCell>{a.can_approve_withdrawal_override ? <Badge variant="outline" className="bg-green-500/10 text-green-600 text-[10px]">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                    <TableCell>{a.can_approve_overdraft ? <Badge variant="outline" className="bg-green-500/10 text-green-600 text-[10px]">Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                    <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
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
