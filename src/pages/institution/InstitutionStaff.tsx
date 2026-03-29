import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  RefreshCw, Users, Plus, Briefcase, Shield, UserCog, Eye, EyeOff,
  ChevronDown, ChevronRight, AlertTriangle, Check, X, Edit2, Trash2,
  Ban, UserCheck, DollarSign, Lock, Unlock, Info,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { ALL_PORTAL_SECTIONS, ROLE_TEMPLATES } from "@/components/institution/navigation-config";

const OP_ROLE_LABELS: Record<string, string> = {
  teller: "Teller",
  assistant_manager: "Assistant Manager",
  branch_manager: "Branch Manager",
  general_manager: "General Manager",
};

const OP_ROLE_HIERARCHY = ["teller", "assistant_manager", "branch_manager", "general_manager"];

interface StaffMember {
  id: string;
  user_id: string;
  position: string;
  department: string | null;
  branch_id: string | null;
  employment_type: string;
  is_active: boolean;
  start_date: string | null;
  assigned_at: string;
  profile_name?: string | null;
  profile_email?: string | null;
}

export default function InstitutionStaff() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, any[]>>({});
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("roster");

  // Assign dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "", position: "", department: "", branch_id: "", employment_type: "full_time",
    role_template: "", sections: [] as string[],
    // Authority fields
    assign_authority: false, op_role_type: "teller", max_override_limit: "",
    can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false,
  });

  // Authority dialog
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authForm, setAuthForm] = useState({
    user_id: "", role_type: "teller", max_override_limit: "",
    can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) instId = institution.id;
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const [staffRes, branchRes, authRes, policyRes] = await Promise.all([
        supabase.from("staff_assignments").select("*").eq("institution_id", instId).order("assigned_at", { ascending: false }),
        supabase.from("branches").select("id, branch_name").eq("institution_id", instId),
        supabase.functions.invoke("banking-ops", { body: { action: "list-staff-authorizations", institution_id: instId } }),
        supabase.functions.invoke("banking-ops", { body: { action: "list-withdrawal-policies", institution_id: instId } }),
      ]);

      // Fetch only profiles for staff members (scoped, not all profiles)
      const staffUserIds = (staffRes.data || []).map((s: any) => s.user_id);
      const profileMap: Record<string, any> = {};
      if (staffUserIds.length > 0) {
        const { data: profilesData } = await supabase.from("profiles").select("id, full_name, email").in("id", staffUserIds);
        (profilesData || []).forEach((p: any) => { profileMap[p.id] = p; });
      }

      const staffData: StaffMember[] = (staffRes.data || []).map((s: any) => ({
        ...s,
        profile_name: profileMap[s.user_id]?.full_name || null,
        profile_email: profileMap[s.user_id]?.email || null,
      }));
      setStaff(staffData);
      setBranches(branchRes.data || []);
      setAuthorizations(authRes.data?.authorizations || []);
      setPolicies(policyRes.data?.policies || []);

      // Load portal permissions for each staff member
      const permMap: Record<string, any[]> = {};
      for (const s of staffData) {
        const { data: sections } = await supabase.rpc("get_staff_portal_sections", { _user_id: s.user_id });
        if (sections) permMap[s.user_id] = sections as any[];
      }
      setPermissions(permMap);
    } catch (error) {
      console.error("Error loading staff data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStaffName = (s: StaffMember) => {
    return s.profile_name || s.profile_email || s.user_id.substring(0, 8);
  };

  const getStaffNameById = (userId: string) => {
    const s = staff.find(x => x.user_id === userId);
    if (s) return getStaffName(s);
    return userId.substring(0, 8);
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "—";
    return branches.find(b => b.id === branchId)?.branch_name || branchId.substring(0, 8);
  };

  const getAuthForUser = (userId: string) => authorizations.find(a => a.user_id === userId);
  const getPolicyForRole = (roleType: string) => policies.find(p => p.role_type === roleType && p.status === "active");

  const handleTemplateChange = (template: string) => {
    setForm(f => ({
      ...f, role_template: template,
      sections: template && ROLE_TEMPLATES[template as keyof typeof ROLE_TEMPLATES]
        ? ROLE_TEMPLATES[template as keyof typeof ROLE_TEMPLATES].sections : f.sections,
    }));
  };

  const toggleSection = (key: string) => {
    setForm(f => ({
      ...f, role_template: '',
      sections: f.sections.includes(key) ? f.sections.filter(s => s !== key) : [...f.sections, key],
    }));
  };

  const handleCreate = async () => {
    if (!institutionId || !form.user_id || !form.position) return;
    setSaving(true);
    try {
      // 1. Assign staff + portal permissions
      const { data, error } = await supabase.functions.invoke('staff-assign', {
        body: {
          user_id: form.user_id, institution_id: institutionId,
          branch_id: form.branch_id || null, position: form.position,
          department: form.department || null, employment_type: form.employment_type,
          role_template: form.role_template || undefined,
          sections: form.role_template ? undefined : form.sections,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // 2. Optionally assign operational authority
      if (form.assign_authority) {
        const { data: authData, error: authErr } = await supabase.functions.invoke("banking-ops", {
          body: {
            action: "create-staff-authorization", institution_id: institutionId,
            user_id: form.user_id, role_type: form.op_role_type,
            max_override_limit: form.max_override_limit ? Number(form.max_override_limit) : null,
            can_approve_overdraft: form.can_approve_overdraft,
            can_approve_withdrawal_override: form.can_approve_withdrawal_override,
            can_suspend_overdraft: form.can_suspend_overdraft,
          },
        });
        if (authErr || authData?.error) {
          toast({ title: "Warning", description: "Staff assigned but authority creation failed: " + (authData?.error || "Unknown error"), variant: "destructive" });
        }
      }

      toast({ title: "Staff member assigned", description: `Granted access to ${data.sections?.length || 0} portal sections${form.assign_authority ? ' + operational authority' : ''}` });
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAssignAuthority = async () => {
    if (!institutionId || !authForm.user_id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("banking-ops", {
        body: {
          action: "create-staff-authorization", institution_id: institutionId,
          user_id: authForm.user_id, role_type: authForm.role_type,
          max_override_limit: authForm.max_override_limit ? Number(authForm.max_override_limit) : null,
          can_approve_overdraft: authForm.can_approve_overdraft,
          can_approve_withdrawal_override: authForm.can_approve_withdrawal_override,
          can_suspend_overdraft: authForm.can_suspend_overdraft,
        },
      });
      if (error || data?.error) throw new Error(data?.error || "Failed");
      toast({ title: "Authority assigned", description: `${OP_ROLE_LABELS[authForm.role_type]} authority granted` });
      setAuthDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleStaffActive = async (staffId: string, currentlyActive: boolean) => {
    const { error } = await supabase.from("staff_assignments").update({ is_active: !currentlyActive }).eq("id", staffId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: currentlyActive ? "Staff deactivated" : "Staff reactivated" }); loadData(); }
  };

  const resetForm = () => {
    setForm({
      user_id: "", position: "", department: "", branch_id: "", employment_type: "full_time",
      role_template: "", sections: [],
      assign_authority: false, op_role_type: "teller", max_override_limit: "",
      can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false,
    });
  };

  const activeStaff = staff.filter(s => s.is_active);
  const inactiveStaff = staff.filter(s => !s.is_active);
  const staffWithAuth = staff.filter(s => authorizations.some(a => a.user_id === s.user_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Staff Management</h1>
            <p className="text-xs text-muted-foreground">Manage assignments, portal access, operational authority & withdrawal policies</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>

          {/* Assign Authority Dialog */}
          <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => setAuthForm({ user_id: "", role_type: "teller", max_override_limit: "", can_approve_overdraft: false, can_approve_withdrawal_override: false, can_suspend_overdraft: false })}>
                <UserCog className="h-3.5 w-3.5 mr-1.5" />Assign Authority
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Operational Authority</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Staff Member</Label>
                  <Select value={authForm.user_id} onValueChange={v => setAuthForm({ ...authForm, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {activeStaff.map(s => (
                        <SelectItem key={s.user_id} value={s.user_id}>
                          {getStaffName(s)} — {s.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operational Role</Label>
                  <Select value={authForm.role_type} onValueChange={v => setAuthForm({ ...authForm, role_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(OP_ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {getPolicyForRole(authForm.role_type) && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Policy: Single {Number(getPolicyForRole(authForm.role_type).single_txn_limit).toLocaleString()} / Daily {Number(getPolicyForRole(authForm.role_type).daily_total_limit).toLocaleString()} XAF
                    </p>
                  )}
                </div>
                <div>
                  <Label>Max Override Limit (XAF)</Label>
                  <Input type="number" value={authForm.max_override_limit} onChange={e => setAuthForm({ ...authForm, max_override_limit: e.target.value })} placeholder="Optional" />
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approval Capabilities</p>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Withdrawal Override</Label>
                    <Switch checked={authForm.can_approve_withdrawal_override} onCheckedChange={v => setAuthForm({ ...authForm, can_approve_withdrawal_override: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Overdraft Approval</Label>
                    <Switch checked={authForm.can_approve_overdraft} onCheckedChange={v => setAuthForm({ ...authForm, can_approve_overdraft: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Overdraft Suspension</Label>
                    <Switch checked={authForm.can_suspend_overdraft} onCheckedChange={v => setAuthForm({ ...authForm, can_suspend_overdraft: v })} />
                  </div>
                </div>
                <Button onClick={handleAssignAuthority} disabled={saving || !authForm.user_id}>
                  {saving ? "Assigning..." : "Assign Authority"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Assign Staff Dialog — persistent (no close on outside click) */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Assign Staff</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] p-0" onPointerDownOutside={e => e.preventDefault()} onInteractOutside={e => e.preventDefault()}>
              <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  Assign Staff Member
                </DialogTitle>
                <p className="text-xs text-muted-foreground ml-10">Complete all sections to assign a new staff member with portal access and optional operational authority.</p>
              </DialogHeader>
              <ScrollArea className="max-h-[72vh]">
                <div className="px-6 py-4 space-y-5">

                  {/* Section 1: Staff Identity */}
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/40">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">1</div>
                      <span className="text-xs font-semibold">Staff Identity</span>
                      {form.user_id && form.position && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <Label className="text-xs">User ID or Email</Label>
                        <Input placeholder="Enter user UUID or email address" value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} className="mt-1" />
                        <p className="text-[10px] text-muted-foreground mt-1">The user must have an existing account on the platform.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Position / Title</Label>
                          <Input placeholder="e.g. Branch Manager" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Department</Label>
                          <Input placeholder="e.g. Operations" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Branch Assignment</Label>
                          <Select value={form.branch_id} onValueChange={v => setForm(f => ({ ...f, branch_id: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select branch (optional)" /></SelectTrigger>
                            <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Employment Type</Label>
                          <Select value={form.employment_type} onValueChange={v => setForm(f => ({ ...f, employment_type: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_time">Full-time</SelectItem>
                              <SelectItem value="part_time">Part-time</SelectItem>
                              <SelectItem value="contract">Contract</SelectItem>
                              <SelectItem value="intern">Intern</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Portal Access */}
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/40">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">2</div>
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold">Portal Access Permissions</span>
                      {form.sections.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] ml-auto">{form.sections.length} selected</Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Quick-apply a role template or manually select sections</Label>
                        <Select value={form.role_template} onValueChange={handleTemplateChange}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a role template..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Custom (manual selection)</SelectItem>
                            {Object.entries(ROLE_TEMPLATES).map(([key, tmpl]) => (
                              <SelectItem key={key} value={key}>
                                {tmpl.label} — {tmpl.sections.length} sections
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                        {ALL_PORTAL_SECTIONS.map(section => (
                          <label
                            key={section.key}
                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] cursor-pointer transition-colors ${
                              form.sections.includes(section.key)
                                ? 'border-primary/40 bg-primary/5 text-foreground'
                                : 'border-border/50 hover:bg-muted/50 text-muted-foreground'
                            }`}
                          >
                            <Checkbox
                              checked={form.sections.includes(section.key)}
                              onCheckedChange={() => toggleSection(section.key)}
                              className="h-3 w-3"
                            />
                            <span className="truncate">{section.label}</span>
                          </label>
                        ))}
                      </div>
                      {form.sections.length > 0 && (
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">{form.sections.length} portal section{form.sections.length > 1 ? 's' : ''} granted</p>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => setForm(f => ({ ...f, sections: [], role_template: '' }))}>
                            Clear all
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Operational Authority */}
                  <div className="rounded-lg border border-border/60 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border/40">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">3</div>
                      <UserCog className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold">Operational Authority</span>
                      <span className="text-[10px] text-muted-foreground">(Optional)</span>
                      <Switch checked={form.assign_authority} onCheckedChange={v => setForm(f => ({ ...f, assign_authority: v }))} className="ml-auto" />
                    </div>
                    {form.assign_authority && (
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Operational Role</Label>
                            <Select value={form.op_role_type} onValueChange={v => setForm(f => ({ ...f, op_role_type: v }))}>
                              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Object.entries(OP_ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Max Override Limit (XAF)</Label>
                            <Input type="number" value={form.max_override_limit} onChange={e => setForm(f => ({ ...f, max_override_limit: e.target.value }))} placeholder="Optional limit" className="mt-1" />
                          </div>
                        </div>

                        {/* Show linked withdrawal policy */}
                        {getPolicyForRole(form.op_role_type) && (
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                            <p className="text-[10px] font-semibold text-primary flex items-center gap-1 mb-1.5">
                              <Shield className="h-3 w-3" /> Linked Withdrawal Policy — {OP_ROLE_LABELS[form.op_role_type]}
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-[10px]">
                              <div>
                                <p className="text-muted-foreground">Single Txn</p>
                                <p className="font-semibold">{Number(getPolicyForRole(form.op_role_type).single_txn_limit).toLocaleString()} XAF</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Daily Limit</p>
                                <p className="font-semibold">{Number(getPolicyForRole(form.op_role_type).daily_total_limit).toLocaleString()} XAF</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Escalates To</p>
                                <p className="font-semibold">{OP_ROLE_LABELS[getPolicyForRole(form.op_role_type).escalation_target_role] || '—'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {!getPolicyForRole(form.op_role_type) && (
                          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5 flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                            <p className="text-[10px] text-destructive">No withdrawal policy configured for {OP_ROLE_LABELS[form.op_role_type]}. Configure one under Withdrawal Policies.</p>
                          </div>
                        )}

                        <div className="rounded-md border border-border/50 p-3 space-y-2.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Approval Capabilities</p>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Withdrawal Override</Label>
                              <p className="text-[10px] text-muted-foreground">Can approve withdrawals exceeding policy limits</p>
                            </div>
                            <Switch checked={form.can_approve_withdrawal_override} onCheckedChange={v => setForm(f => ({ ...f, can_approve_withdrawal_override: v }))} />
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Overdraft Approval</Label>
                              <p className="text-[10px] text-muted-foreground">Can approve overdraft facility requests</p>
                            </div>
                            <Switch checked={form.can_approve_overdraft} onCheckedChange={v => setForm(f => ({ ...f, can_approve_overdraft: v }))} />
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-xs">Overdraft Suspension</Label>
                              <p className="text-[10px] text-muted-foreground">Can suspend active overdraft facilities</p>
                            </div>
                            <Switch checked={form.can_suspend_overdraft} onCheckedChange={v => setForm(f => ({ ...f, can_suspend_overdraft: v }))} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </ScrollArea>

              {/* Sticky footer */}
              <div className="px-6 py-3 border-t border-border/60 bg-background flex items-center justify-between gap-3">
                <div className="text-[10px] text-muted-foreground">
                  {form.sections.length > 0 && <span>{form.sections.length} sections</span>}
                  {form.assign_authority && <span className="ml-2">+ {OP_ROLE_LABELS[form.op_role_type]} authority</span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                  <Button size="sm" onClick={handleCreate} disabled={saving || !form.user_id || !form.position}>
                    {saving ? "Assigning..." : "Assign Staff Member"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Staff", value: staff.length, icon: Users, color: "text-primary bg-primary/10 border-primary/20" },
          { label: "Active", value: activeStaff.length, icon: UserCheck, color: "text-green-600 bg-green-500/10 border-green-500/20" },
          { label: "With Authority", value: staffWithAuth.length, icon: UserCog, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
          { label: "Withdrawal Policies", value: policies.filter(p => p.status === "active").length, icon: Shield, color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roster">Staff Roster</TabsTrigger>
          <TabsTrigger value="authority">Authority & Roles</TabsTrigger>
          <TabsTrigger value="policies">Withdrawal Policies</TabsTrigger>
        </TabsList>

        {/* Tab 1: Staff Roster */}
        <TabsContent value="roster" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Staff Assignments</CardTitle>
              <CardDescription className="text-xs">{activeStaff.length} active, {inactiveStaff.length} inactive</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : staff.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No staff assignments</p>
                  <p className="text-xs mt-1">Click "Assign Staff" to add team members</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-8"></TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Position</TableHead>
                      <TableHead className="text-xs">Department</TableHead>
                      <TableHead className="text-xs">Branch</TableHead>
                      <TableHead className="text-xs">Op. Role</TableHead>
                      <TableHead className="text-xs">Portal Sections</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map(s => {
                      const auth = getAuthForUser(s.user_id);
                      const perms = permissions[s.user_id] || [];
                      const isExpanded = expandedStaff === s.id;

                      return (
                        <>
                          <TableRow key={s.id} className="cursor-pointer" onClick={() => setExpandedStaff(isExpanded ? null : s.id)}>
                            <TableCell className="py-2">
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-medium text-sm">{getStaffName(s)}</TableCell>
                            <TableCell className="text-sm">{s.position}</TableCell>
                            <TableCell className="text-sm">{s.department || '—'}</TableCell>
                            <TableCell className="text-sm">{getBranchName(s.branch_id)}</TableCell>
                            <TableCell>
                              {auth ? (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                                  {OP_ROLE_LABELS[auth.role_type] || auth.role_type}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">{perms.length} sections</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">
                                {s.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStaffActive(s.id, s.is_active)}>
                                        {s.is_active ? <Ban className="h-3.5 w-3.5 text-destructive" /> : <Unlock className="h-3.5 w-3.5 text-green-600" />}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{s.is_active ? "Deactivate" : "Reactivate"}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded && (
                            <TableRow key={`${s.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={9} className="p-4">
                                <div className="grid md:grid-cols-3 gap-4">
                                  {/* Info */}
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</p>
                                    <div className="text-xs space-y-1">
                                      <p><span className="text-muted-foreground">Employment:</span> {s.employment_type?.replace('_', ' ')}</p>
                                      <p><span className="text-muted-foreground">Start Date:</span> {s.start_date ? format(new Date(s.start_date), 'PP') : '—'}</p>
                                      <p><span className="text-muted-foreground">Assigned:</span> {s.assigned_at ? format(new Date(s.assigned_at), 'PP') : '—'}</p>
                                    </div>
                                  </div>

                                  {/* Authority */}
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operational Authority</p>
                                    {auth ? (
                                      <div className="text-xs space-y-1">
                                        <p><span className="text-muted-foreground">Role:</span> <Badge variant="outline" className="text-[10px]">{OP_ROLE_LABELS[auth.role_type]}</Badge></p>
                                        <p><span className="text-muted-foreground">Override Limit:</span> {auth.max_override_limit ? `${Number(auth.max_override_limit).toLocaleString()} XAF` : '—'}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {auth.can_approve_withdrawal_override && <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-700">Withdrawal Override</Badge>}
                                          {auth.can_approve_overdraft && <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-700">Overdraft Approval</Badge>}
                                          {auth.can_suspend_overdraft && <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-700">Overdraft Suspension</Badge>}
                                        </div>
                                        {getPolicyForRole(auth.role_type) && (
                                          <div className="mt-2 p-2 rounded border border-border/60 bg-background">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Withdrawal Policy</p>
                                            <p className="text-[10px]">Single: {Number(getPolicyForRole(auth.role_type).single_txn_limit).toLocaleString()} XAF</p>
                                            <p className="text-[10px]">Daily: {Number(getPolicyForRole(auth.role_type).daily_total_limit).toLocaleString()} XAF</p>
                                            <p className="text-[10px]">Escalation: {OP_ROLE_LABELS[getPolicyForRole(auth.role_type).escalation_target_role] || '—'}</p>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No operational authority assigned</p>
                                    )}
                                  </div>

                                  {/* Portal Sections */}
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portal Access ({perms.length})</p>
                                    {perms.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {perms.map((p: any) => (
                                          <Badge key={p.section_key} variant="outline" className="text-[9px]">
                                            {p.can_manage ? <Edit2 className="h-2.5 w-2.5 mr-0.5" /> : <Eye className="h-2.5 w-2.5 mr-0.5" />}
                                            {ALL_PORTAL_SECTIONS.find(s => s.key === p.section_key)?.label || p.section_key}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">No portal sections assigned</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Authority & Roles */}
        <TabsContent value="authority" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Operational Role Hierarchy</CardTitle>
              <CardDescription className="text-xs">Staff with banking operational authority</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {OP_ROLE_HIERARCHY.map((role, idx) => {
                    const roleAuths = authorizations.filter(a => a.role_type === role);
                    const policy = getPolicyForRole(role);
                    return (
                      <div key={role} className="rounded-lg border border-border/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={idx >= 2 ? "default" : "outline"} className="text-[10px]">
                            Level {idx + 1}
                          </Badge>
                          <span className="text-xs font-semibold">{OP_ROLE_LABELS[role]}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {roleAuths.length} staff assigned
                        </div>
                        {roleAuths.map(a => (
                          <div key={a.id} className="text-[11px] font-medium">{getStaffNameById(a.user_id)}</div>
                        ))}
                        {policy && (
                          <div className="mt-2 pt-2 border-t border-border/40">
                            <p className="text-[10px] text-muted-foreground">Limits:</p>
                            <p className="text-[10px]">Single: {Number(policy.single_txn_limit).toLocaleString()}</p>
                            <p className="text-[10px]">Daily: {Number(policy.daily_total_limit).toLocaleString()}</p>
                          </div>
                        )}
                        {!policy && (
                          <div className="mt-2 pt-2 border-t border-border/40">
                            <p className="text-[10px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> No policy
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Staff Authorizations</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : authorizations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No staff authorizations configured yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Staff</TableHead>
                      <TableHead className="text-xs">Op. Role</TableHead>
                      <TableHead className="text-xs">Override Limit</TableHead>
                      <TableHead className="text-xs">Withdrawal Override</TableHead>
                      <TableHead className="text-xs">Overdraft</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {authorizations.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs">{getStaffNameById(a.user_id)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{OP_ROLE_LABELS[a.role_type] || a.role_type}</Badge></TableCell>
                        <TableCell className="text-xs">{a.max_override_limit ? `${Number(a.max_override_limit).toLocaleString()} XAF` : "—"}</TableCell>
                        <TableCell>
                          {a.can_approve_withdrawal_override ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
                        </TableCell>
                        <TableCell>
                          {a.can_approve_overdraft ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground/40" />}
                        </TableCell>
                        <TableCell><Badge variant={a.status === "active" ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Withdrawal Policies */}
        <TabsContent value="policies" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm">Withdrawal Policies</CardTitle>
                <CardDescription className="text-xs">Role-based withdrawal limits and escalation rules</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/fi-portal/withdrawal-policies')}>
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />Manage Policies
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : policies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No withdrawal policies configured</p>
                  <p className="text-xs mt-1">Configure policies to enforce role-based transaction limits</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/fi-portal/withdrawal-policies')}>
                    Configure Policies
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Role</TableHead>
                      <TableHead className="text-xs">Single Txn Limit</TableHead>
                      <TableHead className="text-xs">Daily Limit</TableHead>
                      <TableHead className="text-xs">Auto-Approve</TableHead>
                      <TableHead className="text-xs">Dual Approval Above</TableHead>
                      <TableHead className="text-xs">Escalation Target</TableHead>
                      <TableHead className="text-xs">Currency</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map(p => {
                      const staffInRole = authorizations.filter(a => a.role_type === p.role_type);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div>
                              <Badge variant="outline" className="text-[10px]">{OP_ROLE_LABELS[p.role_type] || p.role_type}</Badge>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{staffInRole.length} staff</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium">{Number(p.single_txn_limit).toLocaleString()} {p.currency}</TableCell>
                          <TableCell className="text-xs font-medium">{Number(p.daily_total_limit).toLocaleString()} {p.currency}</TableCell>
                          <TableCell className="text-xs">{p.auto_approve_threshold ? `${Number(p.auto_approve_threshold).toLocaleString()} ${p.currency}` : '—'}</TableCell>
                          <TableCell className="text-xs">{p.requires_dual_approval_above ? `${Number(p.requires_dual_approval_above).toLocaleString()} ${p.currency}` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">{OP_ROLE_LABELS[p.escalation_target_role] || p.escalation_target_role || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{p.currency}</TableCell>
                          <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Escalation Flow Visual */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Escalation Flow</CardTitle>
              <CardDescription className="text-xs">How withdrawal requests escalate through the approval hierarchy</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {OP_ROLE_HIERARCHY.map((role, idx) => {
                  const policy = getPolicyForRole(role);
                  return (
                    <div key={role} className="flex items-center gap-2">
                      <div className={`rounded-lg border p-3 text-center min-w-[140px] ${policy ? 'border-primary/30 bg-primary/5' : 'border-border/60'}`}>
                        <p className="text-xs font-semibold">{OP_ROLE_LABELS[role]}</p>
                        {policy ? (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            ≤ {Number(policy.single_txn_limit).toLocaleString()} XAF
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-1">No policy</p>
                        )}
                      </div>
                      {idx < OP_ROLE_HIERARCHY.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
