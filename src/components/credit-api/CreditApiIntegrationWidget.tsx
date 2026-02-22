import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, TrendingUp, AlertTriangle, ExternalLink, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

interface CreditApiIntegrationWidgetProps {
  institutionId: string;
}

export function CreditApiIntegrationWidget({ institutionId }: CreditApiIntegrationWidgetProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch API client credentials
  const { data: apiClient, isLoading } = useQuery({
    queryKey: ['credit-api-client', institutionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_api_clients')
        .select('*')
        .eq('institution_id', institutionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery({
    queryKey: ['credit-api-usage', apiClient?.id],
    queryFn: async () => {
      if (!apiClient?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const { data: todayData } = await supabase
        .from('credit_api_usage_logs')
        .select('*', { count: 'exact' })
        .eq('client_id', apiClient.id)
        .gte('queried_at', today.toISOString());

      const { data: monthData } = await supabase
        .from('credit_api_usage_logs')
        .select('*', { count: 'exact' })
        .eq('client_id', apiClient.id)
        .gte('queried_at', thisMonth.toISOString());

      return {
        today: todayData?.length || 0,
        thisMonth: monthData?.length || 0
      };
    },
    enabled: !!apiClient?.id
  });

  // Fetch recent inquiries
  const { data: recentInquiries } = useQuery({
    queryKey: ['credit-inquiries', apiClient?.id],
    queryFn: async () => {
      if (!apiClient?.id) return [];

      const { data } = await supabase
        .from('credit_inquiries')
        .select('*')
        .eq('inquirer_id', apiClient.id)
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!apiClient?.id
  });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getDailyLimit = (tier: string) => {
    const limits: Record<string, number> = {
      free: 100,
      standard: 5000,
      premium: 50000,
      enterprise: Infinity
    };
    return limits[tier] || 0;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading Credit API credentials...
      </div>
    );
  }

  // Check for existing pending request
  const { data: existingRequest } = useQuery({
    queryKey: ['credit-api-access-request', institutionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_api_access_requests')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'pending')
        .maybeSingle();
      return data;
    },
    enabled: !apiClient,
  });

  const requestAccessMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('credit_api_access_requests')
        .insert({
          institution_id: institutionId,
          requested_by: user.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access request sent to the platform administrator.");
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.info("You already have a pending access request.");
      } else {
        toast.error("Failed to send request: " + error.message);
      }
    },
  });

  if (!apiClient) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No Credit API credentials found for your institution. Request access from the platform administrator.
          <div className="mt-3">
            {existingRequest ? (
              <Badge variant="secondary">Access request pending — awaiting admin review</Badge>
            ) : (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => requestAccessMutation.mutate()}
                disabled={requestAccessMutation.isPending}
              >
                {requestAccessMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Key className="mr-2 h-4 w-4" />
                Request Access
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const dailyLimit = getDailyLimit(apiClient.pricing_tier);
  const todayUsage = usageStats?.today || 0;
  const remainingToday = dailyLimit === Infinity ? "Unlimited" : `${dailyLimit - todayUsage}`;
  const usagePercent = dailyLimit === Infinity ? 0 : (todayUsage / dailyLimit) * 100;

  return (
    <div className="space-y-6">
      {/* API Credentials */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Your API Credentials
          </CardTitle>
          <CardDescription>
            Keep these credentials secure. Never expose them in frontend code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">API Key</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(apiClient.api_key, 'api_key')}
                >
                  {copiedField === 'api_key' ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
              <code className="text-xs font-mono break-all">{apiClient.api_key}</code>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Pricing Tier</p>
                <Badge variant="secondary">{apiClient.pricing_tier}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {dailyLimit === Infinity ? "Unlimited" : `${dailyLimit} queries/day`}
              </p>
            </div>
          </div>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              API Secret is shown only once during credential creation. If lost, contact admin to regenerate credentials.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Queries Today</p>
            </div>
            <p className="text-3xl font-bold">{todayUsage}</p>
            {dailyLimit !== Infinity && (
              <div className="mt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${usagePercent > 80 ? 'bg-red-600' : usagePercent > 50 ? 'bg-yellow-600' : 'bg-green-600'}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {remainingToday} remaining
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">This Month</p>
            </div>
            <p className="text-3xl font-bold">{usageStats?.thisMonth || 0}</p>
            <p className="text-xs text-muted-foreground mt-2">Total queries</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Queries</p>
            </div>
            <p className="text-3xl font-bold">{apiClient.total_queries}</p>
            <p className="text-xs text-muted-foreground mt-2">All time</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Inquiries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Credit Inquiries</CardTitle>
          <CardDescription>Last 10 credit score queries</CardDescription>
        </CardHeader>
        <CardContent>
          {recentInquiries && recentInquiries.length > 0 ? (
            <div className="space-y-2">
              {recentInquiries.map((inquiry: any) => (
                <div key={inquiry.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium">User: {inquiry.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inquiry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">{inquiry.inquiry_type}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">No inquiries yet</p>
          )}
        </CardContent>
      </Card>

      {/* Documentation Link */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold mb-1">Need Help Integrating?</h4>
              <p className="text-sm text-muted-foreground">
                View complete API documentation with code examples
              </p>
            </div>
            <Button asChild>
              <Link to="/credit-api-docs">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Docs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
