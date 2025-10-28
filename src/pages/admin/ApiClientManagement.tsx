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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Key, Copy, Eye, EyeOff, RefreshCw, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface ApiClient {
  id: string;
  client_id: string;
  client_name: string;
  institution_id: string;
  scopes: any;
  grant_types: any;
  redirect_uris: any;
  is_active: boolean;
  created_at: string;
}

export default function ApiClientManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClientData, setNewClientData] = useState({
    client_name: '',
    redirect_uris: '',
    scopes: 'accounts,transactions',
    grant_types: 'authorization_code,refresh_token',
    institution_id: ''
  });
  const [createdSecret, setCreatedSecret] = useState<{ client_id: string; client_secret: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    checkAdminAccess();
    loadClients();
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

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      logger.error('Error loading API clients:', error);
      toast.error('Failed to load API clients');
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-client', {
        body: {
          client_name: newClientData.client_name,
          redirect_uris: newClientData.redirect_uris.split(',').map(u => u.trim()),
          scopes: newClientData.scopes.split(',').map(s => s.trim()),
          grant_types: newClientData.grant_types.split(',').map(g => g.trim()),
          institution_id: newClientData.institution_id || null
        }
      });

      if (error) throw error;

      setCreatedSecret({
        client_id: data.client_id,
        client_secret: data.client_secret
      });

      toast.success('API Client created successfully');
      loadClients();
      
      setNewClientData({
        client_name: '',
        redirect_uris: '',
        scopes: 'accounts,transactions',
        grant_types: 'authorization_code,refresh_token',
        institution_id: ''
      });
    } catch (error) {
      logger.error('Error creating API client:', error);
      toast.error('Failed to create API client');
    }
  };

  const toggleClientStatus = async (clientId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('api_clients')
        .update({ is_active: !currentStatus })
        .eq('id', clientId);

      if (error) throw error;

      toast.success(`Client ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadClients();
    } catch (error) {
      logger.error('Error toggling client status:', error);
      toast.error('Failed to update client status');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
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
          <h1 className="text-3xl font-bold">API Client Management</h1>
          <p className="text-muted-foreground">Manage OAuth 2.0 API clients and credentials</p>
        </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>API Clients ({clients.length})</CardTitle>
              <CardDescription>View and manage registered API clients</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Client
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New API Client</DialogTitle>
                  <DialogDescription>
                    Generate OAuth 2.0 credentials for a new application
                  </DialogDescription>
                </DialogHeader>
                
                {!createdSecret ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Client Name</Label>
                      <Input
                        value={newClientData.client_name}
                        onChange={(e) => setNewClientData({ ...newClientData, client_name: e.target.value })}
                        placeholder="My Application"
                      />
                    </div>
                    <div>
                      <Label>Redirect URIs (comma-separated)</Label>
                      <Textarea
                        value={newClientData.redirect_uris}
                        onChange={(e) => setNewClientData({ ...newClientData, redirect_uris: e.target.value })}
                        placeholder="https://example.com/callback"
                      />
                    </div>
                    <div>
                      <Label>Scopes (comma-separated)</Label>
                      <Input
                        value={newClientData.scopes}
                        onChange={(e) => setNewClientData({ ...newClientData, scopes: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Grant Types (comma-separated)</Label>
                      <Input
                        value={newClientData.grant_types}
                        onChange={(e) => setNewClientData({ ...newClientData, grant_types: e.target.value })}
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={createClient}>Create Client</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                        ⚠️ Save these credentials now!
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        The client secret will only be shown once. Make sure to copy and store it securely.
                      </p>
                    </div>
                    
                    <div>
                      <Label>Client ID</Label>
                      <div className="flex gap-2">
                        <Input value={createdSecret.client_id} readOnly />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(createdSecret.client_id, 'Client ID')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Client Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          value={createdSecret.client_secret}
                          readOnly
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(createdSecret.client_secret, 'Client Secret')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button onClick={() => {
                        setCreatedSecret(null);
                        setShowCreateDialog(false);
                      }}>
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client Name</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.client_name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {client.client_id.substring(0, 20)}...
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(Array.isArray(client.scopes) ? client.scopes : []).map((scope: string) => (
                        <Badge key={scope} variant="secondary" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.is_active ? (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <Ban className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(client.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleClientStatus(client.id, client.is_active)}
                    >
                      {client.is_active ? 'Deactivate' : 'Activate'}
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
