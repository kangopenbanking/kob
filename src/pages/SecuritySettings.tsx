import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Shield, 
  Smartphone, 
  AlertTriangle, 
  Clock,
  MapPin,
  Monitor,
  Trash2,
  CheckCircle2
} from "lucide-react";

const SecuritySettings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [mfaSettings, setMfaSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [suspiciousActivities, setSuspiciousActivities] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    await fetchAllData(user.id);
    setLoading(false);
  };

  const fetchAllData = async (userId: string) => {
    await Promise.all([
      fetchSecuritySettings(userId),
      fetchMFASettings(userId),
      fetchAuditLogs(userId),
      fetchDevices(userId),
      fetchSuspiciousActivities(userId)
    ]);
  };

  const fetchSecuritySettings = async (userId: string) => {
    let { data } = await supabase
      .from("user_security_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) {
      // Create default settings
      const { data: newData } = await supabase
        .from("user_security_settings")
        .insert({ user_id: userId })
        .select()
        .single();
      data = newData;
    }
    
    setSecuritySettings(data);
  };

  const fetchMFASettings = async (userId: string) => {
    let { data } = await supabase
      .from("mfa_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) {
      const { data: newData } = await supabase
        .from("mfa_settings")
        .insert({ user_id: userId })
        .select()
        .single();
      data = newData;
    }
    
    setMfaSettings(data);
  };

  const fetchAuditLogs = async (userId: string) => {
    const { data } = await supabase
      .from("security_audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) setAuditLogs(data);
  };

  const fetchDevices = async (userId: string) => {
    const { data } = await supabase
      .from("trusted_devices")
      .select("*")
      .eq("user_id", userId)
      .order("last_used_at", { ascending: false });
    
    if (data) setDevices(data);
  };

  const fetchSuspiciousActivities = async (userId: string) => {
    const { data } = await supabase
      .from("suspicious_activities")
      .select("*")
      .eq("user_id", userId)
      .eq("resolved", false)
      .order("created_at", { ascending: false });
    
    if (data) setSuspiciousActivities(data);
  };

  const updateSecuritySetting = async (field: string, value: any) => {
    if (!securitySettings) return;

    const { error } = await supabase
      .from("user_security_settings")
      .update({ [field]: value } as any)
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setSecuritySettings({ ...securitySettings, [field]: value });
      toast({ title: "Settings updated" });
    }
  };

  const toggleMFA = async () => {
    if (!mfaSettings) return;

    const newValue = !mfaSettings.mfa_enabled;
    
    const { error } = await supabase
      .from("mfa_settings")
      .update({ 
        mfa_enabled: newValue,
        mfa_method: newValue ? 'email' : null
      })
      .eq("user_id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setMfaSettings({ ...mfaSettings, mfa_enabled: newValue });
      toast({ 
        title: newValue ? "MFA Enabled" : "MFA Disabled",
        description: newValue ? "Two-factor authentication is now active" : "Two-factor authentication disabled"
      });
    }
  };

  const removeDevice = async (deviceId: string) => {
    const { error } = await supabase
      .from("trusted_devices")
      .delete()
      .eq("id", deviceId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({ title: "Device removed" });
      fetchDevices(user.id);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "login":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "logout":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "failed_login":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Shield className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Security Center</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Security Settings</h1>
          <p className="text-muted-foreground">
            Manage your account security and review activity
          </p>
        </div>

        {suspiciousActivities.length > 0 && (
          <Card className="mb-6 border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Security Alerts
              </CardTitle>
              <CardDescription>
                We detected {suspiciousActivities.length} suspicious {suspiciousActivities.length === 1 ? 'activity' : 'activities'} on your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suspiciousActivities.slice(0, 3).map((activity) => (
                  <div key={activity.id} className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                    <div className="flex items-center justify-between mb-2">
                      {getSeverityBadge(activity.severity)}
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Action: {activity.action_taken}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings">
              <Shield className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="devices">
              <Smartphone className="mr-2 h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Clock className="mr-2 h-4 w-4" />
              Activity Log
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable MFA</Label>
                    <p className="text-sm text-muted-foreground">
                      Require a second verification step when signing in
                    </p>
                  </div>
                  <Switch
                    checked={mfaSettings?.mfa_enabled || false}
                    onCheckedChange={toggleMFA}
                  />
                </div>
                {mfaSettings?.mfa_enabled && (
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm">
                      <strong>Method:</strong> {mfaSettings.mfa_method || "Email"}
                    </p>
                    {mfaSettings.last_used_at && (
                      <p className="text-sm text-muted-foreground">
                        Last used: {new Date(mfaSettings.last_used_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Security Notifications</CardTitle>
                <CardDescription>Choose what security events to be notified about</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Suspicious Login Attempts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified of unusual sign-in activity
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings?.notify_suspicious_login || false}
                    onCheckedChange={(v) => updateSecuritySetting("notify_suspicious_login", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New Device Logins</Label>
                    <p className="text-sm text-muted-foreground">
                      Alert when signing in from an unrecognized device
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings?.notify_new_device || false}
                    onCheckedChange={(v) => updateSecuritySetting("notify_new_device", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Consent Changes</Label>
                    <p className="text-sm text-muted-foreground">
                      Notify when third-party access is granted or revoked
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings?.notify_consent_changes || false}
                    onCheckedChange={(v) => updateSecuritySetting("notify_consent_changes", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Payment Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get alerts when payments are initiated
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings?.notify_payment_initiated || false}
                    onCheckedChange={(v) => updateSecuritySetting("notify_payment_initiated", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Trusted Devices</CardTitle>
                <CardDescription>Manage devices that have accessed your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {devices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {device.device_name || `${device.browser} on ${device.os}`}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {device.ip_address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last used: {new Date(device.last_used_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {device.is_trusted && <Badge className="bg-green-500">Trusted</Badge>}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeDevice(device.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {devices.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No devices recorded yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your account activity log</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {getEventIcon(log.event_type)}
                        <div>
                          <p className="font-medium capitalize">{log.event_type.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.ip_address && `From ${log.ip_address}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {log.risk_score > 50 && (
                          <Badge variant="destructive" className="mb-1">Risk: {log.risk_score}</Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Review suspicious activities on your account</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {suspiciousActivities.map((activity) => (
                    <div key={activity.id} className="p-4 border rounded">
                      <div className="flex items-center justify-between mb-3">
                        {getSeverityBadge(activity.severity)}
                        <p className="text-sm text-muted-foreground">
                          {new Date(activity.created_at).toLocaleString()}
                        </p>
                      </div>
                      <p className="font-medium mb-2">{activity.description}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Type: {activity.activity_type.replace(/_/g, ' ')}</p>
                        {activity.ip_address && <p>IP: {activity.ip_address}</p>}
                        <p>Action taken: {activity.action_taken}</p>
                      </div>
                    </div>
                  ))}
                  {suspiciousActivities.length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        No security alerts. Your account appears secure.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SecuritySettings;
