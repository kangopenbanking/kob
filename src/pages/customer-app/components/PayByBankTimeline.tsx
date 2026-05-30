import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, Circle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

type TimelineEvent = { status: string; at: string; source: string; detail?: string };

interface Props {
  intentId: string;
  pollMs?: number;
  onTerminal?: (status: 'completed' | 'failed' | 'rejected' | 'expired') => void;
}

const STEPS: Array<{ key: string; label: string }> = [
  { key: 'created', label: 'Payment created' },
  { key: 'awaiting_webhook', label: 'Awaiting bank confirmation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'failed', label: 'Failed' },
];

export function PayByBankTimeline({ intentId, pollMs = 5000, onTerminal }: Props) {
  const [intent, setIntent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pay-by-bank', {
        body: { action: 'get_intent', intent_id: intentId },
      });
      if (error) throw error;
      setIntent(data);
      setError(null);
      const terminal = ['completed', 'failed', 'rejected', 'expired'];
      if (data?.status && terminal.includes(data.status)) onTerminal?.(data.status);
    } catch (e: any) {
      setError(e?.message || 'Could not refresh status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let stop = false;
    let timer: any;
    const loop = async () => {
      if (stop) return;
      await fetchOnce();
      const terminal = ['completed', 'failed', 'rejected', 'expired'];
      if (!terminal.includes(intent?.status)) timer = setTimeout(loop, pollMs);
    };
    loop();
    return () => { stop = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId]);

  if (!intent && !error) {
    return (
      <Card className="p-4 mb-4 flex items-center gap-3 border-border/60">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading payment status…</span>
      </Card>
    );
  }

  const timeline: TimelineEvent[] = Array.isArray(intent?.timeline) ? intent.timeline : [];
  const reached = new Set(timeline.map((t) => t.status));
  const finalStatus = intent?.status as string | undefined;

  const renderIcon = (key: string) => {
    if (key === 'failed') {
      return finalStatus === 'failed'
        ? <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
        : <Circle className="h-5 w-5 text-muted-foreground/40" aria-hidden />;
    }
    if (reached.has(key) || (key === 'confirmed' && finalStatus === 'completed')) {
      return <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />;
    }
    if (key === 'awaiting_webhook' && finalStatus === 'awaiting_auth') {
      return <Clock className="h-5 w-5 text-primary animate-pulse" aria-hidden />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground/40" aria-hidden />;
  };

  return (
    <Card className="p-4 mb-4 border-border/60" role="region" aria-label="Pay by Bank status">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Pay by Bank · status</h3>
          <p className="text-xs text-muted-foreground">
            Intent {intent?.id?.slice(0, 8)}…
            {intent?.rail ? ` · ${intent.rail}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={finalStatus === 'completed' ? 'default' : finalStatus === 'failed' ? 'destructive' : 'secondary'}>
            {finalStatus || 'pending'}
          </Badge>
          <Button size="sm" variant="ghost" onClick={fetchOnce} disabled={loading} aria-label="Refresh status">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <ol className="space-y-2" aria-live="polite">
        {STEPS.filter((s) => s.key !== 'failed' || finalStatus === 'failed').map((s) => {
          const ev = timeline.find((t) => t.status === s.key);
          return (
            <li key={s.key} className="flex items-start gap-3 text-sm">
              {renderIcon(s.key)}
              <div className="flex-1">
                <div className="font-medium">{s.label}</div>
                {ev && (
                  <div className="text-xs text-muted-foreground">
                    {new Date(ev.at).toLocaleString()} · {ev.source}
                    {ev.detail ? ` · ${ev.detail}` : ''}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {intent?.failure_reason && (
        <p className="mt-3 text-xs text-destructive">Reason: {intent.failure_reason}</p>
      )}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </Card>
  );
}

export default PayByBankTimeline;
