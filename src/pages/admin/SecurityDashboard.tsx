import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";


export default function SecurityDashboard() {
  const [jwtSecrets, setJwtSecrets] = useState<any[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      // Load JWT secrets
      const { data: secrets } = await supabase
        .from('jwt_secrets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setJwtSecrets(secrets || []);

      // Load API key expiration stats
      const { data: expiringKeys } = await supabase
        .from('api_clients')
        .select('id, client_id, expires_at')
        .lt('expires_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
        .eq('is_active', true);

      setApiKeyStats({
        expiring_30d: expiringKeys?.filter(k => 
          new Date(k.expires_at) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ).length || 0,
        expiring_7d: expiringKeys?.filter(k => 
          new Date(k.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ).length || 0,
        expiring_1d: expiringKeys?.filter(k => 
          new Date(k.expires_at) <= new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
        ).length || 0
      });

      // Load recent security alerts
      const { data: alerts } = await supabase
        .from('suspicious_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentAlerts(alerts || []);
    } catch (error) {
      console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRotateJWT = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-rotate-jwt-secret');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "JWT secret rotated successfully",
      });

      loadSecurityData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCheckExpirations = async () => {
    try {
      const { error } = await supabase.functions.invoke('api-key-expiration-notifier');
      
      if (error) throw error;

      toast({
        title: "Success",
        description: "Expiration checks completed",
      });

      loadSecurityData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <Button onClick={() => loadSecurityData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <Badge variant={jwtSecrets[0]?.is_active ? "default" : "secondary"}>
                {jwtSecrets[0]?.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <h3 className="text-2xl font-bold mb-2">JWT Secrets</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Current version: {jwtSecrets[0]?.secret_version || 'N/A'}
            </p>
            <Button onClick={handleRotateJWT} size="sm" className="w-full">
              <Key className="h-4 w-4 mr-2" />
              Rotate Secret
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <Badge variant="outline">{apiKeyStats?.expiring_30d || 0} keys</Badge>
            </div>
            <h3 className="text-2xl font-bold mb-2">Expiring API Keys</h3>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next 30 days:</span>
                <span className="font-semibold">{apiKeyStats?.expiring_30d || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next 7 days:</span>
                <span className="font-semibold">{apiKeyStats?.expiring_7d || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next 24 hours:</span>
                <span className="font-semibold text-destructive">{apiKeyStats?.expiring_1d || 0}</span>
              </div>
            </div>
            <Button onClick={handleCheckExpirations} size="sm" variant="outline" className="w-full">
              Send Notifications
            </Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <Badge variant="outline">{recentAlerts.length} alerts</Badge>
            </div>
            <h3 className="text-2xl font-bold mb-2">Security Alerts</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Recent suspicious activities monitored
            </p>
            <Button size="sm" variant="outline" className="w-full">
              View All Alerts
            </Button>
          </Card>
        </div>

        {/* JWT Secrets History */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">JWT Secret History</h2>
          <div className="space-y-4">
            {jwtSecrets.map((secret) => (
              <div key={secret.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-semibold">{secret.secret_version}</div>
                  <div className="text-sm text-muted-foreground">
                    Created: {new Date(secret.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Expires: {new Date(secret.expires_at).toLocaleDateString()}
                  </div>
                  <Badge variant={secret.is_active ? "default" : "secondary"}>
                    {secret.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Security Alerts */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Security Alerts</h2>
          <div className="space-y-4">
            {recentAlerts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No recent alerts</p>
            ) : (
              recentAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        alert.severity === 'critical' ? 'destructive' :
                        alert.severity === 'high' ? 'default' : 'secondary'
                      }>
                        {alert.severity}
                      </Badge>
                      <span className="font-semibold">{alert.activity_type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">{alert.action_taken}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
    </div>
  );
}