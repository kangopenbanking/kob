import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Key, 
  Plus, 
  Copy, 
  RefreshCw,
  Shield,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ApiClient {
  id: string;
  client_id: string;
  client_name: string;
  scopes: string[];
  grant_types: string[];
  redirect_uris: string[];
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  last_rotated_at: string | null;
}

export default function InstitutionApiClients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newRedirectUri, setNewRedirectUri] = useState("");
  const [creating, setCreating] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: institution } = await supabase
        .from("institutions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!institution) {
        navigate('/register');
        return;
      }

      setInstitutionId(institution.id);

      const { data, error } = await supabase
        .from("api_clients")
        .select("*")
        .eq("institution_id", institution.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Map the data with proper type handling
      const mapped: ApiClient[] = (data || []).map((c: any) => ({
        id: c.id,
        client_id: c.client_id,
        client_name: c.client_name,
        scopes: Array.isArray(c.scopes) ? c.scopes.map(String) : [],
        grant_types: Array.isArray(c.grant_types) ? c.grant_types.map(String) : [],
        redirect_uris: Array.isArray(c.redirect_uris) ? c.redirect_uris.map(String) : [],
        is_active: c.is_active ?? true,
        created_at: c.created_at || '',
        expires_at: c.expires_at,
        last_rotated_at: c.last_rotated_at
      }));

      setClients(mapped);
    } catch (error: any) {
      toast({
        title: "Error loading API clients",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    if (!newClientName || !institutionId) return;
    
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to create an API client",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('institution-create-client', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: {
          client_name: newClientName,
          institution_id: institutionId,
          redirect_uris: newRedirectUri ? [newRedirectUri] : [],
          scopes: ['accounts', 'transactions', 'payments'],
          grant_types: ['authorization_code', 'client_credentials']
        }
      });

      if (error) throw error;

      // Show secret dialog with credentials
      setNewClientId(data.client_id);
      setNewClientSecret(data.client_secret);
      setCreateDialogOpen(false);
      setSecretDialogOpen(true);
      setNewClientName("");
      setNewRedirectUri("");
      
      toast({
        title: "API Client Created",
        description: "Your new API client has been created successfully.",
      });

      loadClients();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast({
        title: "Error creating client",
        description: error.message || "Failed to create API client",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const toggleClientStatus = async (clientId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("api_clients")
        .update({ is_active: !currentStatus })
        .eq("id", clientId);

      if (error) throw error;

      toast({
        title: currentStatus ? "Client Deactivated" : "Client Activated",
        description: `API client has been ${currentStatus ? 'deactivated' : 'activated'}.`,
      });

      loadClients();
    } catch (error: any) {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">API Clients</h1>
            <p className="text-muted-foreground">Manage your OAuth2 API clients and credentials</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadClients}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New API Client</DialogTitle>
                  <DialogDescription>
                    Create a new OAuth2 client for API access
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Client Name</Label>
                    <Input
                      id="clientName"
                      placeholder="My Application"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redirectUri">Redirect URI (Optional)</Label>
                    <Input
                      id="redirectUri"
                      placeholder="https://myapp.com/callback"
                      value={newRedirectUri}
                      onChange={(e) => setNewRedirectUri(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createClient} disabled={!newClientName || creating}>
                    {creating ? "Creating..." : "Create Client"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Secret Dialog */}
            <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>API Client Created</DialogTitle>
                  <DialogDescription>
                    Save these credentials securely. The client secret will not be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Store your client secret in a secure location. You will not be able to view it again.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <div className="flex gap-2">
                      <Input value={newClientId} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(newClientId, "Client ID")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <div className="flex gap-2">
                      <Input value={newClientSecret} readOnly className="font-mono text-sm" />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(newClientSecret, "Client Secret")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => {
                    setSecretDialogOpen(false);
                    setNewClientId("");
                    setNewClientSecret("");
                  }}>
                    I've Saved My Credentials
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* API Clients List */}
        <div className="space-y-4">
          {loading ? (
            [1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No API Clients</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first API client to start integrating with our APIs
                </p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Client
                </Button>
              </CardContent>
            </Card>
          ) : (
            clients.map(client => (
              <Card key={client.id} className={!client.is_active ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        {client.client_name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        Created {format(new Date(client.created_at), "PPP")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {client.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Client ID */}
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-muted-foreground">Client ID</p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => copyToClipboard(client.client_id, "Client ID")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <code className="text-sm font-mono">{client.client_id}</code>
                    </div>

                    {/* Scopes */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Scopes</p>
                      <div className="flex flex-wrap gap-2">
                        {client.scopes.map(scope => (
                          <Badge key={scope} variant="outline">
                            <Shield className="h-3 w-3 mr-1" />
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Grant Types */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Grant Types</p>
                      <div className="flex flex-wrap gap-2">
                        {client.grant_types.map(grant => (
                          <Badge key={grant} variant="secondary">
                            {String(grant).replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Redirect URIs */}
                    {client.redirect_uris.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Redirect URIs</p>
                        <div className="space-y-1">
                          {client.redirect_uris.map((uri, i) => (
                            <code key={i} className="block text-sm text-muted-foreground">{uri}</code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleClientStatus(client.id, client.is_active)}
                      >
                        {client.is_active ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Activate
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Rotate Secret
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Security Info */}
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
              <Shield className="h-5 w-5" />
              Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-yellow-700 dark:text-yellow-300 text-sm space-y-2">
            <p>• Never expose your client secret in client-side code or public repositories</p>
            <p>• Rotate your client secrets regularly (every 90 days recommended)</p>
            <p>• Use separate API clients for development and production environments</p>
            <p>• Limit scopes to only what your application needs</p>
          </CardContent>
        </Card>
      </div>
    </InstitutionLayout>
  );
}
