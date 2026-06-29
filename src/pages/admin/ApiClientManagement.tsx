import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Key, Copy, Eye, EyeOff, RefreshCw, Ban, CheckCircle, Beaker } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const ALL_SCOPES = [
  { value: 'openid', label: 'OpenID Connect', description: 'Identity verification' },
  { value: 'accounts', label: 'Accounts', description: 'Account information' },
  { value: 'balances', label: 'Balances', description: 'Balance queries' },
  { value: 'transactions', label: 'Transactions', description: 'Transaction history' },
  { value: 'payments', label: 'Payments', description: 'Payment initiation' },
  { value: 'offline_access', label: 'Offline Access', description: 'Refresh token' },
];

const ALL_GRANT_TYPES = [
  { value: 'client_credentials', label: 'Client Credentials', description: 'Server-to-server' },
  { value: 'authorization_code', label: 'Authorization Code', description: 'User-delegated access' },
  { value: 'refresh_token', label: 'Refresh Token', description: 'Token rotation' },
];

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
    scopes: ALL_SCOPES.map(s => s.value),
    grant_types: ALL_GRANT_TYPES.map(g => g.value),
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
          redirect_uris: newClientData.redirect_uris.split(',').map(u => u.trim()).filter(Boolean),
          scopes: newClientData.scopes,
          grant_types: newClientData.grant_types,
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
        scopes: ALL_SCOPES.map(s => s.value),
        grant_types: ALL_GRANT_TYPES.map(g => g.value),
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
      <div className="space-y-6">
      <AdminPageHeader icon={Key} title="API Client Management" description="Manage OAuth 2.0 API clients and credentials" />
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin"  />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

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
                      <Label className="mb-2 block">Scopes</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {ALL_SCOPES.map((scope) => (
                          <div key={scope.value} className="flex items-start space-x-2">
                            <Checkbox
                              id={`scope-${scope.value}`}
                              checked={newClientData.scopes.includes(scope.value)}
                              onCheckedChange={(checked) => {
                                setNewClientData(prev => ({
                                  ...prev,
                                  scopes: checked
                                    ? [...prev.scopes, scope.value]
                                    : prev.scopes.filter(s => s !== scope.value)
                                }));
                              }}
                            />
                            <label htmlFor={`scope-${scope.value}`} className="text-sm leading-none cursor-pointer">
                              <span className="font-medium">{scope.label}</span>
                              <span className="block text-xs text-muted-foreground">{scope.description}</span>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Grant Types</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {ALL_GRANT_TYPES.map((grant) => (
                          <div key={grant.value} className="flex items-start space-x-2">
                            <Checkbox
                              id={`grant-${grant.value}`}
                              checked={newClientData.grant_types.includes(grant.value)}
                              onCheckedChange={(checked) => {
                                setNewClientData(prev => ({
                                  ...prev,
                                  grant_types: checked
                                    ? [...prev.grant_types, grant.value]
                                    : prev.grant_types.filter(g => g !== grant.value)
                                }));
                              }}
                            />
                            <label htmlFor={`grant-${grant.value}`} className="text-sm leading-none cursor-pointer">
                              <span className="font-medium">{grant.label}</span>
                              <span className="block text-xs text-muted-foreground">{grant.description}</span>
                            </label>
                          </div>
                        ))}
                      </div>
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
  );
}
