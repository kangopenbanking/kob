import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditApiIntegrationWidget } from "@/components/credit-api/CreditApiIntegrationWidget";
import { TrendingUp, Shield, Activity, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InstitutionCreditApi() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [queryCount, setQueryCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);

      // Count credit API queries
      const { count } = await supabase
        .from("api_usage_metrics")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", institution.id)
        .ilike("endpoint", "%credit%");

      setQueryCount(count || 0);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Credit Scoring API</h1>
            <p className="text-muted-foreground">Query customer credit scores for lending decisions via the V1 API</p>
          </div>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Queries</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : queryCount}</div>
              <p className="text-xs text-muted-foreground">Total credit score queries</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Endpoint</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <code className="text-sm font-mono text-muted-foreground">POST /v1/credit/query</code>
              <p className="text-xs text-muted-foreground mt-1">Score query endpoint</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Authentication</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge>OAuth 2.0 + JWT</Badge>
              <p className="text-xs text-muted-foreground mt-1">Certificate-bound tokens</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Credit Score Query Tool</CardTitle>
            <CardDescription>Test credit score queries using your API credentials</CardDescription>
          </CardHeader>
          <CardContent>
            {institutionId ? (
              <CreditApiIntegrationWidget institutionId={institutionId} />
            ) : (
              <p className="text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Reference</CardTitle>
            <CardDescription>Integration documentation for the Credit Scoring API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg font-mono text-sm space-y-2">
              <p className="text-muted-foreground"># Request</p>
              <p>POST /v1/credit/query</p>
              <p>Authorization: Bearer {'<access_token>'}</p>
              <p>Idempotency-Key: {'<uuid>'}</p>
              <p className="mt-2">{'{'}</p>
              <p>  "phone_number": "+237677123456",</p>
              <p>  "consent_id": "consent_xyz"</p>
              <p>{'}'}</p>
            </div>
            <Button variant="outline" asChild>
              <a href="/documentation" target="_blank"><ExternalLink className="h-4 w-4 mr-2" />View Full Documentation</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </InstitutionLayout>
  );
}
