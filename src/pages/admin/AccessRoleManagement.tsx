import { useState, useEffect } from "react";
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
import { Shield, Users, Plus, Trash2, UserPlus, Search, Key, Settings, CheckCircle, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

const SYSTEM_ROLES = ["admin", "personal", "institution", "merchant", "tpp", "staff", "moderator"] as const;
type SystemRole = (typeof SYSTEM_ROLES)[number];

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

export default function AccessRoleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  // Fetch all user roles
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*, profiles(full_name, email)").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all role permissions
  const { data: rolePermissions, isLoading: permsLoading } = useQuery({
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

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!SYSTEM_ROLES.includes(role as SystemRole)) {
        throw new Error(`Invalid role '${role}'. Please choose a supported role.`);
      }

      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast({ title: "Role Assigned", description: `Role '${selectedRole}' assigned successfully.` });
      setAssignDialogOpen(false);
      setSelectedUserId("");
      setSelectedRole("");
    },
    onError: (error: any) => {
      let description = error?.message || "Failed to assign role.";

      if (error?.code === "42501") {
        description = "You don't have permission to assign roles. Only admins can assign roles.";
      } else if (error?.code === "22P02") {
        description = "Selected role is not supported by the backend role list.";
      } else if (error?.code === "23505") {
        description = "This user already has the selected role.";
      }

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
      toast({ title: "Role Revoked" });
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

  const filteredUserRoles = searchQuery
    ? userRoles?.filter(ur => {
        const profile = ur.profiles as any;
        return `${profile?.full_name || ""} ${profile?.email || ""} ${ur.role}`.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : userRoles;

  const roleCounts = SYSTEM_ROLES.reduce((acc, role) => {
    acc[role] = userRoles?.filter(ur => ur.role === role).length || 0;
    return acc;
  }, {} as Record<string, number>);

  const [permRole, setPermRole] = useState<string>("admin");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Access & Role Management</h1>
            <p className="text-xs text-muted-foreground">Manage roles, permissions, and automatic role assignment rules</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAssignDialogOpen(true)}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />Assign Role
        </Button>
      </div>

      {/* Role Distribution */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {SYSTEM_ROLES.map(role => (
          <Card key={role} className="border-border/60">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{role}</p>
              <p className="text-xl font-bold mt-1">{roleCounts[role]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="assignments" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="assignments" className="rounded-md px-3 text-xs font-medium">
            <Users className="h-3.5 w-3.5 mr-1.5" />Role Assignments
          </TabsTrigger>
          <TabsTrigger value="permissions" className="rounded-md px-3 text-xs font-medium">
            <Shield className="h-3.5 w-3.5 mr-1.5" />Permissions Matrix
          </TabsTrigger>
          <TabsTrigger value="auto-assign" className="rounded-md px-3 text-xs font-medium">
            <Settings className="h-3.5 w-3.5 mr-1.5" />Auto-Assign Rules
          </TabsTrigger>
        </TabsList>

        {/* Role Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users or roles…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {rolesLoading ? (
                <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
              ) : (filteredUserRoles?.length || 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No role assignments found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs font-semibold">User</TableHead>
                      <TableHead className="text-xs font-semibold">Role</TableHead>
                      <TableHead className="text-xs font-semibold">Assigned</TableHead>
                      <TableHead className="text-xs font-semibold w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUserRoles?.map((ur) => {
                      const profile = ur.profiles as any;
                      return (
                        <TableRow key={ur.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{profile?.full_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{profile?.email || "—"}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={ur.role === "admin" ? "default" : "outline"} className="text-[10px] uppercase tracking-wider">{ur.role}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {ur.created_at ? format(new Date(ur.created_at), "PP") : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm(`Revoke '${ur.role}' role from ${profile?.full_name}?`)) {
                                  revokeRoleMutation.mutate(ur.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Matrix Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="text-xs">Role:</Label>
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

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold capitalize">Permissions for {permRole}</CardTitle>
              <CardDescription className="text-xs">Toggle actions per scope for this role</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold w-[150px]">Scope</TableHead>
                    {PERMISSION_ACTIONS.map(action => (
                      <TableHead key={action} className="text-xs font-semibold text-center capitalize">{action}</TableHead>
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
                  <div key={rule.trigger} className="flex items-center justify-between p-4 rounded-lg border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        {rule.trigger.includes("kyc") ? <Shield className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{rule.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to User</DialogTitle>
            <DialogDescription>Select a user and the role to assign.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent>
                  {allUsers?.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => assignRoleMutation.mutate({ userId: selectedUserId, role: selectedRole })} disabled={!selectedUserId || !selectedRole || assignRoleMutation.isPending}>
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
