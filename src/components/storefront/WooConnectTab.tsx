import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plug, Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw, Trash2, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface WooConnectTabProps {
  merchantId: string | null;
}

export function WooConnectTab({ merchantId }: WooConnectTabProps) {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Form state
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const loadIntegrations = async () => {
    if (!merchantId) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('merchant_integrations')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('type', 'woocommerce')
        .order('created_at', { ascending: false });
      setIntegrations(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIntegrations(); }, [merchantId]);

  const handleConnect = async () => {
    if (!merchantId || !storeUrl || !consumerKey || !consumerSecret) {
      toast.error('All fields are required');
      return;
    }
    setConnecting(true);
    try {
      const response = await supabase.functions.invoke('pos-woo-connector', {
        body: {
          action: 'connect',
          merchant_id: merchantId,
          store_url: storeUrl.replace(/\/+$/, ''),
          consumer_key: consumerKey,
          consumer_secret: consumerSecret,
        },
      });
      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.message || response.data.error);
      toast.success('WooCommerce store connected successfully!');
      setStoreUrl('');
      setConsumerKey('');
      setConsumerSecret('');
      loadIntegrations();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to connect store'));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    try {
      const response = await supabase.functions.invoke('pos-woo-connector', {
        body: {
          action: 'disconnect',
          merchant_id: merchantId,
          integration_id: integrationId,
        },
      });
      if (response.error) throw response.error;
      toast.success('Store disconnected');
      loadIntegrations();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to disconnect'));
    }
  };

  if (!merchantId) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No merchant account found. Register as a merchant first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Connect Form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Connect WooCommerce Store</CardTitle>
              <CardDescription className="text-xs">Link your WooCommerce store to sync products and inventory</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Store URL</Label>
            <Input
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://your-store.com"
              className="h-9 text-sm rounded-lg"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Consumer Key</Label>
            <Input
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              placeholder="ck_..."
              className="h-9 text-sm rounded-lg font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Consumer Secret</Label>
            <Input
              type="password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              placeholder="cs_..."
              className="h-9 text-sm rounded-lg font-mono"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How to get API keys:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Go to your WooCommerce dashboard</li>
              <li>Navigate to <strong>Settings → Advanced → REST API</strong></li>
              <li>Click <strong>"Add key"</strong>, set permissions to <strong>Read/Write</strong></li>
              <li>Copy the Consumer Key and Consumer Secret here</li>
            </ol>
          </div>

          <Button onClick={handleConnect} disabled={connecting} className="w-full gap-2">
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
            {connecting ? 'Connecting...' : 'Connect Store'}
          </Button>
        </CardContent>
      </Card>

      {/* Connected Stores */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Connected Stores</CardTitle>
              <CardDescription className="text-xs">
                {integrations.length === 0 ? 'No stores connected yet' : `${integrations.length} store${integrations.length > 1 ? 's' : ''} linked`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : integrations.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Connect your first WooCommerce store to start syncing products.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((int) => (
                <div key={int.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{int.base_url || 'Unknown Store'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={int.status === 'connected' ? 'default' : int.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] h-5 gap-1">
                          {int.status === 'connected' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {int.status || 'unknown'}
                        </Badge>
                        {int.last_sync_at && (
                          <span className="text-[10px] text-muted-foreground">
                            Synced: {new Date(int.last_sync_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDisconnect(int.id)}
                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {integrations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                Manage sync settings and import products from the{' '}
                <a href="/merchant/woo-sync" className="text-primary font-medium hover:underline">
                  WooCommerce Sync
                </a>{' '}
                page.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
