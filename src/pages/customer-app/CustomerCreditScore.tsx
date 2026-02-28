import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, Shield, Clock, CreditCard, Loader2, Zap, Calendar, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerCreditScore } from '@/hooks/useCustomerData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

const CustomerCreditScore: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { data: scoreData, isLoading } = useCustomerCreditScore(user?.id);

  // Fetch recent credit events for history
  const { data: events = [] } = useQuery({
    queryKey: ['credit-events', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('credit_events')
        .select('id, event_type, value_numeric, description, event_time')
        .eq('user_id', user!.id)
        .order('event_time', { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const score = scoreData?.score ?? 0;
  const maxScore = 850;
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;

  const factors = [
    { name: 'Payment History', score: scoreData?.payment_history_score ?? 0, icon: Clock, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
    { name: 'Credit Utilization', score: scoreData?.amounts_owed_score ?? 0, icon: CreditCard, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
    { name: 'Account Age', score: scoreData?.credit_history_length_score ?? 0, icon: Shield, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
    { name: 'New Credit', score: scoreData?.new_credit_score ?? 0, icon: Zap, color: 'bg-[hsl(270,60%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
    { name: 'Credit Mix', score: scoreData?.credit_mix_score ?? 0, icon: BarChart3, color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]' },
  ];

  const getRating = (s: number) => {
    if (s >= 750) return { label: 'Excellent', color: 'text-[hsl(150,60%,35%)]' };
    if (s >= 700) return { label: 'Good', color: 'text-[hsl(150,40%,40%)]' };
    if (s >= 600) return { label: 'Fair', color: 'text-[hsl(45,60%,40%)]' };
    if (s > 0) return { label: 'Needs Improvement', color: 'text-destructive' };
    return { label: 'No Score', color: 'text-muted-foreground' };
  };

  const getScoreColor = (s: number) => {
    if (s >= 750) return 'hsl(150,60%,35%)';
    if (s >= 700) return 'hsl(150,40%,40%)';
    if (s >= 600) return 'hsl(45,60%,40%)';
    if (s > 0) return 'hsl(0,60%,50%)';
    return 'hsl(0,0%,70%)';
  };

  const eventIcon = (type: string) => {
    if (type.includes('LATE') || type.includes('MISSED')) return { icon: AlertCircle, color: 'text-destructive' };
    if (type.includes('ON_TIME') || type.includes('DEPOSIT')) return { icon: TrendingUp, color: 'text-[hsl(150,60%,40%)]' };
    return { icon: Calendar, color: 'text-muted-foreground' };
  };

  const rating = getRating(score);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Credit Score</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Credit Score</h1>
      </div>

      {/* Score Gauge */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 rounded-3xl bg-[hsl(150,40%,90%)] p-8">
        <div className="relative flex h-36 w-36 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(150,30%,80%)" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={getScoreColor(score)} strokeWidth="8"
              strokeDasharray={`${pct * 2.64} 264`} strokeLinecap="round" />
          </svg>
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{score || '—'}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">of {maxScore}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {score >= 600 ? (
            <TrendingUp className="h-4 w-4 text-[hsl(150,40%,35%)]" strokeWidth={2} />
          ) : score > 0 ? (
            <TrendingDown className="h-4 w-4 text-destructive" strokeWidth={2} />
          ) : null}
          <p className={`text-xs font-bold ${rating.color}`}>{rating.label}</p>
        </div>
        {scoreData?.updated_at && (
          <p className="text-[10px] text-muted-foreground">
            Updated {format(new Date(scoreData.updated_at), 'MMM d, yyyy')}
          </p>
        )}
      </motion.div>

      {/* Factors */}
      {score > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Score Factors</p>
          <div className="space-y-2">
            {factors.filter(f => f.score > 0).map((f, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-2xl ${f.color} p-3.5`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background/50">
                  <f.icon className={`h-4 w-4 ${f.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">{f.name}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-background/50 overflow-hidden">
                    <div className="h-full rounded-full bg-foreground/60" style={{ width: `${f.score}%` }} />
                  </div>
                </div>
                <span className="text-xs font-bold text-foreground">{f.score}%</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Credit Events */}
      {events.length > 0 && (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Recent Activity</p>
          <div className="space-y-1.5">
            {events.map((ev: any, i: number) => {
              const { icon: EIcon, color } = eventIcon(ev.event_type);
              const isPositive = ev.event_type.includes('ON_TIME') || ev.event_type.includes('DEPOSIT');
              return (
                <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card border border-border p-3">
                  <EIcon className={`h-4 w-4 ${color} shrink-0`} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{ev.description || ev.event_type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.event_time ? format(new Date(ev.event_time), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                  {ev.value_numeric > 0 && (
                    <span className={`text-[11px] font-bold ${isPositive ? 'text-[hsl(150,60%,40%)]' : 'text-destructive'}`}>
                      {isPositive ? '+' : '−'}{ev.value_numeric}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Tips */}
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Tips to Improve</p>
      <div className="space-y-2">
        {[
          'Pay Njangi contributions on time',
          'Make regular Piggy Bank deposits',
          'Report rent payments monthly',
          'Repay loans before due dates',
        ].map((tip, i) => (
          <div key={i} className="flex items-start gap-2 rounded-2xl bg-card border border-border p-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(150,40%,90%)] text-[10px] font-bold text-[hsl(150,40%,35%)]">{i + 1}</span>
            <p className="text-xs text-foreground">{tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerCreditScore;
