import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Smartphone,
  CreditCard,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Save
} from "lucide-react";

interface NotificationPreferences {
  id?: string;
  user_id: string;
  
  // Notification channels
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  
  // Alert types
  security_alerts: boolean;
  transaction_alerts: boolean;
  payment_alerts: boolean;
  credit_score_alerts: boolean;
  loan_alerts: boolean;
  savings_alerts: boolean;
  
  // Frequency
  instant_notifications: boolean;
  daily_digest: boolean;
  weekly_summary: boolean;
  
  created_at?: string;
  updated_at?: string;
}

const NotificationPreferences = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

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
    await fetchPreferences(user.id);
    setLoading(false);
  };

  const fetchPreferences = async (userId: string) => {
    let { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!data) {
      // Create default preferences
      const defaultPrefs: NotificationPreferences = {
        user_id: userId,
        email_enabled: true,
        sms_enabled: false,
        in_app_enabled: true,
        security_alerts: true,
        transaction_alerts: true,
        payment_alerts: true,
        credit_score_alerts: true,
        loan_alerts: true,
        savings_alerts: true,
        instant_notifications: true,
        daily_digest: false,
        weekly_summary: false,
      };

      const { data: newData } = await supabase
        .from("notification_preferences")
        .insert(defaultPrefs)
        .select()
        .single();
      
      data = newData;
    }
    
    setPreferences(data);
  };

  const updatePreference = async (field: keyof NotificationPreferences, value: boolean) => {
    if (!preferences || !user) return;

    const updatedPrefs = { ...preferences, [field]: value };
    setPreferences(updatedPrefs);
  };

  const savePreferences = async () => {
    if (!preferences || !user) return;

    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        ...preferences,
        user_id: user.id,
        updated_at: new Date().toISOString()
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated",
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p>Loading preferences...</p>
      </div>
    );
  }

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <Bell className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-accent">Notification Settings</span>
        </div>
        <h1 className="text-4xl font-bold mb-2">Notification Preferences</h1>
        <p className="text-muted-foreground">
          Customize how and when you receive notifications
        </p>
      </div>

      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="channels">
            <MessageSquare className="mr-2 h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="alerts">
            <Bell className="mr-2 h-4 w-4" />
            Alert Types
          </TabsTrigger>
          <TabsTrigger value="frequency">
            <TrendingUp className="mr-2 h-4 w-4" />
            Frequency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Channels</CardTitle>
              <CardDescription>Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email to {user?.email}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(v) => updatePreference("email_enabled", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive important alerts via text message
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(v) => updatePreference("sms_enabled", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <Bell className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">In-App Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Show notifications in the notification center
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.in_app_enabled}
                  onCheckedChange={(v) => updatePreference("in_app_enabled", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Types</CardTitle>
              <CardDescription>Select which types of alerts you want to receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <Shield className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Security Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Suspicious activity, login attempts, and security events
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.security_alerts}
                  onCheckedChange={(v) => updatePreference("security_alerts", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Transaction Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Incoming and outgoing transactions on your accounts
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.transaction_alerts}
                  onCheckedChange={(v) => updatePreference("transaction_alerts", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <CreditCard className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Payment Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Payment confirmations, failures, and refunds
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.payment_alerts}
                  onCheckedChange={(v) => updatePreference("payment_alerts", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Credit Score Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Credit score changes and credit report updates
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.credit_score_alerts}
                  onCheckedChange={(v) => updatePreference("credit_score_alerts", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Loan Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Loan applications, approvals, and repayment reminders
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.loan_alerts}
                  onCheckedChange={(v) => updatePreference("loan_alerts", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="flex items-start space-x-3">
                  <TrendingUp className="h-5 w-5 text-teal-500 mt-0.5" />
                  <div className="space-y-1">
                    <Label className="text-base">Savings Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Savings goals, milestones, and interest earned
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences.savings_alerts}
                  onCheckedChange={(v) => updatePreference("savings_alerts", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frequency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Frequency</CardTitle>
              <CardDescription>Control how often you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start justify-between space-x-4">
                <div className="space-y-1">
                  <Label className="text-base">Instant Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications immediately as events occur
                  </p>
                </div>
                <Switch
                  checked={preferences.instant_notifications}
                  onCheckedChange={(v) => updatePreference("instant_notifications", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="space-y-1">
                  <Label className="text-base">Daily Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a summary of all notifications once per day
                  </p>
                </div>
                <Switch
                  checked={preferences.daily_digest}
                  onCheckedChange={(v) => updatePreference("daily_digest", v)}
                />
              </div>

              <div className="flex items-start justify-between space-x-4">
                <div className="space-y-1">
                  <Label className="text-base">Weekly Summary</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly report of your account activity
                  </p>
                </div>
                <Switch
                  checked={preferences.weekly_summary}
                  onCheckedChange={(v) => updatePreference("weekly_summary", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button 
          onClick={savePreferences} 
          disabled={saving}
          size="lg"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </div>
  );
};

export default NotificationPreferences;
