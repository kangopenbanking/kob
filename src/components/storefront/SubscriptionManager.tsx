import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Crown, CalendarClock, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Clock, History } from 'lucide-react';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { motion } from 'framer-motion';

interface Props { merchantId: string }

const EVENT_LABELS: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'destructive' }> = {
  trial_started:        { label: 'Free trial started',        tone: 'info' },
  trial_converted:      { label: 'Trial converted to paid',   tone: 'success' },
  trial_failed:         { label: 'Trial conversion failed',   tone: 'destructive' },
  subscription_created: { label: 'Subscription activated',    tone: 'success' },
  renewed:              { label: 'Renewed',                   tone: 'success' },
  renewal_failed:       { label: 'Renewal attempt failed',    tone: 'warning' },
  past_due:             { label: 'Past due',                  tone: 'warning' },
  cancelled:            { label: 'Auto-renew cancelled',      tone: 'info' },
  expired:              { label: 'Expired',                   tone: 'destructive' },
  reactivated:          { label: 'Reactivated',               tone: 'success' },
  auto_renew_toggled:   { label: 'Auto-renew updated',        tone: 'info' },
};

export function SubscriptionManager({ merchantId }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-store-subscription', {
        method: 'GET' as any,
      } as any);
      // Fallback: invoke does not pass query params for GET; use direct fetch via REST
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-store-subscription?merchant_id=${merchantId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      const payload = await res.json();
      setSubscription(payload.subscription);
      setTrialUsed(!!payload.trial_used);
      setEvents(payload.events || []);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to load subscription'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (merchantId) load(); }, [merchantId]);

  const callAction = async (action: string, extra: Record<string, any> = {}) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-store-subscription', {
        body: { action, merchant_id: merchantId, subscription_id: subscription?.id, ...extra },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast.success((data as any).message || 'Updated');
      await load();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Action failed'));
    } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <Card><CardContent className="py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5" />Publishing Subscription</CardTitle>
          <CardDescription>Choose a plan in the Plans tab to publish your store on the marketplace.</CardDescription>
        </CardHeader>
        {trialUsed && (
          <CardContent>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <span>You have already used your one-time free trial. New subscriptions will be charged immediately.</span>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  const plan = subscription.pos_subscription_plans;
  const isTrialing = subscription.status === 'trialing';
  const isPastDue = subscription.status === 'past_due';
  const expiresAt = subscription.trial_ends_at && isTrialing
    ? new Date(subscription.trial_ends_at)
    : new Date(subscription.expires_at);
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000));
  const nextBilling = subscription.next_billing_attempt_at ? new Date(subscription.next_billing_attempt_at) : null;

  const statusBadge = () => {
    if (isTrialing) return <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30">Free Trial</Badge>;
    if (isPastDue) return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">Past Due</Badge>;
    if (subscription.status === 'active') return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">Active</Badge>;
    return <Badge variant="outline">{subscription.status}</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />{plan?.name || 'Plan'} {statusBadge()}
              </CardTitle>
              <CardDescription className="mt-1">
                {plan?.price?.toLocaleString()} {plan?.currency} every {plan?.duration_days} days
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={load} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status panel */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />{isTrialing ? 'Trial ends' : 'Expires'}
              </div>
              <div className="mt-1 font-semibold">{expiresAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{daysLeft} day(s) left</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />Next billing attempt
              </div>
              <div className="mt-1 font-semibold">
                {nextBilling ? nextBilling.toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {subscription.auto_renew ? 'Auto-debit from wallet' : 'Auto-renew off'}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {subscription.auto_renew ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                Auto-renew
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Switch
                  checked={!!subscription.auto_renew}
                  disabled={busy}
                  onCheckedChange={(v) => callAction('toggle_auto_renew', { auto_renew: v })}
                />
                <span className="text-xs text-muted-foreground">{subscription.auto_renew ? 'On' : 'Off'}</span>
              </div>
            </div>
          </div>

          {/* Past-due warning */}
          {isPastDue && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <div className="font-medium text-amber-900">Renewal failed — top up your wallet</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Attempt {subscription.renewal_attempts}/3. {subscription.last_renewal_error}
                </div>
              </div>
            </div>
          )}

          {/* Cancel */}
          {subscription.auto_renew && (
            <div className="pt-2 border-t border-border">
              <Button variant="outline" size="sm" disabled={busy} onClick={() => {
                if (confirm('Turn off auto-renewal? Your subscription stays active until expiry, then your store will be unpublished.')) {
                  callAction('cancel');
                }
              }}>Cancel auto-renewal</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event history */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {events.slice(0, 10).map((e) => {
                const meta = EVENT_LABELS[e.event_type] || { label: e.event_type, tone: 'info' as const };
                return (
                  <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{meta.label}</div>
                      {e.amount > 0 && <div className="text-xs text-muted-foreground">{Number(e.amount).toLocaleString()} {e.currency}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
