import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, HandCoins, CalendarDays, Loader2, Plus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface Promise {
  id: string;
  loan_account_id: string;
  promised_amount: number;
  promised_date: string;
  status: string;
  payment_method: string;
  currency: string;
  kept_amount: number;
  created_at: string;
  missed_fee_amount?: number | null;
  missed_fee_currency?: string | null;
  missed_fee_type?: string | null;
  missed_fee_charged_at?: string | null;
  missed_fee_reference?: string | null;
}

const statusMeta: Record<string, { tone: string; icon: React.ElementType; label: string }> = {
  scheduled: { tone: 'border-primary/40 text-primary', icon: Clock, label: 'Scheduled' },
  partially_kept: { tone: 'border-amber-500/50 text-amber-600', icon: AlertTriangle, label: 'Partially kept' },
  kept: { tone: 'border-emerald-500/50 text-emerald-600', icon: CheckCircle2, label: 'Kept' },
  broken: { tone: 'border-destructive/60 text-destructive', icon: AlertTriangle, label: 'Not kept' },
  cancelled: { tone: 'border-muted-foreground/40 text-muted-foreground', icon: AlertTriangle, label: 'Cancelled' },
  rescheduled: { tone: 'border-muted-foreground/40 text-muted-foreground', icon: Clock, label: 'Rescheduled' },
};

const CustomerPromiseToPay: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [promises, setPromises] = useState<Promise[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ptp-ops', { body: { action: 'list' } });
      if (error) throw error;
      setPromises((data as any)?.promises ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load promises');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const active = promises.find((p) => p.status === 'scheduled' || p.status === 'partially_kept');
  const history = promises.filter((p) => p !== active);

  const fmt = (n: number, c: string) => `${Number(n).toLocaleString()} ${c}`;
  const remaining = active ? Math.max(Number(active.promised_amount) - Number(active.kept_amount || 0), 0) : 0;
  const progress = active && Number(active.promised_amount) > 0
    ? Math.min(100, (Number(active.kept_amount || 0) / Number(active.promised_amount)) * 100)
    : 0;
  const daysToDue = active ? differenceInCalendarDays(parseISO(active.promised_date), new Date()) : null;

  return (
    <div className="flex flex-col gap-5 p-5 pb-10">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back" className="-ml-2 rounded-full p-2 transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Promise to Pay</h1>
          <p className="text-xs text-muted-foreground">Your loan repayment promises</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : active ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-3xl border-primary/30 bg-card p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <HandCoins className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Current promise</p>
                  <p className="text-[11px] text-muted-foreground">PTP-{active.id.slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <Badge variant="outline" className={statusMeta[active.status]?.tone}>
                {statusMeta[active.status]?.label ?? active.status}
              </Badge>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Remaining</p>
                <p className="mt-1 text-lg font-bold text-foreground">{fmt(remaining, active.currency)}</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Next due</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{format(parseISO(active.promised_date), 'd MMM yyyy')}</p>
                {daysToDue !== null && (
                  <p className={`text-[11px] font-medium ${daysToDue < 0 ? 'text-destructive' : daysToDue <= 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    {daysToDue < 0 ? `${Math.abs(daysToDue)} day(s) overdue` : daysToDue === 0 ? 'Due today' : `in ${daysToDue} day(s)`}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                <span>Paid {fmt(active.kept_amount || 0, active.currency)}</span>
                <span>of {fmt(active.promised_amount, active.currency)}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={load}>Refresh</Button>
              <Button className="flex-1" onClick={() => navigate('/app/bank')}>
                <CalendarDays className="mr-2 h-4 w-4" strokeWidth={1.5} /> Make payment
              </Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <Card className="rounded-3xl border-dashed bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <HandCoins className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-semibold text-foreground">No active promise</p>
          <p className="mt-1 text-xs text-muted-foreground">Schedule a Promise to Pay to manage an upcoming loan repayment.</p>
          <Button className="mt-4" onClick={() => navigate('/app/bank')}>
            <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> New promise
          </Button>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">History</p>
          <div className="space-y-2">
            {history.map((p) => {
              const meta = statusMeta[p.status] ?? statusMeta.scheduled;
              const Icon = meta.icon;
              return (
                <Card key={p.id} className="rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{fmt(p.promised_amount, p.currency)}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(p.promised_date), 'd MMM yyyy')}</p>
                    </div>
                    <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                  </div>
                  {p.missed_fee_amount && (
                    <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px] text-destructive">
                      Late-payment fee charged: {fmt(Number(p.missed_fee_amount), p.missed_fee_currency || p.currency)}
                      {p.missed_fee_charged_at ? ` on ${format(parseISO(p.missed_fee_charged_at), 'd MMM yyyy')}` : ''}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerPromiseToPay;
