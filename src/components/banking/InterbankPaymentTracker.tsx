/**
 * InterbankPaymentTracker — 10-step visual payment lifecycle tracker
 * 
 * Sequential states: created -> validated -> submitted -> accepted -> in_process -> settled
 * Branch states (red): rejected, failed, reversed, expired
 * 
 * Polls GET /v1/interbank/payments/{paymentId} every 30s while in active states
 * 
 * Standards: ISO 20022 pacs.008/pacs.004/camt.056
 */

import React, { useState, useEffect, useCallback } from 'react';
import { kobApi, KOBApiError } from '@/lib/kob-api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, XCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InterbankPayment {
  id: string;
  status: string;
  amount: string;
  currency: string;
  created_at: string;
  validated_at?: string;
  submitted_at?: string;
  accepted_at?: string;
  in_process_at?: string;
  settled_at?: string;
  rejected_at?: string;
  failed_at?: string;
  reversed_at?: string;
  expired_at?: string;
  rejection_reason?: string;
  failure_reason?: string;
}

interface InterbankPaymentTrackerProps {
  paymentId: string;
  initialData?: InterbankPayment;
}

const SEQUENTIAL_STATES = ['created', 'validated', 'submitted', 'accepted', 'in_process', 'settled'];
const TERMINAL_STATES = ['settled', 'rejected', 'failed', 'reversed', 'expired'];
const BRANCH_STATES = ['rejected', 'failed', 'reversed', 'expired'];
const ACTIVE_STATES = ['created', 'validated', 'submitted', 'accepted', 'in_process'];

function getStateTimestamp(payment: InterbankPayment, state: string): string | undefined {
  const key = state === 'created' ? 'created_at' : `${state}_at`;
  return (payment as any)[key];
}

export const InterbankPaymentTracker: React.FC<InterbankPaymentTrackerProps> = ({
  paymentId,
  initialData,
}) => {
  const [payment, setPayment] = useState<InterbankPayment | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPayment = useCallback(async () => {
    try {
      const data = await kobApi.get<InterbankPayment>(`interbank/payments/${paymentId}`);
      setPayment(data);
    } catch (err) {
      console.error('[InterbankTracker] Failed to fetch payment:', err);
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  // Initial fetch
  useEffect(() => {
    if (!initialData) fetchPayment();
  }, [fetchPayment, initialData]);

  // Poll every 30s while in active state
  useEffect(() => {
    if (!payment || !ACTIVE_STATES.includes(payment.status)) return;

    const interval = setInterval(fetchPayment, 30_000);
    return () => clearInterval(interval);
  }, [payment?.status, fetchPayment]);

  const handleReturn = async () => {
    setActionLoading('return');
    try {
      await kobApi.post('standards/iso20022/pacs004/generate', {
        original_payment_id: paymentId,
      });
      toast.success('Return payment (pacs.004) generated');
      fetchPayment();
    } catch (err) {
      const msg = err instanceof KOBApiError ? err.problem.detail : 'Failed to generate return';
      toast.error(msg || 'Error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel');
    try {
      await kobApi.post('standards/iso20022/camt056/generate', {
        payment_id: paymentId,
      });
      toast.success('Cancellation request (camt.056) generated');
      fetchPayment();
    } catch (err) {
      const msg = err instanceof KOBApiError ? err.problem.detail : 'Failed to generate cancellation';
      toast.error(msg || 'Error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!payment) return null;

  const currentIdx = SEQUENTIAL_STATES.indexOf(payment.status);
  const isBranch = BRANCH_STATES.includes(payment.status);
  const isTerminal = TERMINAL_STATES.includes(payment.status);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Payment Lifecycle</CardTitle>
          <Badge
            variant={isTerminal && !isBranch ? 'default' : isBranch ? 'destructive' : 'outline'}
            className="text-xs"
          >
            {payment.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Steps */}
        <div className="flex items-center gap-1">
          {SEQUENTIAL_STATES.map((state, idx) => {
            const isCompleted = currentIdx >= idx && !isBranch;
            const isCurrent = currentIdx === idx && !isBranch;
            const timestamp = getStateTimestamp(payment, state);

            return (
              <React.Fragment key={state}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors',
                      isCompleted
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'border-primary bg-background'
                          : 'border-muted-foreground/30 bg-background'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-semibold text-muted-foreground text-center leading-tight">
                    {state.replace('_', ' ')}
                  </span>
                  {timestamp && (
                    <span className="text-[8px] text-muted-foreground/70">
                      {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {idx < SEQUENTIAL_STATES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 rounded-full mt-[-20px]',
                      currentIdx > idx && !isBranch ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Branch State Indicator */}
        {isBranch && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <XCircle className="h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} />
            <div>
              <p className="text-xs font-semibold text-destructive capitalize">{payment.status}</p>
              {(payment.rejection_reason || payment.failure_reason) && (
                <p className="text-xs text-destructive/80 mt-0.5">
                  {payment.rejection_reason || payment.failure_reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {payment.status === 'settled' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturn}
              disabled={actionLoading === 'return'}
              className="flex-1"
            >
              {actionLoading === 'return' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Return Payment
            </Button>
          )}
          {['created', 'validated'].includes(payment.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
              className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              {actionLoading === 'cancel' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              )}
              Cancel Payment
            </Button>
          )}
        </div>

        {/* Active State Polling Indicator */}
        {!isTerminal && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            <span>Auto-refreshing every 30 seconds</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
