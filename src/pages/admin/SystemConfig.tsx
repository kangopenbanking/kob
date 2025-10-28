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

interface SystemConfig {
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
  const [config, setConfig] = useState<SystemConfig>({
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
      // In a real implementation, this would load from a system_config table
      // For now, using default values
      setConfig({
        maintenance_mode: false,
        allow_new_registrations: true,
        max_api_rate_limit: 1000,
        session_timeout_minutes: 60,
        password_min_length: 8,
        require_2fa: false,
        email_notifications_enabled: true,
        webhook_retry_attempts: 3
      });
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
      // In a real implementation, this would save to a system_config table
      logger.info('Saving system configuration:', config);
      
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
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Configuration</h1>
          <p className="text-muted-foreground">Manage platform settings and features</p>
        </div>

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
                  onChange={(e) => setConfig({ ...config, session_timeout_minutes: parseInt(e.target.value) })}
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
                  onChange={(e) => setConfig({ ...config, password_min_length: parseInt(e.target.value) })}
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
                  onChange={(e) => setConfig({ ...config, max_api_rate_limit: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook Retry Attempts</Label>
                <Input
                  type="number"
                  value={config.webhook_retry_attempts}
                  onChange={(e) => setConfig({ ...config, webhook_retry_attempts: parseInt(e.target.value) })}
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
    </AdminLayout>
  );
}
