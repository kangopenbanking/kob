import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Shield, Users, Trash2, UserPlus, Search, Key, Settings, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const SYSTEM_ROLES = ["admin", "personal", "institution", "merchant", "tpp", "staff", "moderator", "developer"] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  personal: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  institution: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20",
  merchant: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  tpp: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  staff: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20",
  moderator: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
  developer: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
  custom: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full system access",
  personal: "Standard user",
  institution: "Financial institution",
  merchant: "Business merchant",
  tpp: "Third-party provider",
  staff: "Institution staff",
  moderator: "Content moderator",
  developer: "API & developer access",
  custom: "Custom defined role",
};

const PERMISSION_SCOPES = [
  "users", "transactions", "accounts", "reports", "settings", "compliance", "api", "branches", "fees", "webhooks", "audit_logs"
] as const;

const PERMISSION_ACTIONS = ["view", "create", "update", "delete", "approve", "export"] as const;

const AUTO_ASSIGN_RULES = [
  { trigger: "registration", role: "personal", description: "Assign 'personal' role on user registration" },
  { trigger: "kyc_approved", role: "verified_basic", description: "Assign 'verified_basic' when basic KYC is approved" },
  { trigger: "kyc_enhanced", role: "verified_enhanced", description: "Assign 'verified_enhanced' when enhanced KYC tier is approved" },
  { trigger: "merchant_register", role: "merchant", description: "Assign 'merchant' on merchant registration" },
  { trigger: "institution_approved", role: "institution", description: "Assign 'institution' when institution is approved" },
];

interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
}

