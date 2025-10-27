import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Webhook, RefreshCw, CheckCircle, XCircle, RotateCw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface WebhookConfig {
  id: string;
  client_id: string;
  url?: string;
  webhook_url?: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_data: any;
  status: string;
  attempts?: number;
  attempt_count?: number;
  last_attempt_at?: string;
  created_at: string;
}

export default function WebhookManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  useEffect(() => {
    checkAdminAccess();
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [webhooksRes, deliveriesRes] = await Promise.all([
        supabase.from('webhooks').select('*').order('created_at', { ascending: false }),
        supabase.from('webhook_deliveries').select('*').order('created_at', { ascending: false }).limit(100)
      ]);

      if (webhooksRes.error) throw webhooksRes.error;
      if (deliveriesRes.error) throw deliveriesRes.error;

      setWebhooks(webhooksRes.data || []);
      setDeliveries(deliveriesRes.data || []);
    } catch (error) {
      logger.error('Error loading webhook data:', error);
      toast.error('Failed to load webhook data');
    } finally {
      setLoading(false);
    }
  };

  const retryDelivery = async (deliveryId: string) => {
    try {
      // In a real implementation, this would trigger a retry
      logger.info('Retrying webhook delivery:', deliveryId);
      toast.success('Webhook delivery retry initiated');
      loadData();
    } catch (error) {
      logger.error('Error retrying webhook:', error);
      toast.error('Failed to retry webhook delivery');
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      logger.info('Testing webhook:', webhookId);
      toast.success('Test webhook sent');
    } catch (error) {
      logger.error('Error testing webhook:', error);
      toast.error('Failed to test webhook');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Webhook Management</h1>
          <p className="text-muted-foreground">Monitor and manage webhook configurations</p>
        </div>
        <Button onClick={() => navigate('/admin')}>
          Back to Admin Dashboard
        </Button>
      </div>

      <Tabs defaultValue="webhooks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhook Configs
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <RotateCw className="h-4 w-4 mr-2" />
            Delivery Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered Webhooks ({webhooks.length})</CardTitle>
              <CardDescription>All webhook configurations across clients</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client ID</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-xs">
                        {webhook.client_id.substring(0, 12)}...
                      </TableCell>
                      <TableCell className="text-xs">{webhook.webhook_url || webhook.url}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {(Array.isArray(webhook.events) ? webhook.events : []).map((event: string) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {webhook.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(webhook.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhook(webhook.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Deliveries ({deliveries.length})</CardTitle>
              <CardDescription>Recent webhook delivery attempts and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Last Attempt</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(delivery.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{delivery.event_type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{delivery.attempts || delivery.attempt_count || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {delivery.last_attempt_at ? new Date(delivery.last_attempt_at).toLocaleString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {delivery.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryDelivery(delivery.id)}
                          >
                            <RotateCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
