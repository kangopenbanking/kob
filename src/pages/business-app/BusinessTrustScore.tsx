import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Loader2, Award, BarChart3, ScrollText } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMerchantContext } from '@/hooks/useMerchantContext';

const TIER_STYLES: Record<string, { bg: string; ring: string; label: string; icon: string }> = {
  platinum: { bg: 'bg-violet-500/10', ring: 'ring-violet-400', label: 'text-violet-700', icon: 'text-violet-500' },
  gold:     { bg: 'bg-amber-500/10',  ring: 'ring-amber-400',  label: 'text-amber-700',  icon: 'text-amber-500' },
  silver:   { bg: 'bg-slate-300/20',  ring: 'ring-slate-300',  label: 'text-slate-700',  icon: 'text-slate-500' },
  bronze:   { bg: 'bg-orange-500/10', ring: 'ring-orange-400', label: 'text-orange-700', icon: 'text-orange-500' },
  unverified: { bg: 'bg-muted',       ring: 'ring-border',     label: 'text-muted-foreground', icon: 'text-muted-foreground' },
};

const RISK_COLOR: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-500/10',
  medium: 'text-amber-600 bg-amber-500/10',
  high: 'text-orange-600 bg-orange-500/10',
  critical: 'text-rose-600 bg-rose-500/10',
};

const BusinessTrustScore: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useMerchantContext();
  const [recalculating, setRecalculating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['merchant-trust-score', merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data: res, error } = await supabase.functions.invoke('merchant-trust-score', {
        body: { action: 'get', merchant_id: merchantId },
      });
      if (error) throw error;
      return res?.data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ['merchant-trust-history', merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data: res } = await supabase.functions.invoke('merchant-trust-score', {
        body: { action: 'history', merchant_id: merchantId },
      });
      return res?.data;
    },
  });

  const score = data?.overall_score ?? 0;
  const tier = (data?.trust_tier ?? 'unverified') as string;
  const tierStyle = TIER_STYLES[tier] ?? TIER_STYLES.unverified;
  const risk = (data?.risk_level ?? 'medium') as string;
  const factors = data?.factors_summary ?? data?.factors ?? null;
  const breakdown = data?.score_breakdown ?? null;

  const handleRefresh = async () => {
    setRecalculating(true);
    try {
      // Self-recalculation via the calculate action requires admin in current backend.
      // For the merchant view we just refetch the latest cached score.
      await refetch();
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Trust Score</h1>
          <p className="text-xs text-muted-foreground">Your merchant credibility & risk profile</p>
        </div>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="px-5 space-y-5">
          {/* Score hero */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl ${tierStyle.bg} ring-1 ${tierStyle.ring} p-6 flex flex-col items-center gap-3`}
          >
            <div className="relative h-32 w-32 flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="currentColor"
                  className={tierStyle.icon}
                  strokeWidth="6"
                  strokeDasharray="264"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 264 }}
                  animate={{ strokeDashoffset: 264 - (score / 100) * 264 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </svg>
              <div className="text-center">
                <p className="text-3xl font-bold text-foreground">{score}</p>
                <p className="text-[10px] font-semibold text-muted-foreground">of 100</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Award className={`h-4 w-4 ${tierStyle.icon}`} strokeWidth={2} />
              <span className={`text-sm font-bold uppercase tracking-wide ${tierStyle.label}`}>{tier}</span>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${RISK_COLOR[risk] ?? 'bg-muted text-muted-foreground'}`}>
              {risk} risk
            </span>
            {data?.last_calculated_at && (
              <p className="text-[10px] text-muted-foreground">
                Updated {new Date(data.last_calculated_at).toLocaleDateString()}
              </p>
            )}
          </motion.div>

          {/* Factors summary */}
          {factors && (
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" strokeWidth={2} /> Score Factors
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(factors).map(([key, value]: [string, any]) => (
                  <div key={key} className="rounded-2xl border border-border/40 bg-card p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs font-bold capitalize mt-1">{String(value).replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed breakdown (admin / owner view) */}
          {breakdown && (
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4" strokeWidth={2} /> Detailed Breakdown
              </h2>
              <div className="space-y-2">
                {Object.entries(breakdown).map(([key, val]: [string, any]) => (
                  <div key={key} className="rounded-2xl border border-border/40 bg-card p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold capitalize">{key.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-bold text-foreground">
                        {val.score}/{val.max}
                      </p>
                    </div>
                    <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground/70 rounded-full"
                        style={{ width: `${(val.score / val.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History sparkline */}
          {history?.history?.length > 0 && (
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" strokeWidth={2} /> History
              </h2>
              <div className="rounded-2xl border border-border/40 bg-card p-4">
                <div className="flex items-end gap-1 h-20">
                  {history.history.slice(-12).map((h: any, i: number) => (
                    <div
                      key={i}
                      className="flex-1 bg-foreground/40 rounded-sm"
                      style={{ height: `${(h.score / 100) * 100}%` }}
                      title={`${h.score} (${h.tier})`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Last {Math.min(12, history.history.length)} snapshots</p>
              </div>
            </div>
          )}

          {/* Improvement tips */}
          <div>
            <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" strokeWidth={2} /> How to Improve
            </h2>
            <div className="space-y-2">
              {[
                { icon: CheckCircle2, text: 'Complete KYB verification with all required documents' },
                { icon: TrendingUp, text: 'Process more successful transactions consistently' },
                { icon: AlertTriangle, text: 'Reduce failed payment rate below 5%' },
                { icon: ShieldCheck, text: 'Resolve disputes promptly to keep dispute ratio low' },
              ].map((tip, i) => {
                const Icon = tip.icon;
                return (
                  <div key={i} className="flex items-start gap-3 rounded-2xl border border-border/40 bg-card p-3">
                    <Icon className="h-4 w-4 mt-0.5 text-foreground/70 shrink-0" strokeWidth={2} />
                    <p className="text-xs text-foreground">{tip.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={recalculating}
            className="w-full rounded-2xl bg-foreground text-background py-3 text-sm font-bold disabled:opacity-50"
          >
            {recalculating ? 'Refreshing…' : 'Refresh Score'}
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessTrustScore;
