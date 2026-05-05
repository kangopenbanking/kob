import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Shield, Ban, Trash2, RefreshCw, Eye, MoreVertical, ShieldOff, UserCheck, Users} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { UserDetailsDialog } from '@/components/admin/UserDetailsDialog';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { SearchFilter } from '@/components/SearchFilter';
import { MerchantIntegrityAlert } from '@/components/admin/MerchantIntegrityAlert';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  roles: string[];
  status: string;
  institution_name?: string;
  branch_name?: string;
  suspended_at?: string;
  suspended_reason?: string;
}

export default function UserManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [institutionFilter, setInstitutionFilter] = useState<string>('all');

  // Suspend/Delete state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionTargetUser, setActionTargetUser] = useState<UserProfile | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Primary role change state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleDialogTarget, setRoleDialogTarget] = useState<UserProfile | null>(null);
  const [newPrimaryRole, setNewPrimaryRole] = useState<string>('personal');
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    loadUsers();
    loadInstitutions();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      toast.error('Access denied');
      navigate('/');
    }
  };

  const loadInstitutions = async () => {
    const { data } = await supabase
      .from('institutions')
      .select('id, institution_name')
      .order('institution_name');
    
    if (data) setInstitutions(data);
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const { data: assignments } = await supabase
        .from('staff_assignments')
        .select(`
          user_id,
          institutions(institution_name),
          branches(branch_name)
        `)
        .eq('is_active', true);

      const usersWithRoles = profiles?.map(profile => {
        const assignment = assignments?.find(a => a.user_id === profile.id);
        return {
          ...profile,
          roles: userRoles?.filter(r => r.user_id === profile.id).map(r => r.role) || [],
          status: (profile as any).account_status || 'active',
          suspended_at: (profile as any).suspended_at,
          suspended_reason: (profile as any).suspended_reason,
          institution_name: assignment?.institutions?.institution_name,
          branch_name: assignment?.branches?.branch_name
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      logger.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const assignRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: role as 'admin' | 'moderator' | 'institution' });

      if (error) throw error;

      toast.success(`Role ${role} assigned successfully`);
      loadUsers();
    } catch (error) {
      logger.error('Error assigning role:', error);
      toast.error('Failed to assign role');
    }
  };

  const removeRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as 'admin' | 'moderator' | 'institution');

      if (error) throw error;

      toast.success(`Role ${role} removed successfully`);
      loadUsers();
    } catch (error) {
      logger.error('Error removing role:', error);
      toast.error('Failed to remove role');
    }
  };

  const changePrimaryRole = async () => {
    if (!roleDialogTarget) return;
    setRoleChangeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          action: 'set_primary_role',
          target_user_id: roleDialogTarget.id,
          primary_role: newPrimaryRole,
          reason: actionReason || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Primary role set to "${newPrimaryRole}"`);
      setRoleDialogOpen(false);
      setRoleDialogTarget(null);
      setActionReason('');
      loadUsers();
    } catch (error: any) {
      logger.error('Error changing primary role:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to change role'));
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleSuspendUser = async () => {
    if (!actionTargetUser) return;
    setActionLoading(true);
    try {
      const isSuspended = actionTargetUser.status === 'suspended';
      
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          action: isSuspended ? 'unsuspend' : 'suspend',
          target_user_id: actionTargetUser.id,
          reason: actionReason
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(isSuspended ? 'User unsuspended successfully' : 'User suspended successfully');
      setSuspendDialogOpen(false);
      setActionReason('');
      setActionTargetUser(null);
      loadUsers();
    } catch (error: any) {
      logger.error('Error suspending user:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to update user status'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!actionTargetUser) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', {
        body: {
          action: 'delete',
          target_user_id: actionTargetUser.id,
          reason: actionReason
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('User and all associated data deleted permanently');
      setDeleteDialogOpen(false);
      setActionReason('');
      setActionTargetUser(null);
      loadUsers();
    } catch (error: any) {
      logger.error('Error deleting user:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to delete user'));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesInstitution = institutionFilter === 'all' || 
                               (user.institution_name && institutions.find(i => i.id === institutionFilter)?.institution_name === user.institution_name);
    
    return matchesSearch && matchesRole && matchesStatus && matchesInstitution;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'moderator': return 'default';
      default: return 'secondary';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'suspended':
        return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Suspended</Badge>;
      case 'active':
      default:
        return <Badge variant="outline" className="gap-1"><UserCheck className="h-3 w-3" />Active</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
      <AdminPageHeader icon={Users} title="User Management" description="Manage platform users, roles, and permissions" />
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin"  />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <MerchantIntegrityAlert />

      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <SearchFilter
              searchTerm={searchQuery}
              onSearchChange={setSearchQuery}
              placeholder="Search by email or name..."
              filterOptions={[
                { label: "Admin", value: "admin" },
                { label: "Moderator", value: "moderator" },
                { label: "User", value: "user" },
              ]}
              selectedFilter={roleFilter}
              onFilterChange={setRoleFilter}
            />
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={institutionFilter} onValueChange={setInstitutionFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by institution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Institutions</SelectItem>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.institution_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={user.status === 'suspended' ? 'opacity-60' : ''}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.full_name || 'N/A'}</div>
                      <div className="text-sm text-muted-foreground">{user.id.substring(0, 8)}...</div>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.institution_name || '-'}</TableCell>
                  <TableCell>{user.branch_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {user.roles.length > 0 ? (
                        user.roles.map(role => (
                          <Badge key={role} variant={getRoleBadgeVariant(role)}>
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">No roles</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedUserId(user.id);
                          setDetailsDialogOpen(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => assignRole(user.id, 'admin')}>
                          <Shield className="h-4 w-4 mr-2" />
                          Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => assignRole(user.id, 'moderator')}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Make Moderator
                        </DropdownMenuItem>
                        {user.roles.includes('admin') && (
                          <DropdownMenuItem onClick={() => removeRole(user.id, 'admin')}>
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Admin
                          </DropdownMenuItem>
                        )}
                        {user.roles.includes('moderator') && (
                          <DropdownMenuItem onClick={() => removeRole(user.id, 'moderator')}>
                            <ShieldOff className="h-4 w-4 mr-2" />
                            Remove Moderator
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setActionTargetUser(user);
                            setActionReason('');
                            setSuspendDialogOpen(true);
                          }}
                          className={user.status === 'suspended' ? 'text-emerald-600' : 'text-amber-600'}
                        >
                          {user.status === 'suspended' ? (
                            <><UserCheck className="h-4 w-4 mr-2" />Unsuspend User</>
                          ) : (
                            <><Ban className="h-4 w-4 mr-2" />Suspend User</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setActionTargetUser(user);
                            setActionReason('');
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suspend/Unsuspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTargetUser?.status === 'suspended' ? 'Unsuspend User' : 'Suspend User'}
            </DialogTitle>
            <DialogDescription>
              {actionTargetUser?.status === 'suspended'
                ? `Reactivate the account for ${actionTargetUser?.full_name || actionTargetUser?.email}. They will be able to log in again.`
                : `Suspend the account for ${actionTargetUser?.full_name || actionTargetUser?.email}. They will be unable to log in until unsuspended.`
              }
            </DialogDescription>
          </DialogHeader>
          {actionTargetUser?.status !== 'suspended' && (
            <div className="space-y-2">
              <Label htmlFor="suspend-reason">Reason for suspension</Label>
              <Textarea
                id="suspend-reason"
                placeholder="Enter reason for suspension..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
            </div>
          )}
          {actionTargetUser?.status === 'suspended' && actionTargetUser.suspended_reason && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium text-muted-foreground mb-1">Original suspension reason:</p>
              <p>{actionTargetUser.suspended_reason}</p>
              {actionTargetUser.suspended_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Suspended on {new Date(actionTargetUser.suspended_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant={actionTargetUser?.status === 'suspended' ? 'default' : 'destructive'}
              onClick={handleSuspendUser}
              disabled={actionLoading}
            >
              {actionLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              {actionTargetUser?.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete User</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to permanently delete <strong>{actionTargetUser?.full_name || actionTargetUser?.email}</strong> and all their associated data. This includes:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>User profile and authentication credentials</li>
                <li>All roles and permissions</li>
                <li>Bank accounts, transactions, and balances</li>
                <li>Consent records (AISP/PISP)</li>
                <li>KYC verifications and documents</li>
                <li>Mobile money and bank transfer history</li>
                <li>Staff assignments and portal permissions</li>
                <li>Notifications and security logs</li>
              </ul>
              <p className="font-semibold text-destructive">This action cannot be undone.</p>
              <div className="pt-2 space-y-2">
                <Label htmlFor="delete-reason">Reason for deletion</Label>
                <Textarea
                  id="delete-reason"
                  placeholder="Enter reason for account deletion..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteUser();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        userId={selectedUserId}
        onUpdate={loadUsers}
      />
      
      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onUserCreated={loadUsers}
      />
    </div>
  );
}
