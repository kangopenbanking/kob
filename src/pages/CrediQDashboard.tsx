import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import CircularScoreDisplay from "@/components/credit/CircularScoreDisplay";
import { SafeImage } from "@/components/common/SafeImage";
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle, Clock,
  ArrowRight, ExternalLink, Shield, Zap, Target, Lightbulb,
  CreditCard, Building2, PiggyBank, BarChart3, ChevronRight,
  Sparkles, Award, Eye, FileText, Banknote, Percent, Calendar,
} from "lucide-react";

// Score factor config
const SCORE_FACTORS = [
  { key: "payment_history", label: "Payment History", weight: 35, icon: Clock, color: "#10b981", description: "On-time payments on loans and bills" },
  { key: "credit_utilization", label: "Credit Utilization", weight: 30, icon: CreditCard, color: "#3b82f6", description: "How much of your available credit you use" },
  { key: "account_age", label: "Account Age", weight: 15, icon: Building2, color: "#8b5cf6", description: "Length of your credit history" },
  { key: "credit_mix", label: "Credit Mix", weight: 10, icon: BarChart3, color: "#f59e0b", description: "Variety of credit types you use" },
  { key: "new_inquiries", label: "New Inquiries", weight: 10, icon: Eye, color: "#ef4444", description: "Recent credit applications" },
];

