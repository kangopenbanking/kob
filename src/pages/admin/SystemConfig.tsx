import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Save, RefreshCw, Shield, Zap, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface SystemConfigData {
  maintenance_mode: boolean;
  allow_new_registrations: boolean;
  max_api_rate_limit: number;
  session_timeout_minutes: number;
  password_min_length: number;
  require_2fa: boolean;
  email_notifications_enabled: boolean;
  webhook_retry_attempts: number;
}

export default function SystemConfig() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SystemConfigData>({
    maintenance_mode: false,
    allow_new_registrations: true,
    max_api_rate_limit: 1000,
    session_timeout_minutes: 60,
    password_min_length: 8,
    require_2fa: false,
    email_notifications_enabled: true,
    webhook_retry_attempts: 3
  });

  useEffect(() => {
    checkAdminAccess();
    loadConfig();
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

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', [
          'security.password_min_length',
          'security.mfa_required',
          'rate_limit.default',
          'webhook.retry_attempts'
        ]);

      if (error) throw error;

      if (data && data.length > 0) {
        const configMap: Record<string, any> = {};
        data.forEach((row: any) => {
          configMap[row.key] = row.value;
        });

        setConfig(prev => ({
          ...prev,
          password_min_length: typeof configMap['security.password_min_length'] === 'number' 
            ? configMap['security.password_min_length'] : prev.password_min_length,
          require_2fa: configMap['security.mfa_required'] === true,
          max_api_rate_limit: configMap['rate_limit.default']?.requests_per_minute 
            ? configMap['rate_limit.default'].requests_per_minute * 60 : prev.max_api_rate_limit,
          webhook_retry_attempts: typeof configMap['webhook.retry_attempts'] === 'number' 
            ? configMap['webhook.retry_attempts'] : prev.webhook_retry_attempts,
        }));
      }
    } catch (error) {
      logger.error('Error loading config:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      
      const updates = [
        { key: 'security.password_min_length', value: config.password_min_length, category: 'security' },
        { key: 'security.mfa_required', value: config.require_2fa, category: 'security' },
        { key: 'rate_limit.default', value: { requests_per_minute: Math.round(config.max_api_rate_limit / 60), burst_size: 100 }, category: 'security' },
        { key: 'webhook.retry_attempts', value: config.webhook_retry_attempts, category: 'webhooks' },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('system_config')
          .update({ value: update.value, updated_at: new Date().toISOString() })
          .eq('key', update.key);

        if (error) throw error;
      }
      
      toast.success('Configuration saved successfully');
    } catch (error) {
      logger.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 flex items-center justify-center min-h-screen">
      <AdminPageHeader icon={Settings} title="System Configuration" description="Manage platform settings, features, and environment configuration" />

        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api">
            <Zap className="h-4 w-4 mr-2" />
            API Settings
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Core platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Temporarily disable access to the platform
                  </p>
                </div>
                <Switch
                  checked={config.maintenance_mode}
                  onCheckedChange={(checked) => setConfig({ ...config, maintenance_mode: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow New Registrations</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable new user registrations
                  </p>
                </div>
                <Switch
                  checked={config.allow_new_registrations}
                  onCheckedChange={(checked) => setConfig({ ...config, allow_new_registrations: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Input
                  type="number"
                  value={config.session_timeout_minutes}
                  onChange={(e) => setConfig({ ...config, session_timeout_minutes: parseInt(e.target.value) || 60 })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Authentication and access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Password Minimum Length</Label>
                <Input
                  type="number"
                  value={config.password_min_length}
                  onChange={(e) => setConfig({ ...config, password_min_length: parseInt(e.target.value) || 8 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Enforce 2FA for all users
                  </p>
                </div>
                <Switch
                  checked={config.require_2fa}
                  onCheckedChange={(checked) => setConfig({ ...config, require_2fa: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Rate limits and webhook settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Max API Rate Limit (requests/hour)</Label>
                <Input
                  type="number"
                  value={config.max_api_rate_limit}
                  onChange={(e) => setConfig({ ...config, max_api_rate_limit: parseInt(e.target.value) || 1000 })}
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook Retry Attempts</Label>
                <Input
                  type="number"
                  value={config.webhook_retry_attempts}
                  onChange={(e) => setConfig({ ...config, webhook_retry_attempts: parseInt(e.target.value) || 3 })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Email and alert preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable system email notifications
                  </p>
                </div>
                <Switch
                  checked={config.email_notifications_enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, email_notifications_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
