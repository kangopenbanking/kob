import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthRequiredAlert } from "@/components/developer/AuthRequiredAlert";


const eventTemplates = {
  rate_limit_warning: {
    api_key_id: 'test-key-id',
    timestamp: new Date().toISOString(),
    limit_type: 'per_minute',
    current_usage: 48,
    limit: 60,
    percentage: '80.0',
  },
  rate_limit_exceeded: {
    api_key_id: 'test-key-id',
    timestamp: new Date().toISOString(),
    limit_type: 'per_day',
    current_usage: 1000,
    limit: 1000,
    percentage: '100.0',
  },
  custom: {},
};

export default function WebhookTesting() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [testResult, setTestResult] = useState<any>(null);

  // Form state
  const [selectedWebhook, setSelectedWebhook] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [eventType, setEventType] = useState("rate_limit_warning");
  const [payload, setPayload] = useState(JSON.stringify(eventTemplates.rate_limit_warning, null, 2));

  useEffect(() => {
    fetchWebhooks();
  }, []);

  useEffect(() => {
    // Update payload when event type changes
    const template = eventTemplates[eventType as keyof typeof eventTemplates];
    setPayload(JSON.stringify(template, null, 2));
  }, [eventType]);

  const fetchWebhooks = async () => {
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
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!accountData) {
        navigate('/developer/sandbox');
        return;
      }

      // Fetch webhooks
      const { data: webhooksData } = await supabase
        .from('sandbox_webhooks')
        .select('*')
        .eq('sandbox_account_id', accountData.id)
        .eq('is_active', true);

      setWebhooks(webhooksData || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setSubmitting(true);
    setTestResult(null);

    try {
      const webhookUrl = customUrl || webhooks.find(w => w.id === selectedWebhook)?.webhook_url;

      if (!webhookUrl) {
        toast.error('Please select a webhook or enter a custom URL');
        return;
      }

      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch (e) {
        toast.error('Invalid JSON payload');
        return;
      }

      const { data, error } = await supabase.functions.invoke('sandbox-test-webhook', {
        body: {
          webhook_url: webhookUrl,
          event_type: eventType,
          payload: parsedPayload,
          secret_key: webhooks.find(w => w.id === selectedWebhook)?.secret_key,
        }
      });

      if (error) throw error;

      setTestResult(data);

      if (data.success) {
        toast.success('Webhook test successful!');
      } else {
        toast.error('Webhook test failed');
      }
    } catch (error: any) {
      console.error('Error testing webhook:', error);
      toast.error(error.message || 'Failed to test webhook');
      setTestResult({
        success: false,
        error: error.message,
      });
    } finally {
      setSubmitting(false);
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
        <h1 className="text-3xl font-bold mb-2">Webhook Testing Tool</h1>
        <p className="text-muted-foreground mb-4">Send test events to your registered webhooks</p>
        <AuthRequiredAlert feature="webhook testing" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Webhook Testing Tool</h1>
          <p className="text-muted-foreground">
            Send test events to verify your webhook endpoints
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Test Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Test Configuration</CardTitle>
              <CardDescription>
                Configure your webhook test
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Webhook</Label>
                <Select value={selectedWebhook} onValueChange={setSelectedWebhook}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a registered webhook" />
                  </SelectTrigger>
                  <SelectContent>
                    {webhooks.map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.webhook_url}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="flex-1 border-t" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customUrl">Custom Webhook URL</Label>
                <Input
                  id="customUrl"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://your-domain.com/webhook"
                />
              </div>

              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rate_limit_warning">Rate Limit Warning</SelectItem>
                    <SelectItem value="rate_limit_exceeded">Rate Limit Exceeded</SelectItem>
                    <SelectItem value="custom">Custom Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payload">Payload (JSON)</Label>
                <Textarea
                  id="payload"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  className="font-mono text-xs"
                  rows={12}
                />
              </div>

              <Button
                onClick={testWebhook}
                disabled={submitting || (!selectedWebhook && !customUrl)}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test Event
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Response from your webhook endpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResult ? (
                <div className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-2">
                      {testResult.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {testResult.success ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <Badge variant={testResult.success ? "default" : "destructive"}>
                      {testResult.status_code || 'Error'}
                    </Badge>
                  </div>

                  {/* Response Time */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className="font-medium">{testResult.response_time_ms}ms</span>
                  </div>

                  {/* Response Body */}
                  {testResult.response_body && (
                    <div className="space-y-2">
                      <Label className="text-sm">Response Body</Label>
                      <div className="bg-muted/50 p-3 rounded-lg overflow-auto max-h-[300px]">
                        <pre className="text-xs">
                          {testResult.response_body}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {testResult.error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                      <p className="text-sm font-medium text-destructive mb-1">Error</p>
                      <p className="text-xs text-muted-foreground">{testResult.error}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Send className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Send a test event to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-1">
              <li>Your webhook endpoint should return a 2xx status code for successful delivery</li>
              <li>The <code className="text-xs">X-Webhook-Signature</code> header contains the secret key for verification</li>
              <li>The <code className="text-xs">X-Event-Type</code> header indicates the event type</li>
              <li>Test both success and error scenarios to ensure proper handling</li>
              <li>Use tools like webhook.site for quick testing without setting up your own endpoint</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}