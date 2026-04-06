import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Lock, Unlock, ShieldOff, RefreshCw, Shield, Users, AlertTriangle, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { SearchFilter } from '@/components/SearchFilter';
import { format, formatDistanceToNow } from 'date-fns';

interface LockoutUser {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  pin_attempts: number | null;
  pin_locked_until: string | null;
  has_pin: boolean;
  is_locked: boolean;
}

export default function PinLockoutManagement() {
  const [lockedUsers, setLockedUsers] = useState<LockoutUser[]>([]);
  const [allPinUsers, setAllPinUsers] = useState<LockoutUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; userId: string; userName: string }>({
    open: false, action: '', userId: '', userName: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-pin-lockout', {
        body: { action: 'list' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to load');
      setLockedUsers(data.locked_users || []);
      setAllPinUsers(data.all_pin_users || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load lockout data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = async (action: string, userId: string) => {
    setActionLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke('admin-pin-lockout', {
        body: { action, user_id: userId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Action failed');
      toast.success(data.message || 'Action completed');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
      setConfirmDialog({ open: false, action: '', userId: '', userName: '' });
    }
  };

  const openConfirm = (action: string, userId: string, userName: string) => {
    setConfirmDialog({ open: true, action, userId, userName });
  };

  const activelyLocked = lockedUsers.filter(u => u.is_locked);
  const failedAttempts = lockedUsers.filter(u => !u.is_locked && (u.pin_attempts || 0) > 0);

  const filterUsers = (users: LockoutUser[]) =>
    users.filter(u => {
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      return (u.full_name?.toLowerCase().includes(q)) ||
        (u.phone_number?.includes(q)) ||
        (u.email?.toLowerCase().includes(q));
    });

  const renderUserRow = (user: LockoutUser, showActions = true) => (
    <TableRow key={user.id}>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{user.full_name || 'N/A'}</p>
          <p className="text-xs text-muted-foreground">{user.email || '—'}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm">{user.phone_number || '—'}</TableCell>
      <TableCell>
        {user.is_locked ? (
          <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
        ) : (user.pin_attempts || 0) > 0 ? (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800"><AlertTriangle className="h-3 w-3" /> {user.pin_attempts} attempts</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-emerald-600"><Shield className="h-3 w-3" /> OK</Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {user.pin_locked_until ? (
          user.is_locked
            ? `Unlocks ${formatDistanceToNow(new Date(user.pin_locked_until), { addSuffix: true })}`
            : `Expired ${format(new Date(user.pin_locked_until), 'MMM d, HH:mm')}`
        ) : '—'}
      </TableCell>
      {showActions && (
        <TableCell>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs"
              disabled={actionLoading === user.id || ((user.pin_attempts || 0) === 0 && !user.is_locked)}
              onClick={() => openConfirm('clear_lockout', user.id, user.full_name || user.email || 'this user')}
            >
              <Unlock className="h-3 w-3" /> Clear Lockout
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-xs text-destructive hover:text-destructive"
              disabled={actionLoading === user.id}
              onClick={() => openConfirm('reset_pin', user.id, user.full_name || user.email || 'this user')}
            >
              <ShieldOff className="h-3 w-3" /> Reset PIN
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="PIN Lockout Management"
        description="View and manage user PIN lockouts, clear failed attempts, and reset PINs"
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <Lock className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activelyLocked.length}</p>
                <p className="text-xs text-muted-foreground">Actively Locked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{failedAttempts.length}</p>
                <p className="text-xs text-muted-foreground">Failed Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allPinUsers.length}</p>
                <p className="text-xs text-muted-foreground">Users with PINs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Shield className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allPinUsers.filter(u => !u.is_locked && (u.pin_attempts || 0) === 0).length}</p>
                <p className="text-xs text-muted-foreground">Healthy Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            placeholder="Search by name, email, or phone..."
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="locked">
        <TabsList>
          <TabsTrigger value="locked" className="gap-1">
            <Lock className="h-3.5 w-3.5" /> Locked / At Risk ({lockedUsers.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1">
            <Users className="h-3.5 w-3.5" /> All PIN Users ({allPinUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locked">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Locked &amp; At-Risk Accounts</CardTitle>
              <CardDescription>Users with active lockouts or recent failed PIN attempts</CardDescription>
            </CardHeader>
            <CardContent>
              {filterUsers(lockedUsers).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Shield className="h-10 w-10 mb-3 text-emerald-400" />
                  <p className="font-medium">No locked accounts</p>
                  <p className="text-sm">All users are in good standing</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lockout</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filterUsers(lockedUsers).map(u => renderUserRow(u))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Users with PINs</CardTitle>
              <CardDescription>Complete list of users who have set up a PIN code</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lockout</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{filterUsers(allPinUsers).map(u => renderUserRow(u))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'clear_lockout' ? 'Clear PIN Lockout' : 'Reset User PIN'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'clear_lockout'
                ? `This will reset the failed attempt counter and remove the lockout for ${confirmDialog.userName}. They will be able to try logging in with their PIN again.`
                : `This will completely remove the PIN for ${confirmDialog.userName}. They will be required to set a new PIN on their next login. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction(confirmDialog.action, confirmDialog.userId)}
              className={confirmDialog.action === 'reset_pin' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {actionLoading ? 'Processing...' : confirmDialog.action === 'clear_lockout' ? 'Clear Lockout' : 'Reset PIN'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