const SCORE_BANDS = [
  { min: 800, max: 850, label: "Excellent", color: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", hint: "You're in the top tier! Maintain your habits." },
  { min: 740, max: 799, label: "Very Good", color: "#3b82f6", bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 dark:text-blue-400", hint: "Almost excellent — a few tweaks will get you there." },
  { min: 670, max: 739, label: "Good", color: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-400", hint: "Solid foundation. Focus on payment consistency." },
  { min: 580, max: 669, label: "Fair", color: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", hint: "Room for improvement — follow your action plan." },
  { min: 300, max: 579, label: "Poor", color: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-700 dark:text-red-400", hint: "Start with the basics: verify identity and save regularly." },
];

function getBand(score: number) {
  return SCORE_BANDS.find(b => score >= b.min && score <= b.max) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

// Mini doughnut component for factor breakdown
function FactorDoughnut({ factor, value, delay }: { factor: typeof SCORE_FACTORS[0]; value: number; delay: number }) {
  const size = 64;
  const strokeW = 6;
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  const Icon = factor.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={strokeW} fill="none" opacity={0.4} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={factor.color}
            strokeWidth={strokeW}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ delay: delay + 0.3, duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-4 h-4" style={{ color: factor.color }} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-foreground leading-tight">{factor.label}</p>
        <p className="text-[10px] text-muted-foreground">{factor.weight}% weight</p>
      </div>
    </motion.div>
  );
}

// Personalized insight card
function InsightCard({ icon: Icon, title, description, color, delay }: { icon: any; title: string; description: string; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card hover:shadow-md transition-shadow"
    >
      <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export default function CrediQDashboard() {
  const [loading, setLoading] = useState(true);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [actionPlans, setActionPlans] = useState<any[]>([]);
  const [preapprovedOffers, setPreapprovedOffers] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Fetch credit score via edge function (single source of truth)
      const { data: scoreData, error: scoreError } = await supabase.functions.invoke('credit-score-fetch', {
        body: { user_id: user.id, include_report: false },
      });

      if (scoreError) throw scoreError;

      if (!scoreData?.score) {
        const { data: profileData } = await supabase
          .from('crediq_user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (!profileData) { navigate('/crediq/onboarding'); return; }
      }

      setCreditScore(scoreData);

      // Fetch pre-approved loan offers eligible for user's score
      if (scoreData) {
        const score = scoreData.score || 0;
        const { data: offers } = await supabase
          .from('preapproved_loan_offers')
          .select('*, institutions!inner(institution_name, logo_url)')
          .eq('is_active', true)
          .lte('min_credit_score', score)
          .gte('max_credit_score', score)
          .order('interest_rate_annual', { ascending: true })
          .limit(5);
        setPreapprovedOffers(offers || []);
      }

      const { data: actionsData } = await supabase
        .from('crediq_action_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .limit(10);

      const uniqueActions = actionsData?.reduce((acc: any[], action: any) => {
        if (!acc.find(a => a.action_type === action.action_type)) acc.push(action);
        return acc;
      }, []).slice(0, 5) || [];

      setActionPlans(uniqueActions);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      toast({ title: "Error", description: error.message || "Failed to load dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    const map: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string }> = {
      high: { variant: "destructive", label: "High Priority" },
      medium: { variant: "default", label: "Medium" },
      low: { variant: "secondary", label: "Low" },
    };
    const conf = map[priority] || map.low;
    return <Badge variant={conf.variant} className="text-[10px] px-2 py-0">{conf.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="h-5 w-5 text-emerald-600" />;
    if (status === 'in_progress') return <Clock className="h-5 w-5 text-blue-600" />;
    return <Target className="h-5 w-5 text-muted-foreground" />;
  };

  const handleActionStart = (action: any) => {
    if (action.action_type?.includes('njangibox')) {
      window.open('https://njangibox.com', '_blank');
      return;
    }
    switch (action.action_type) {
      case 'complete_kyc': navigate('/kyc-verification'); break;
      case 'open_savings': navigate('/savings'); break;
      case 'make_payment': navigate('/loans'); break;
      default: toast({ title: "Action started", description: "Redirecting..." });
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading your CrediQ dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (!creditScore) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="p-10 text-center max-w-md border-dashed border-2">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">No Credit Score Yet</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Complete the CrediQ questionnaire to get your personalized baseline credit score and improvement plan.
            </p>
            <Button size="lg" onClick={() => navigate('/crediq/onboarding')} className="gap-2">
              Start Questionnaire <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  const score = Number(creditScore.score);
  const band = getBand(score);

  // Generate factor values (simulated from score or real data)
  const factors = creditScore.score_factors?.components;
  const factorValues = SCORE_FACTORS.map(f => ({
    ...f,
    value: factors?.[f.key] ?? Math.min(Math.max(Math.round((score / 850) * 100 + (Math.random() * 20 - 10)), 20), 100),
  }));

  // Generate personalized insights based on score
  const insights = [
    score < 740 && { icon: Zap, title: "Quick Win: Verify Your Identity", description: "Complete KYC verification to instantly boost your score by up to 50 points.", color: "#f59e0b" },
    score < 800 && { icon: PiggyBank, title: "Start a Savings Plan", description: "Regular deposits to a piggy bank account show financial discipline and improve your score.", color: "#10b981" },
    { icon: Shield, title: "Payment Consistency Matters", description: "On-time loan payments account for 35% of your score. Set up auto-pay to never miss one.", color: "#3b82f6" },
    score >= 670 && { icon: Award, title: "You're Eligible for Better Rates", description: `With a ${band.label} score, you qualify for preferred lending rates at partner institutions.`, color: "#8b5cf6" },
    { icon: Lightbulb, title: "Diversify Your Credit", description: "Using different credit types (loans, savings, mobile money) improves your credit mix score.", color: "#f97316" },
  ].filter(Boolean).slice(0, 4);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit Health</h1>
          <p className="text-muted-foreground mt-1">Your CrediQ score and personalized improvement plan</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/credit-score')} className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Full Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/crediq/settings')} className="gap-1.5">
            <Target className="w-3.5 h-3.5" /> Settings
          </Button>
        </div>
      </motion.div>

      {/* Score + Band Bar */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Main Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-3"
        >
          <Card className="relative overflow-hidden border-0 shadow-lg">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(circle at 30% 50%, ${band.color}, transparent 70%)` }} />

            <div className="relative p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <CircularScoreDisplay score={score} maxScore={850} size={240} />

                <div className="flex-1 text-center md:text-left space-y-4">
                  {/* Rating badge */}
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span
                      className="px-3 py-1 rounded-full text-sm font-bold"
                      style={{ backgroundColor: `${band.color}15`, color: band.color }}
                    >
                      {band.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {creditScore.scoring_model === 'questionnaire' ? 'Baseline Score' : 'Full Score'}
                    </span>
                  </div>

                  {/* Personalized hint */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{band.hint}</p>

                  {/* Score range bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      <span>300</span>
                      <span>Poor</span>
                      <span>Fair</span>
                      <span>Good</span>
                      <span>V.Good</span>
                      <span>Excellent</span>
                      <span>850</span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden flex">
                      {SCORE_BANDS.slice().reverse().map((b, i) => (
                        <div key={b.label} className="flex-1 first:rounded-l-full last:rounded-r-full" style={{ backgroundColor: `${b.color}30` }} />
                      ))}
                      {/* Indicator */}
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-5 rounded-sm border-2 border-background shadow-lg"
                        style={{ backgroundColor: band.color }}
                        initial={{ left: '0%' }}
                        animate={{ left: `${((score - 300) / 550) * 100}%` }}
                        transition={{ delay: 0.5, duration: 1.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Quick stats row */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
                      <TrendingUp className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">30-day change</p>
                        <p className="text-sm font-bold text-emerald-600">+0 pts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/50">
                      <Shield className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Next update</p>
                        <p className="text-sm font-bold text-foreground">Auto</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Factor Breakdown Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="p-6 h-full border-0 shadow-lg">
            <h3 className="text-sm font-semibold text-foreground mb-1">Score Factors</h3>
            <p className="text-xs text-muted-foreground mb-5">What makes up your score</p>

            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-3 gap-4 mb-6">
              {factorValues.slice(0, 3).map((f, i) => (
                <FactorDoughnut key={f.key} factor={f} value={f.value} delay={0.4 + i * 0.15} />
              ))}
            </div>

            {/* Factor detail bars */}
            <div className="space-y-3">
              {factorValues.map((f, i) => (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                      <span className="text-xs font-medium text-foreground">{f.label}</span>
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: f.color }}>{f.value}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: f.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${f.value}%` }}
                      transition={{ delay: 0.8 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{f.description}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Pre-Approved Loan Offers */}
      {preapprovedOffers.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Pre-Approved Loan Offers</h3>
              </div>
              <Badge variant="outline" className="text-[10px]">{preapprovedOffers.length} offers</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Based on your credit score of {score}, these institutions have pre-approved you for loans
            </p>
            
            <div className="space-y-3">
              {preapprovedOffers.slice(0, 3).map((offer, i) => (
                <motion.div
                  key={offer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {offer.institutions?.logo_url ? (
                      <SafeImage src={offer.institutions.logo_url} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Building2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{offer.product_name}</h4>
                        <p className="text-xs text-muted-foreground">{offer.institutions?.institution_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-primary">{offer.interest_rate_annual}%</p>
                        <p className="text-[10px] text-muted-foreground">APR</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        {offer.min_amount.toLocaleString()} - {offer.max_amount.toLocaleString()} {offer.currency}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Up to {offer.max_tenure_months} months
                      </span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-xs flex-shrink-0"
                    onClick={() => navigate('/credit-score')}
                  >
                    View Details
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </motion.div>
              ))}
            </div>
            
            {preapprovedOffers.length > 3 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4 text-xs"
                onClick={() => navigate('/credit-score')}
              >
                View all {preapprovedOffers.length} offers
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </Card>
        </motion.div>
      )}

      {/* Personalized Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-6 border-0 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Personalized Insights & Tips</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {insights.map((insight: any, i) => (
              <InsightCard key={i} {...insight} delay={0.5 + i * 0.1} />
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Action Plan */}
      {actionPlans.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="p-6 border-0 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Your Action Plan</h3>
              </div>
              <Badge variant="outline" className="text-[10px]">{actionPlans.length} actions</Badge>
            </div>

            <div className="space-y-3">
              {actionPlans.map((action, i) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.08 }}
                  className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/20 hover:shadow-sm transition-all"
                >
                  <div className="mt-0.5">{getStatusIcon(action.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className="text-sm font-semibold text-foreground">{action.action_title}</h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getPriorityBadge(action.priority)}
                        <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">+{action.estimated_impact} pts</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{action.action_description}</p>
                    {action.status === 'pending' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => handleActionStart(action)}>
                        Start Action
                        {action.action_type?.includes('njangibox') ? <ExternalLink className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </Button>
                    )}
                    {action.status === 'in_progress' && (
                      <div className="flex items-center gap-2">
                        <Progress value={50} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground">In progress</span>
                      </div>
                    )}
                    {action.status === 'completed' && (
                      <span className="text-[10px] font-medium text-emerald-600">✓ Completed</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Score Band Reference */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card className="p-6 border-0 shadow-lg">
          <h3 className="text-sm font-semibold text-foreground mb-4">Score Bands Reference</h3>
          <div className="grid grid-cols-5 gap-2">
            {SCORE_BANDS.map(b => (
              <div
                key={b.label}
                className={`relative p-3 rounded-xl text-center transition-all ${
                  score >= b.min && score <= b.max ? 'ring-2 ring-offset-2 ring-offset-background scale-105 shadow-md' : 'opacity-60'
                } ${b.bg}`}
                style={score >= b.min && score <= b.max ? { '--tw-ring-color': b.color } as React.CSSProperties : {}}
              >
                <p className={`text-xs font-bold ${b.text}`}>{b.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{b.min}–{b.max}</p>
                {score >= b.min && score <= b.max && (
                  <motion.div
                    layoutId="band-indicator"
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: b.color }}
                  >
                    <CheckCircle className="w-3 h-3 text-white" />
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
