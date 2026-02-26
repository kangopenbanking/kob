import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Webhook, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthRequiredAlert } from "@/components/developer/AuthRequiredAlert";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function SandboxWebhooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [eventTypes, setEventTypes] = useState({
    rate_limit_warning: true,
    rate_limit_exceeded: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

      if (!accountData) {
        navigate('/developer/sandbox');
        return;
      }

      setAccount(accountData);

      // Fetch webhooks
      const { data: webhooksData } = await supabase
        .from('sandbox_webhooks')
        .select('*')
        .eq('sandbox_account_id', accountData.id)
        .order('created_at', { ascending: false });

      setWebhooks(webhooksData || []);

      // Fetch recent webhook logs
      if (webhooksData && webhooksData.length > 0) {
        const webhookIds = webhooksData.map(w => w.id);
        const { data: logsData } = await supabase
          .from('sandbox_webhook_logs')
          .select('*')
          .in('webhook_id', webhookIds)
          .order('created_at', { ascending: false })
          .limit(20);

        setWebhookLogs(logsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load webhook data');
    } finally {
      setLoading(false);
    }
  };

  const registerWebhook = async () => {
    setSubmitting(true);
    try {
      const selectedEvents = Object.entries(eventTypes)
        .filter(([_, enabled]) => enabled)
        .map(([event]) => event);

      if (selectedEvents.length === 0) {
        toast.error('Please select at least one event type');
        return;
      }

      const { data, error } = await supabase.functions.invoke('sandbox-register-webhook', {
        body: { webhook_url: webhookUrl, event_types: selectedEvents }
      });

      if (error) throw error;

      toast.success('Webhook registered successfully!');
      setShowForm(false);
      setWebhookUrl("");
      setEventTypes({ rate_limit_warning: true, rate_limit_exceeded: true });
      fetchData();
    } catch (error: any) {
      console.error('Error registering webhook:', error);
      toast.error(error.message || 'Failed to register webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    try {
      const { error } = await supabase
        .from('sandbox_webhooks')
        .update({ is_active: false })
        .eq('id', webhookId);

      if (error) throw error;

      toast.success('Webhook deactivated');
      fetchData();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('Failed to delete webhook');
    }
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Webhook Management</h1>
        <p className="text-muted-foreground mb-4">Receive real-time notifications when you approach rate limits</p>
        <AuthRequiredAlert feature="webhook management" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Webhook Management</h1>
          <p className="text-muted-foreground">
            Receive real-time notifications when you approach rate limits
          </p>
        </div>

        {/* Webhooks List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Webhooks</CardTitle>
                <CardDescription>
                  Registered webhook endpoints for your sandbox
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowForm(!showForm)}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Register Webhook
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showForm && (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-domain.com/webhook"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your endpoint will receive POST requests with webhook events
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rate_limit_warning"
                        checked={eventTypes.rate_limit_warning}
                        onCheckedChange={(checked) => 
                          setEventTypes(prev => ({ ...prev, rate_limit_warning: checked as boolean }))
                        }
                      />
                      <label htmlFor="rate_limit_warning" className="text-sm cursor-pointer">
                        Rate Limit Warning (80% threshold)
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="rate_limit_exceeded"
                        checked={eventTypes.rate_limit_exceeded}
                        onCheckedChange={(checked) => 
                          setEventTypes(prev => ({ ...prev, rate_limit_exceeded: checked as boolean }))
                        }
                      />
                      <label htmlFor="rate_limit_exceeded" className="text-sm cursor-pointer">
                        Rate Limit Exceeded
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={registerWebhook}
                    disabled={!webhookUrl || submitting}
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Register Webhook
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {webhooks.filter(w => w.is_active).map((webhook) => (
                <div key={webhook.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Webhook className="h-4 w-4 text-primary" />
                        <code className="text-sm font-mono">{webhook.webhook_url}</code>
                      </div>
                      <div className="flex gap-2 mt-2">
                        {webhook.event_types.map((event: string) => (
                          <Badge key={event} variant="secondary" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteWebhook(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Created: {new Date(webhook.created_at).toLocaleDateString()}</span>
                    {webhook.last_triggered_at && (
                      <span>Last triggered: {new Date(webhook.last_triggered_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}

              {webhooks.filter(w => w.is_active).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No webhooks registered yet. Create one to receive notifications.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Webhook Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Deliveries</CardTitle>
            <CardDescription>
              Last 20 webhook delivery attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {webhookLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Response</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhookLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.event_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.response_status >= 200 && log.response_status < 300 ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-sm">{log.response_status}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">{log.response_status || 'Failed'}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.response_body}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No webhook deliveries yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}