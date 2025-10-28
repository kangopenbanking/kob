import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield, User } from "lucide-react";

const PERMISSION_SCOPES = [
  'users', 'transactions', 'accounts', 'reports', 
  'settings', 'compliance', 'api', 'branches', 
  'fees', 'webhooks', 'audit_logs'
];

const PERMISSION_ACTIONS = [
  'view', 'create', 'update', 'delete', 'approve', 'export'
];

export function PermissionManager() {
  const { toast } = useToast();
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [userOverrides, setUserOverrides] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('admin');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load role permissions
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role');

      if (rolePerms) setRolePermissions(rolePerms);

      // Load user overrides
      const { data: userPerms } = await supabase
        .from('user_permission_overrides')
        .select('*, profiles(full_name, email)')
        .or('expires_at.is.null,expires_at.gt.now()');

      if (userPerms) setUserOverrides(userPerms);

      // Load users
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (userData) setUsers(userData);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getRolePermission = (role: string, scope: string): any[] => {
    const perm = rolePermissions.find(p => p.role === role && p.scope === scope);
    return perm?.actions || [];
  };

  const hasRoleAction = (role: string, scope: string, action: string): boolean => {
    const actions = getRolePermission(role, scope);
    return actions.includes(action);
  };

  const toggleRolePermission = async (role: string, scope: string, action: string) => {
    const currentActions = getRolePermission(role, scope);
    const newActions = currentActions.includes(action)
      ? currentActions.filter(a => a !== action)
      : [...currentActions, action];

    try {
      const existing = rolePermissions.find(p => p.role === role && p.scope === scope);

      if (existing) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ actions: newActions as any })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .insert({
            role: role as any,
            scope: scope as any,
            actions: newActions as any
          });

        if (error) throw error;
      }

      toast({ title: "Success", description: "Permission updated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getUserOverride = (userId: string, scope: string): any[] => {
    const override = userOverrides.find(o => o.user_id === userId && o.scope === scope);
    return override?.actions || [];
  };

  const hasUserAction = (userId: string, scope: string, action: string): boolean => {
    const actions = getUserOverride(userId, scope);
    return actions.includes(action);
  };

  const toggleUserPermission = async (userId: string, scope: string, action: string) => {
    const currentActions = getUserOverride(userId, scope);
    const newActions = currentActions.includes(action)
      ? currentActions.filter(a => a !== action)
      : [...currentActions, action];

    try {
      const existing = userOverrides.find(o => o.user_id === userId && o.scope === scope);

      if (existing) {
        if (newActions.length === 0) {
          // Remove override if no actions
          const { error } = await supabase
            .from('user_permission_overrides')
            .delete()
            .eq('id', existing.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('user_permission_overrides')
            .update({ actions: newActions as any })
            .eq('id', existing.id);

          if (error) throw error;
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('user_permission_overrides')
          .insert({
            user_id: userId,
            scope: scope as any,
            actions: newActions as any,
            granted_by: user?.id
          });

        if (error) throw error;
      }

      toast({ title: "Success", description: "User permission override updated" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Permission Manager</h2>
        <p className="text-muted-foreground">Configure role-based and user-specific permissions</p>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">
            <Shield className="mr-2 h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="users">
            <User className="mr-2 h-4 w-4" />
            User Overrides
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Select Role:</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Permissions for {selectedRole}</CardTitle>
              <CardDescription>
                Configure what actions users with this role can perform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {PERMISSION_SCOPES.map((scope) => (
                  <div key={scope} className="border rounded-lg p-4">
                    <div className="font-medium mb-3 capitalize flex items-center gap-2">
                      {scope.replace('_', ' ')}
                      <Badge variant="outline">
                        {getRolePermission(selectedRole, scope).length} actions
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 gap-4">
                      {PERMISSION_ACTIONS.map((action) => (
                        <div key={action} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${scope}-${action}`}
                            checked={hasRoleAction(selectedRole, scope, action)}
                            onCheckedChange={() => toggleRolePermission(selectedRole, scope, action)}
                          />
                          <Label 
                            htmlFor={`${scope}-${action}`} 
                            className="cursor-pointer capitalize text-sm"
                          >
                            {action}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Select User:</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <Card>
              <CardHeader>
                <CardTitle>Permission Overrides</CardTitle>
                <CardDescription>
                  Grant specific permissions to this user beyond their role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {PERMISSION_SCOPES.map((scope) => (
                    <div key={scope} className="border rounded-lg p-4">
                      <div className="font-medium mb-3 capitalize flex items-center gap-2">
                        {scope.replace('_', ' ')}
                        <Badge variant="outline">
                          {getUserOverride(selectedUser, scope).length} overrides
                        </Badge>
                      </div>
                      <div className="grid grid-cols-6 gap-4">
                        {PERMISSION_ACTIONS.map((action) => (
                          <div key={action} className="flex items-center space-x-2">
                            <Checkbox
                              id={`user-${scope}-${action}`}
                              checked={hasUserAction(selectedUser, scope, action)}
                              onCheckedChange={() => toggleUserPermission(selectedUser, scope, action)}
                            />
                            <Label 
                              htmlFor={`user-${scope}-${action}`}
                              className="cursor-pointer capitalize text-sm"
                            >
                              {action}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
