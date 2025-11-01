import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import CircularScoreDisplay from "@/components/credit/CircularScoreDisplay";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock } from "lucide-react";

export default function CrediQDashboard() {
  const [loading, setLoading] = useState(true);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch credit score
      const { data: scoreData, error: scoreError } = await supabase
        .from('credit_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (scoreError) throw scoreError;

      // Check if user has completed questionnaire
      if (!scoreData) {
        const { data: profileData } = await supabase
          .from('crediq_user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (!profileData) {
          navigate('/crediq/onboarding');
          return;
        }
      }

      setCreditScore(scoreData);

      // Fetch action plans
      const { data: actionsData } = await supabase
        .from('crediq_action_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .limit(5);

      setActionPlans(actionsData || []);

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load dashboard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreRating = (score: number) => {
    if (score >= 800) return { label: "Excellent", color: "text-green-600", bg: "bg-green-100" };
    if (score >= 740) return { label: "Very Good", color: "text-blue-600", bg: "bg-blue-100" };
    if (score >= 670) return { label: "Good", color: "text-purple-600", bg: "bg-purple-100" };
    if (score >= 580) return { label: "Fair", color: "text-orange-600", bg: "bg-orange-100" };
    return { label: "Poor", color: "text-red-600", bg: "bg-red-100" };
  };

  const getPriorityIcon = (priority: string) => {
    if (priority === 'high') return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (priority === 'medium') return <Clock className="h-5 w-5 text-orange-600" />;
    return <CheckCircle className="h-5 w-5 text-blue-600" />;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (status === 'in_progress') return <Clock className="h-5 w-5 text-blue-600" />;
    return <AlertCircle className="h-5 w-5 text-gray-400" />;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading your CrediQ dashboard...</div>
        </div>
      </Layout>
    );
  }

  if (!creditScore) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4">No Credit Score Found</h2>
            <p className="text-muted-foreground mb-6">
              Complete the CrediQ questionnaire to get your baseline credit score.
            </p>
            <Button onClick={() => navigate('/crediq/onboarding')}>
              Start Questionnaire
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  const rating = getScoreRating(Number(creditScore.score));

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Your Credit Health</h1>
            <p className="text-muted-foreground">
              Track your CrediQ score and follow your action plan to improve
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            {/* Score Display */}
            <div className="lg:col-span-2">
              <Card className="p-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="flex-shrink-0">
                    <CircularScoreDisplay 
                      score={Number(creditScore.score)}
                      maxScore={850}
                    />
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${rating.bg} ${rating.color}`}>
                        {rating.label}
                      </span>
                    </div>
                    
                    <h2 className="text-3xl font-bold mb-2">{creditScore.score}</h2>
                    <p className="text-muted-foreground mb-4">
                      Out of 850 points
                    </p>
                    
                    {creditScore.score_factors?.components && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span>Payment History</span>
                          <span className="font-semibold text-green-600">Good ✓</span>
                        </div>
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span>Debt Ratio</span>
                          <span className="font-semibold text-blue-600">Fair</span>
                        </div>
                      </div>
                    )}
                    
                    <Button className="mt-4" variant="outline" onClick={() => navigate('/credit-score')}>
                      View Full Report
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="space-y-4">
              <Card className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Recent Change</h3>
                    <p className="text-2xl font-bold text-green-600">+0</p>
                    <p className="text-sm text-muted-foreground">Last 30 days</p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Score Type</h3>
                    <p className="text-sm text-muted-foreground">
                      {creditScore.scoring_model === 'questionnaire' ? 'Baseline' : 'Full Calculation'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Action Plan */}
          {actionPlans.length > 0 && (
            <Card className="p-6 mb-6">
              <h2 className="text-2xl font-bold mb-6">Your Action Plan</h2>
              
              <div className="space-y-4">
                {actionPlans.map((action) => (
                  <div 
                    key={action.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="mt-1">
                      {getStatusIcon(action.status)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-semibold">{action.action_title}</h3>
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(action.priority)}
                          <span className="text-sm font-semibold text-green-600">
                            +{action.estimated_impact} pts
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {action.action_description}
                      </p>
                      {action.status === 'pending' && (
                        <Button size="sm" variant="outline">
                          Start Action
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tips */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">💡 Quick Tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Your score updates automatically when you make payments or open accounts</li>
              <li>• Complete KYC verification to unlock +50 points</li>
              <li>• Making on-time payments is the #1 way to improve your score</li>
              <li>• We'll email you when your score changes significantly</li>
            </ul>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
