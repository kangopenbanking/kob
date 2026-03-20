import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Key, AlertTriangle, RefreshCw, CheckCircle2, Lock, Users, FileWarning, Eye } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function SecurityDashboard() {
  const [jwtSecrets, setJwtSecrets] = useState<any[]>([]);
  const [apiKeyStats, setApiKeyStats] = useState<any>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; usersWithPin: number; totalUsers: number }>({
    enabled: false, usersWithPin: 0, totalUsers: 0,
  });
  const [expiringCerts, setExpiringCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      const [secretsRes, keysRes, alertsRes, mfaConfigRes, pinCountRes, totalUsersRes, certsRes] = await Promise.all([
        supabase.from('jwt_secrets').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('api_clients').select('id, client_id, client_name, expires_at').lt('expires_at', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).eq('is_active', true),
        supabase.from('suspicious_activities').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('system_config').select('value').eq('key', 'security.mfa_required').maybeSingle(),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).not('pin_code_hash', 'is', null),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('client_certificates').select('id, client_id, subject_dn, valid_until, is_revoked').eq('is_revoked', false).lt('valid_until', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).order('valid_until', { ascending: true }).limit(10),
      ]);

      setJwtSecrets(secretsRes.data || []);

      const expiringKeys = keysRes.data || [];
      setApiKeyStats({
        total: expiringKeys.length,
        expiring_30d: expiringKeys.filter(k => new Date(k.expires_at) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length,
        expiring_7d: expiringKeys.filter(k => new Date(k.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
        expiring_1d: expiringKeys.filter(k => new Date(k.expires_at) <= new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)).length,
        keys: expiringKeys,
      });

      setRecentAlerts(alertsRes.data || []);
      setMfaStatus({
        enabled: mfaConfigRes.data?.value === true,
        usersWithPin: pinCountRes.count || 0,
        totalUsers: totalUsersRes.count || 0,
      });
      setExpiringCerts(certsRes.data || []);
    } catch (error) {
      console.error('Error loading security data:', error);
      toast({ title: "Error", description: "Failed to load security data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRotateJWT = async () => {
    setActionLoading('rotate');
    try {
      const { error } = await supabase.functions.invoke('admin-rotate-jwt-secret');
      if (error) throw error;
      toast({ title: "Success", description: "JWT secret rotated successfully" });
      loadSecurityData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckExpirations = async () => {
    setActionLoading('expiry');
    try {
      const { error } = await supabase.functions.invoke('api-key-expiration-notifier');
      if (error) throw error;
      toast({ title: "Success", description: "Expiration notifications sent" });
      loadSecurityData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      const { error } = await supabase
        .from('suspicious_activities')
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);
      if (error) throw error;
      toast({ title: "Alert Resolved" });
      loadSecurityData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleMfa = async () => {
    setActionLoading('mfa');
    try {
      const newValue = !mfaStatus.enabled;
      // Check if config row exists
      const { data: existing } = await supabase
        .from('system_config')
        .select('id')
        .eq('key', 'security.mfa_required')
        .maybeSingle();
      
      let error;
      if (existing) {
        ({ error } = await supabase.from('system_config').update({ value: newValue as any }).eq('key', 'security.mfa_required'));
      } else {
        ({ error } = await supabase.from('system_config').insert({ key: 'security.mfa_required', value: newValue as any, category: 'security' }));
      }
      if (error) throw error;
      toast({ title: newValue ? "2FA Enforced" : "2FA Optional", description: newValue ? "All users must set a PIN" : "PIN setup is now optional" });
      setMfaStatus(prev => ({ ...prev, enabled: newValue }));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader icon={Shield} title="Security Dashboard" description="Security overview, threat monitoring, and compliance status" />
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const unresolvedAlerts = recentAlerts.filter(a => !a.resolved);
  const resolvedAlerts = recentAlerts.filter(a => a.resolved);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Shield} title="Security Dashboard" description="Security overview, threat monitoring, and compliance status">
        <Button onClick={loadSecurityData} variant="outline" className="text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </AdminPageHeader>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Shield className="h-7 w-7 text-primary" />
            <Badge variant={jwtSecrets[0]?.is_active ? "default" : "secondary"}>
              {jwtSecrets[0]?.is_active ? "Active" : "No Key"}
            </Badge>
          </div>
          <h3 className="text-lg font-bold">JWT Secrets</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Version: {jwtSecrets[0]?.secret_version || 'None'}
          </p>
          <Button onClick={handleRotateJWT} size="sm" className="w-full" disabled={actionLoading === 'rotate'}>
            {actionLoading === 'rotate' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
            Rotate Secret
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <AlertTriangle className="h-7 w-7 text-yellow-500" />
            <Badge variant={apiKeyStats?.expiring_1d > 0 ? "destructive" : "outline"}>
              {apiKeyStats?.total || 0} keys
            </Badge>
          </div>
          <h3 className="text-lg font-bold">Expiring API Keys</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">30 days:</span>
              <span className="font-semibold">{apiKeyStats?.expiring_30d || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">7 days:</span>
              <span className="font-semibold">{apiKeyStats?.expiring_7d || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">24 hours:</span>
              <span className="font-semibold text-destructive">{apiKeyStats?.expiring_1d || 0}</span>
            </div>
          </div>
          <Button onClick={handleCheckExpirations} size="sm" variant="outline" className="w-full" disabled={actionLoading === 'expiry'}>
            {actionLoading === 'expiry' ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
            Send Notifications
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Lock className="h-7 w-7 text-primary" />
            <Badge variant={mfaStatus.enabled ? "default" : "secondary"}>
              {mfaStatus.enabled ? "Enforced" : "Optional"}
            </Badge>
          </div>
          <h3 className="text-lg font-bold">2FA / PIN</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Users with PIN:</span>
              <span className="font-semibold">{mfaStatus.usersWithPin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total users:</span>
              <span className="font-semibold">{mfaStatus.totalUsers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Coverage:</span>
              <span className="font-semibold">
                {mfaStatus.totalUsers > 0 ? Math.round((mfaStatus.usersWithPin / mfaStatus.totalUsers) * 100) : 0}%
              </span>
            </div>
          </div>
          <Button onClick={handleToggleMfa} size="sm" variant={mfaStatus.enabled ? "destructive" : "default"} className="w-full" disabled={actionLoading === 'mfa'}>
            {mfaStatus.enabled ? "Disable Enforcement" : "Enforce for All"}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 className={`h-7 w-7 ${unresolvedAlerts.length > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
            <Badge variant={unresolvedAlerts.length > 0 ? "destructive" : "outline"}>
              {unresolvedAlerts.length} open
            </Badge>
          </div>
          <h3 className="text-lg font-bold">Security Alerts</h3>
          <div className="space-y-1 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unresolved:</span>
              <span className="font-semibold text-destructive">{unresolvedAlerts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resolved:</span>
              <span className="font-semibold">{resolvedAlerts.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">{recentAlerts.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Alerts {unresolvedAlerts.length > 0 && <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">{unresolvedAlerts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="jwt">
            <Key className="h-4 w-4 mr-1.5" />
            JWT History
          </TabsTrigger>
          <TabsTrigger value="certs">
            <FileWarning className="h-4 w-4 mr-1.5" />
            Certificates {expiringCerts.length > 0 && <Badge variant="outline" className="ml-1.5 h-5 px-1.5 text-xs">{expiringCerts.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Security Alerts</h2>
            <div className="space-y-3">
              {recentAlerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">No security alerts</p>
                  <p className="text-sm">All systems are operating normally</p>
                </div>
              ) : (
                recentAlerts.map((alert) => (
                  <div key={alert.id} className={`flex items-start justify-between p-4 border rounded-lg ${alert.resolved ? 'opacity-60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={
                          alert.severity === 'critical' ? 'destructive' :
                          alert.severity === 'high' ? 'default' : 'secondary'
                        }>
                          {alert.severity}
                        </Badge>
                        <span className="font-semibold text-sm">{alert.activity_type}</span>
                        {alert.resolved && <Badge variant="outline" className="text-green-600">Resolved</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{alert.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {alert.action_taken && <Badge variant="outline">{alert.action_taken}</Badge>}
                      {!alert.resolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolveAlert(alert.id)}
                          disabled={actionLoading === alert.id}
                        >
                          {actionLoading === alert.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* JWT History Tab */}
        <TabsContent value="jwt">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">JWT Secret History</h2>
            <div className="space-y-3">
              {jwtSecrets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Key className="h-12 w-12 mx-auto mb-3" />
                  <p className="font-medium">No JWT secrets configured</p>
                  <p className="text-sm">Click "Rotate Secret" to create the first one</p>
                </div>
              ) : (
                jwtSecrets.map((secret) => (
                  <div key={secret.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-semibold">{secret.secret_version}</div>
                      <div className="text-sm text-muted-foreground">
                        Created: {new Date(secret.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {secret.expires_at && (
                        <div className="text-sm text-muted-foreground">
                          Expires: {new Date(secret.expires_at).toLocaleDateString()}
                        </div>
                      )}
                      <Badge variant={secret.is_active ? "default" : "secondary"}>
                        {secret.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Certificates Tab */}
        <TabsContent value="certs">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Expiring Certificates (30 days)</h2>
            <div className="space-y-3">
              {expiringCerts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">No certificates expiring soon</p>
                  <p className="text-sm">All certificates are valid beyond 30 days</p>
                </div>
              ) : (
                expiringCerts.map((cert) => {
                  const daysLeft = Math.ceil((new Date(cert.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={cert.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{cert.subject_dn || cert.client_id}</div>
                        <div className="text-sm text-muted-foreground">
                          Expires: {new Date(cert.valid_until).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={daysLeft <= 7 ? "destructive" : daysLeft <= 14 ? "default" : "secondary"}>
                        {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
