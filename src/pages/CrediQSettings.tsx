import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function CrediQSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    score_change_alerts: true,
    weekly_digest: true,
    monthly_report: true,
    goal_achievement_alerts: true,
    tips_recommendations: true,
    product_recommendations: false,
    marketing_emails: false
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('crediq_email_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences(data);
      }
    } catch (error: any) {
      console.error('Error fetching preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load preferences",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      const { error } = await supabase
        .from('crediq_email_preferences')
        .upsert({
          user_id: user.id,
          ...preferences
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your preferences have been saved"
      });
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 py-8">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">CrediQ Settings</h1>
            <p className="text-muted-foreground">
              Manage your email notifications and preferences
            </p>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-6">Email Notifications</h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="score_change">Score Change Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when your credit score changes by 10+ points
                  </p>
                </div>
                <Switch
                  id="score_change"
                  checked={preferences.score_change_alerts}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, score_change_alerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="weekly_digest">Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of your credit health every Monday
                  </p>
                </div>
                <Switch
                  id="weekly_digest"
                  checked={preferences.weekly_digest}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, weekly_digest: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="monthly_report">Monthly Report</Label>
                  <p className="text-sm text-muted-foreground">
                    Get a comprehensive monthly credit report on the 1st of each month
                  </p>
                </div>
                <Switch
                  id="monthly_report"
                  checked={preferences.monthly_report}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, monthly_report: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="goal_achievements">Goal Achievements</Label>
                  <p className="text-sm text-muted-foreground">
                    Celebrate when you reach your credit score goals
                  </p>
                </div>
                <Switch
                  id="goal_achievements"
                  checked={preferences.goal_achievement_alerts}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, goal_achievement_alerts: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tips">Tips & Recommendations</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive personalized tips to improve your credit score
                  </p>
                </div>
                <Switch
                  id="tips"
                  checked={preferences.tips_recommendations}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, tips_recommendations: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="products">Product Recommendations</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about loans and financial products you qualify for
                  </p>
                </div>
                <Switch
                  id="products"
                  checked={preferences.product_recommendations}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, product_recommendations: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing">Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive news and updates about CrediQ features
                  </p>
                </div>
                <Switch
                  id="marketing"
                  checked={preferences.marketing_emails}
                  onCheckedChange={(checked) =>
                    setPreferences({ ...preferences, marketing_emails: checked })
                  }
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Preferences'
                )}
              </Button>
              <Button variant="outline" onClick={() => navigate('/crediq/dashboard')}>
                Cancel
              </Button>
            </div>
          </Card>

          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4">About Your Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your CrediQ score is calculated using data from your Kang Open Banking activities. 
              We never share your personal information without your explicit permission.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/privacy" aria-label="Read the CrediQ privacy and data usage policy">Read the CrediQ privacy policy</Link>
            </Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
