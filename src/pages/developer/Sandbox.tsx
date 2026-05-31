import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Key, Plus, Copy, Eye, EyeOff, Trash2, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthRequiredAlert } from "@/components/developer/AuthRequiredAlert";


import { RateLimitDashboard } from "@/components/developer/RateLimitDashboard";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useTurnstile } from "@/hooks/useTurnstile";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";

export default function Sandbox() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const turnstile = useTurnstile({ action: "sandbox_create" });
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [selectedKeyForDashboard, setSelectedKeyForDashboard] = useState<string>("");
  const [newKeySet, setNewKeySet] = useState<{
    secret_key: string;
    publishable_key: string;
    merchant_id: string;
    webhook_secret: string;
  } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [keyName, setKeyName] = useState("");

  useEffect(() => {
    fetchSandboxData();
  }, []);

  const fetchSandboxData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setIsAuthenticated(true);

      // Fetch sandbox account
      const { data: accountData } = await supabase
        .from('developer_sandbox_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setAccount(accountData);

      if (accountData) {
        // Fetch API keys
        const { data: keysData } = await supabase
          .from('sandbox_api_keys')
          .select('*')
          .eq('sandbox_account_id', accountData.id)
          .order('created_at', { ascending: false });

        setApiKeys(keysData || []);

        // Set first active key as selected for dashboard
        if (keysData && keysData.length > 0) {
          setSelectedKeyForDashboard(keysData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching sandbox data:', error);
      toast.error('Failed to load sandbox data');
    } finally {
      setLoading(false);
    }
  };

  const createSandboxAccount = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to create a sandbox account');
        return;
      }

      const turnstile_token = await turnstile.getToken();
      const { data, error } = await supabase.functions.invoke('sandbox-create-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { company_name: companyName, website, description, turnstile_token }
      });

      if (error) throw error;

      toast.success('Sandbox account created successfully!');
      setAccount(data.account);
    } catch (error: any) {
      console.error('Error creating sandbox account:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to create sandbox account'));
    } finally {
      setSubmitting(false);
    }
  };

  const createApiKey = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to create an API key');
        return;
      }

      const turnstile_token = await turnstile.getToken();
      const { data, error } = await supabase.functions.invoke('sandbox-create-api-key', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        },
        body: { key_name: keyName || 'Default Key', turnstile_token }
      });

      if (error) throw error;

      setNewKeySet({
        secret_key: data.secret_key || data.api_key,
        publishable_key: data.publishable_key,
        merchant_id: data.merchant_id,
        webhook_secret: data.webhook_secret,
      });
      setKeyName("");
      toast.success('API key created successfully!');
      fetchSandboxData();
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(extractEdgeFunctionError(error, 'Failed to create API key'));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from('sandbox_api_keys')
        .update({ is_active: false })
        .eq('id', keyId);

      if (error) throw error;

      toast.success('API key deactivated');
      fetchSandboxData();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Developer Sandbox</h1>
        <p className="text-muted-foreground mb-4">Create a sandbox environment to test our APIs</p>
        <AuthRequiredAlert feature="the developer sandbox" />
      </div>
    );
  }

  if (!account) {
    return (
      <>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Developer Sandbox</h1>
            <p className="text-muted-foreground">
              Create a sandbox environment to test our APIs with rate limits and usage tracking
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Create Sandbox Account</CardTitle>
              <CardDescription>
                Get started by creating your developer sandbox account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company Name *</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Inc."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your use case..."
                  rows={3}
                />
              </div>

              <Button
                onClick={createSandboxAccount}
                disabled={!companyName || submitting}
                className="w-full"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Sandbox Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <TurnstileWidget containerRef={turnstile.containerRef} enabled={turnstile.enabled} />
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Developer Sandbox</h1>
          <p className="text-muted-foreground">
            Manage your sandbox environment and API keys
          </p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>Sandbox Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Company</Label>
                <p className="font-medium">{account.company_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Tier</Label>
                <div>
                  <Badge variant={account.tier === 'pro' ? 'default' : 'secondary'}>
                    {account.tier.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div>
                  <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>
                    {account.status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p>{new Date(account.created_at).toLocaleDateString()}</p>
              </div>
              {account.merchant_id && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Merchant ID</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 font-mono text-sm bg-muted px-3 py-2 rounded break-all">{account.merchant_id}</code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(account.merchant_id)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this on every charge, payout, and refund request.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage your sandbox API keys (max 5 keys)
                </CardDescription>
              </div>
              <Button
                onClick={() => setKeyName("")}
                disabled={apiKeys.filter(k => k.is_active).length >= 5}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Key
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {newKeySet && (
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription className="space-y-3">
                  <p className="font-medium">Your new sandbox credentials — save the secret key and webhook secret now (they will not be shown again):</p>
                  {[
                    { label: "Secret Key", value: newKeySet.secret_key, hint: "Server-side API authentication." },
                    { label: "Publishable Key", value: newKeySet.publishable_key, hint: "Safe for client-side / SDK init." },
                    { label: "Merchant ID", value: newKeySet.merchant_id, hint: "Required on charges, payouts, refunds." },
                    { label: "Webhook Secret", value: newKeySet.webhook_secret, hint: "Verify HMAC-SHA256 webhook signatures." },
                  ].map(({ label, value, hint }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-xs font-medium text-foreground">{label}</p>
                      <div className="flex items-center gap-2 font-mono text-sm bg-muted p-2 rounded">
                        <code className="flex-1 break-all">{value}</code>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(value)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setNewKeySet(null)}>
                    I've saved these
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {keyName !== null && !newKeySet && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="Production API Key"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createApiKey}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate API Key
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setKeyName("")}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {apiKeys.filter(k => k.is_active).map((key) => (
                <div key={key.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{key.key_name}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteApiKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {key.publishable_key && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Publishable Key</p>
                      <div className="flex items-center gap-2 text-sm">
                        <code className="font-mono flex-1 break-all bg-muted px-2 py-1 rounded">{key.publishable_key}</code>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(key.publishable_key)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Secret Key (hash only — original shown once at creation)</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="font-mono flex-1 break-all bg-muted px-2 py-1 rounded">
                        {showKeys[key.id] ? key.api_key : '•'.repeat(40)}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                      >
                        {showKeys[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>{key.rate_limit_per_minute} req/min</span>
                    <span>{key.rate_limit_per_day} req/day</span>
                    {key.last_used_at && (
                      <span>Last used: {new Date(key.last_used_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}

              {apiKeys.filter(k => k.is_active).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No API keys yet. Create one to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rate Limit Dashboard */}
        {apiKeys.filter(k => k.is_active).length > 0 && (
          <RateLimitDashboard 
            apiKeyId={selectedKeyForDashboard} 
            tier={account.tier}
          />
        )}

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Register webhook URLs to receive rate limit notifications
                </CardDescription>
              </div>
              <Button
                onClick={() => navigate('/developer/sandbox/webhooks')}
                size="sm"
                variant="outline"
              >
                Manage Webhooks
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Get notified when you exceed 80% of your rate limits via webhook callbacks.
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/developer/sandbox/webhook-testing')}
              >
                Test Webhooks
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Generator */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Test Data</CardTitle>
                <CardDescription>
                  Generate realistic test data for your sandbox
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Quickly populate your sandbox with accounts, transactions, and balances.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/developer/sandbox/data-generator')}
            >
              <Database className="mr-2 h-4 w-4" />
              Generate Data
            </Button>
          </CardContent>
        </Card>

        {/* Documentation Link */}
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Use your API key to authenticate requests to our sandbox environment.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/developer/api-playground')}>
                Try API Playground
              </Button>
              <Button variant="outline" onClick={() => navigate('/developer/api-testing')}>
                View Documentation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}