export default function AccessRoleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [permRole, setPermRole] = useState<string>("admin");

  // Fetch user roles + profiles with separate queries joined client-side
  const { data: userRoles, isLoading: rolesLoading, refetch: refetchRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      // Fetch roles
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .order("created_at", { ascending: false });
      if (rolesErr) throw rolesErr;

      if (!roles || roles.length === 0) return [] as UserRoleRow[];

      // Get unique user IDs
      const userIds = [...new Set(roles.map(r => r.user_id))];

      // Fetch profiles for those user IDs
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      // Merge
      return roles.map(r => ({
        ...r,
        full_name: profileMap.get(r.user_id)?.full_name || null,
        email: profileMap.get(r.user_id)?.email || null,
      })) as UserRoleRow[];
    },
  });

  // Fetch all role permissions
  const { data: rolePermissions } = useQuery({
    queryKey: ["admin-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*").order("role");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users for assignment
  const { data: allUsers } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Resolve the effective role (handles "custom" selection)
  const getEffectiveRole = () => {
    if (selectedRole === "__custom__") return customRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    return selectedRole;
  };

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!role) throw new Error("Please select or enter a role.");
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      const effectiveRole = getEffectiveRole();
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast({ title: "Role Assigned", description: `Role '${effectiveRole}' assigned successfully.` });
      setAssignDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("");
      setCustomRoleName("");
    },
    onError: (error: any) => {
      let description = error?.message || "Failed to assign role.";
      if (error?.code === "42501") description = "You don't have permission to assign roles. Only admins can do this.";
      else if (error?.code === "22P02") description = "Selected role is not supported by the system.";
      else if (error?.code === "23505") description = "This user already has the selected role.";
      toast({ title: "Error", description, variant: "destructive" });
    },
  });

  // Revoke role mutation
  const revokeRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast({ title: "Role Revoked", description: "The role has been revoked successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Toggle permission mutation
  const togglePermissionMutation = useMutation({
    mutationFn: async ({ role, scope, action, currentActions }: { role: string; scope: string; action: string; currentActions: string[] }) => {
      const newActions = currentActions.includes(action)
        ? currentActions.filter(a => a !== action)
        : [...currentActions, action];

      const existing = rolePermissions?.find(p => p.role === role && p.scope === scope);
      if (existing) {
        const { error } = await supabase.from("role_permissions").update({ actions: newActions as any }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").insert({ role: role as any, scope: scope as any, actions: newActions as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-role-permissions"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getRoleActions = (role: string, scope: string): string[] => {
    return rolePermissions?.find(p => p.role === role && p.scope === scope)?.actions || [];
  };

  const filteredUserRoles = (userRoles || []).filter(ur => {
    const matchesSearch = !searchQuery || `${ur.full_name || ""} ${ur.email || ""} ${ur.role}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || ur.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = SYSTEM_ROLES.reduce((acc, role) => {
    acc[role] = userRoles?.filter(ur => ur.role === role).length || 0;
    return acc;
  }, {} as Record<string, number>);

  const totalAssignments = userRoles?.length || 0;

  const getInitials = (name: string | null, email: string | null) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return "?";
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Shield} title="Access & Role Management" description="Manage user roles, permissions, and access control policies" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm">
            <Key className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetchRoles()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
          </Button>
          <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />Assign Role
          </Button>
        </div>
      </div>

      {/* Role Distribution Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        {SYSTEM_ROLES.map(role => {
          const count = roleCounts[role];
          const isActive = roleFilter === role;
          return (
            <Card
              key={role}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${isActive ? "ring-2 ring-primary shadow-md" : "border-border/60 hover:border-border"}`}
              onClick={() => setRoleFilter(isActive ? "all" : role)}
            >
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className={`text-[9px] uppercase tracking-widest font-semibold border ${ROLE_COLORS[role] || ""}`}>
                    {role}
                  </Badge>
                </div>
                <p className="text-2xl font-bold mt-2">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {roleFilter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            Filtering: {roleFilter}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setRoleFilter("all")}>
            Clear filter
          </Button>
        </div>
      )}

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="assignments" className="rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5 mr-1.5" />Assignments
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm">
            <Shield className="h-3.5 w-3.5 mr-1.5" />Permissions
          </TabsTrigger>
          <TabsTrigger value="auto-assign" className="rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm">
            <Settings className="h-3.5 w-3.5 mr-1.5" />Auto-Assign
          </TabsTrigger>
        </TabsList>

        {/* Role Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or role…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              {filteredUserRoles.length} result{filteredUserRoles.length !== 1 ? "s" : ""}
            </p>
          </div>

          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-0">
              {rolesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading role assignments…</p>
                </div>
              ) : filteredUserRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Users className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">No role assignments found</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {searchQuery || roleFilter !== "all" ? "Try adjusting your search or filter" : "Assign a role to get started"}
                    </p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/30">
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">User</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Assigned On</TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserRoles.map((ur) => (
                      <TableRow key={ur.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 text-[11px]">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getInitials(ur.full_name, ur.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{ur.full_name || "Unknown User"}</p>
                              <p className="text-xs text-muted-foreground truncate">{ur.email || "No email"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold border ${ROLE_COLORS[ur.role] || ""}`}>
                            {ur.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {ur.created_at ? format(new Date(ur.created_at), "MMM d, yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              if (confirm(`Revoke '${ur.role}' role from ${ur.full_name || "this user"}?`)) {
                                revokeRoleMutation.mutate(ur.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-xs font-medium">Role:</Label>
            <Select value={permRole} onValueChange={setPermRole}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYSTEM_ROLES.map(r => (
                  <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20">
              <CardTitle className="text-sm font-semibold capitalize flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Permissions for {permRole}
              </CardTitle>
              <CardDescription className="text-xs">Toggle actions per scope for this role</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/30">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider w-[150px]">Scope</TableHead>
                    {PERMISSION_ACTIONS.map(action => (
                      <TableHead key={action} className="text-[11px] font-semibold uppercase tracking-wider text-center">{action}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSION_SCOPES.map(scope => {
                    const currentActions = getRoleActions(permRole, scope);
                    return (
                      <TableRow key={scope}>
                        <TableCell className="font-medium text-sm capitalize">{scope.replace(/_/g, " ")}</TableCell>
                        {PERMISSION_ACTIONS.map(action => (
                          <TableCell key={action} className="text-center">
                            <Checkbox
                              checked={currentActions.includes(action)}
                              onCheckedChange={() => {
                                togglePermissionMutation.mutate({ role: permRole, scope, action, currentActions });
                              }}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Assign Rules Tab */}
        <TabsContent value="auto-assign" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Automatic Role Assignment Rules</CardTitle>
              <CardDescription className="text-xs">Roles are automatically assigned based on registration type and KYC verification tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {AUTO_ASSIGN_RULES.map(rule => (
                  <div key={rule.trigger} className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        {rule.trigger.includes("kyc") ? <Shield className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rule.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">Trigger: {rule.trigger}</Badge>
                          <Badge variant="secondary" className="text-[10px]">→ {rule.role}</Badge>
                        </div>
                      </div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Active Database Triggers</CardTitle>
              <CardDescription className="text-xs">These triggers run automatically in the database</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "assign_default_personal_role", desc: "Assigns 'personal' role to new users on auth signup", status: "active" },
                  { name: "assign_merchant_role_on_create", desc: "Assigns 'merchant' role when merchant profile is created", status: "active" },
                ].map(trigger => (
                  <div key={trigger.name} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-mono">{trigger.name}</p>
                      <p className="text-xs text-muted-foreground">{trigger.desc}</p>
                    </div>
                    <Badge variant="default" className="text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1" />{trigger.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assign Role Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Assign Role to User
            </DialogTitle>
            <DialogDescription>Select a user and the role you want to assign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent>
                  {allUsers?.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="font-medium">{u.full_name || "Unnamed"}</span>
                      <span className="text-muted-foreground ml-1.5 text-xs">({u.email})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Role</Label>
              <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); if (v !== "__custom__") setCustomRoleName(""); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map(r => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-semibold border ${ROLE_COLORS[r] || ""}`}>{r}</Badge>
                        <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-semibold border ${ROLE_COLORS.custom}`}>custom</Badge>
                      <span className="text-xs text-muted-foreground">Enter a custom role name</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedRole === "__custom__" && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Custom Role Name</Label>
                <Input
                  placeholder="e.g. auditor, support_agent…"
                  value={customRoleName}
                  onChange={e => setCustomRoleName(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Must match an existing role in the database enum. Spaces will be converted to underscores.
                </p>
              </div>
            )}

            {selectedUserId && (selectedRole && selectedRole !== "__custom__" || customRoleName.trim()) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/40">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  This will grant <strong className="text-foreground">{getEffectiveRole()}</strong> privileges to the selected user immediately.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => assignRoleMutation.mutate({ userId: selectedUserId, role: getEffectiveRole() })}
              disabled={!selectedUserId || !getEffectiveRole() || assignRoleMutation.isPending}
            >
              {assignRoleMutation.isPending ? (
                <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Assigning…</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5 mr-1.5" />Assign Role</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
