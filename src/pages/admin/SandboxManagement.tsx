import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Trash2, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface SandboxAccount {
  id: string;
  account_id: string;
  account_holder_name: string;
  account_type: string;
  account_subtype: string;
  currency: string;
  identification_value: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

export default function SandboxManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<SandboxAccount[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAccount, setNewAccount] = useState({
    account_holder_name: '',
    account_type: 'Personal',
    account_subtype: 'Current',
    currency: 'XAF',
    initial_balance: '100000'
  });

  useEffect(() => {
    checkAdminAccess();
    loadSandboxAccounts();
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

  const loadSandboxAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('admin-sandbox-accounts', {
        method: 'GET'
      });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      logger.error('Error loading sandbox accounts:', error);
      toast.error('Failed to load sandbox accounts');
    } finally {
      setLoading(false);
    }
  };

  const createSandboxAccount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-sandbox-accounts', {
        method: 'POST',
        body: {
          ...newAccount,
          initial_balance: parseFloat(newAccount.initial_balance)
        }
      });

      if (error) throw error;

      toast.success('Sandbox account created successfully');
      setShowCreateDialog(false);
      loadSandboxAccounts();
      
      setNewAccount({
        account_holder_name: '',
        account_type: 'Personal',
        account_subtype: 'Current',
        currency: 'XAF',
        initial_balance: '100000'
      });
    } catch (error) {
      logger.error('Error creating sandbox account:', error);
      toast.error('Failed to create sandbox account');
    }
  };

  const deleteSandboxAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('sandbox_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast.success('Sandbox account deleted');
      loadSandboxAccounts();
    } catch (error) {
      logger.error('Error deleting sandbox account:', error);
      toast.error('Failed to delete sandbox account');
    }
  };

  const formatBalance = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sandbox Management</h1>
          <p className="text-muted-foreground">Manage test accounts for API development</p>
        </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Sandbox Accounts ({accounts.length})</CardTitle>
              <CardDescription>Test accounts for API integration testing</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Test Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Sandbox Account</DialogTitle>
                  <DialogDescription>
                    Generate a new test account for API development
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Account Holder Name</Label>
                    <Input
                      value={newAccount.account_holder_name}
                      onChange={(e) => setNewAccount({ ...newAccount, account_holder_name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div>
                    <Label>Account Type</Label>
                    <Select
                      value={newAccount.account_type}
                      onValueChange={(value) => setNewAccount({ ...newAccount, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Personal">Personal</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Account Subtype</Label>
                    <Select
                      value={newAccount.account_subtype}
                      onValueChange={(value) => setNewAccount({ ...newAccount, account_subtype: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Current">Current Account</SelectItem>
                        <SelectItem value="Savings">Savings Account</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Currency</Label>
                    <Select
                      value={newAccount.currency}
                      onValueChange={(value) => setNewAccount({ ...newAccount, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAF">XAF - Central African CFA Franc</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Initial Balance</Label>
                    <Input
                      type="number"
                      value={newAccount.initial_balance}
                      onChange={(e) => setNewAccount({ ...newAccount, initial_balance: e.target.value })}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button onClick={createSandboxAccount}>Create Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account ID</TableHead>
                <TableHead>Holder Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {account.account_id}
                    </code>
                  </TableCell>
                  <TableCell className="font-medium">{account.account_holder_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {account.account_type} - {account.account_subtype}
                    </Badge>
                  </TableCell>
                  <TableCell>{account.identification_value}</TableCell>
                  <TableCell className="font-mono">
                    {formatBalance(account.balance, account.currency)}
                  </TableCell>
                  <TableCell>
                    {account.is_active ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteSandboxAccount(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
