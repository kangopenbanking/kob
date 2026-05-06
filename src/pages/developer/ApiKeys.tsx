import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Key, Copy, CheckCircle, XCircle, Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthRequiredAlert } from "@/components/developer/AuthRequiredAlert";
import { GoLiveToggle } from "@/components/shared/GoLiveToggle";


import { RateLimitDashboard } from "@/components/developer/RateLimitDashboard";

interface ApiClient {
  id: string;
  client_id: string;
  client_name: string;
  developer_company?: string | null;
  developer_use_case?: string;
  api_environment?: string;
  rate_limit_tier?: string;
  monthly_requests_limit?: number;
  requests_used?: number;
  last_request_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [newClientSecret, setNewClientSecret] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [formData, setFormData] = useState({
    app_name: "",
    app_description: "",
    developer_company: "",
    developer_use_case: "",
    api_environment: "sandbox",
    rate_limit_tier: "free"
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndLoadKeys();
  }, []);

  const checkAuthAndLoadKeys = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setIsAuthenticated(true);
    await loadApiKeys();
  };

  const loadApiKeys = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // RLS-scoped query: developers see only their own apps via developer_user_id policy
      const { data, error } = await supabase
        .from('api_clients')
        .select('*')
        .eq('developer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApiKeys((data || []) as ApiClient[]);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApp = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create API credentials",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('developer-register-app', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: formData
      });

      if (error) throw error;

      setNewClientId(data.client_id);
      setNewClientSecret(data.client_secret);
      setShowCreateDialog(false);
      setShowSecretDialog(true);
      
      toast({
        title: "Success",
        description: "API credentials created successfully"
      });

      await loadApiKeys();
      
      setFormData({
        app_name: "",
        app_description: "",
        developer_company: "",
        developer_use_case: "",
        api_environment: "sandbox",
        rate_limit_tier: "free"
      });
    } catch (error: any) {
      console.error('Error creating app:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create API credentials",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`
    });
  };

  const handleDeleteKey = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('api_clients')
        .update({ is_active: false })
        .eq('client_id', clientId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "API key deactivated"
      });

      await loadApiKeys();
    } catch (error) {
      console.error('Error deleting key:', error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  const getRateLimitColor = (tier: string) => {
    const colors: Record<string, string> = {
      'free': 'bg-secondary',
      'starter': 'bg-primary',
      'professional': 'bg-accent',
      'enterprise': 'bg-purple-500'
    };
    return colors[tier] || 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">API Keys</h1>
        <p className="text-muted-foreground mb-4">Manage your API credentials for accessing the platform</p>
        <AuthRequiredAlert feature="API key management" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-muted-foreground mt-2">
              Manage your API credentials and monitor usage
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create New App
          </Button>
        </div>

        <GoLiveToggle entity="developer" />

        {apiKeys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No API Keys Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first API key to start integrating with Kang Open Banking
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {apiKeys.map((apiKey) => (
              <Card key={apiKey.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {apiKey.client_name}
                        {apiKey.is_active ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">
                            <XCircle className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{apiKey.developer_use_case || 'No description'}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteKey(apiKey.client_id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <div className="flex gap-2">
                      <Input
                        value={apiKey.client_id}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.client_id, "Client ID")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Environment</Label>
                      <Badge variant="outline" className="mt-1">
                        {apiKey.api_environment || 'sandbox'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Rate Limit Tier</Label>
                      <Badge className={`mt-1 ${getRateLimitColor(apiKey.rate_limit_tier || 'free')}`}>
                        {apiKey.rate_limit_tier || 'free'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Requests Used</Label>
                      <p className="text-sm font-medium mt-1">
                        {(apiKey.requests_used || 0).toLocaleString()} / {(apiKey.monthly_requests_limit || 1000).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Last Used</Label>
                      <p className="text-sm font-medium mt-1">
                        {apiKey.last_request_at
                          ? new Date(apiKey.last_request_at).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>

                  {apiKey.developer_company && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Company</Label>
                      <p className="text-sm mt-1">{apiKey.developer_company}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create App Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New API Application</DialogTitle>
              <DialogDescription>
                Register your application to get API credentials
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="app_name">Application Name *</Label>
                <Input
                  id="app_name"
                  value={formData.app_name}
                  onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                  placeholder="My Banking App"
                />
              </div>
              <div>
                <Label htmlFor="app_description">Description</Label>
                <Textarea
                  id="app_description"
                  value={formData.app_description}
                  onChange={(e) => setFormData({ ...formData, app_description: e.target.value })}
                  placeholder="Brief description of your application"
                />
              </div>
              <div>
                <Label htmlFor="developer_company">Company Name</Label>
                <Input
                  id="developer_company"
                  value={formData.developer_company}
                  onChange={(e) => setFormData({ ...formData, developer_company: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div>
                <Label htmlFor="developer_use_case">Use Case *</Label>
                <Textarea
                  id="developer_use_case"
                  value={formData.developer_use_case}
                  onChange={(e) => setFormData({ ...formData, developer_use_case: e.target.value })}
                  placeholder="Describe how you'll use the API"
                />
              </div>
              <div>
                <Label htmlFor="api_environment">Environment *</Label>
                <Select
                  value={formData.api_environment}
                  onValueChange={(value) => setFormData({ ...formData, api_environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rate_limit_tier">Rate Limit Tier *</Label>
                <Select
                  value={formData.rate_limit_tier}
                  onValueChange={(value) => setFormData({ ...formData, rate_limit_tier: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free (1,000 requests/month)</SelectItem>
                    <SelectItem value="starter">Starter (10,000 requests/month)</SelectItem>
                    <SelectItem value="professional">Professional (100,000 requests/month)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (1,000,000 requests/month)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateApp}
                disabled={!formData.app_name || !formData.developer_use_case}
              >
                Create Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Show Secret Dialog */}
        <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>API Credentials Created</DialogTitle>
              <DialogDescription>
                Save these credentials securely. The client secret will not be shown again.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertDescription>
                Store your client secret in a secure location. You will not be able to view it again.
              </AlertDescription>
            </Alert>
            <div className="space-y-4">
              <div>
                <Label>Client ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={newClientId}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newClientId, "Client ID")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Client Secret</Label>
                <div className="flex gap-2">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={newClientSecret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newClientSecret, "Client Secret")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                setShowSecretDialog(false);
                setNewClientId("");
                setNewClientSecret("");
                setShowSecret(false);
              }}>
                I've Saved My Credentials
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
