/**
 * useMerchantWebhookEvents — Business App webhook event handlers
 * 
 * Handles 17 event types for the Business/Merchant App.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { webhookHandler, type WebhookEventPayload } from '@/lib/kob-webhook-handler';

export function useMerchantWebhookEvents(merchantId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!merchantId) return;

    const unsubscribers: Array<() => void> = [];

    // Charge Events
    unsubscribers.push(
      webhookHandler.on('charge.created', () => {
        queryClient.invalidateQueries({ queryKey: ['charges'] });
      }),
      webhookHandler.on('charge.captured', () => {
        toast.success('Payment captured successfully');
        queryClient.invalidateQueries({ queryKey: ['charges'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      }),
      webhookHandler.on('charge.failed', (payload: WebhookEventPayload) => {
        const ref = (payload.data as any)?.tx_ref || '';
        toast.error(`Charge failed${ref ? `: ${ref}` : ''}`);
      }),
      webhookHandler.on('charge.cancelled', () => {
        queryClient.invalidateQueries({ queryKey: ['charges'] });
      }),
    );

    // Refund Events
    unsubscribers.push(
      webhookHandler.on('refund.created', () => {
        queryClient.invalidateQueries({ queryKey: ['refunds'] });
      }),
      webhookHandler.on('refund.processed', () => {
        toast.success('Refund processed successfully');
        queryClient.invalidateQueries({ queryKey: ['refunds'] });
        queryClient.invalidateQueries({ queryKey: ['settlements'] });
      }),
    );

    // Payout Events
    unsubscribers.push(
      webhookHandler.on('payout.completed', () => {
        toast.success('Payout completed');
        queryClient.invalidateQueries({ queryKey: ['payouts'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      }),
      webhookHandler.on('payout.failed', () => {
        toast.error('Payout failed. You can retry from the Payouts page.');
        queryClient.invalidateQueries({ queryKey: ['payouts'] });
      }),
    );

    // Dispute Events
    unsubscribers.push(
      webhookHandler.on('dispute.created', () => {
        toast.error('New dispute filed! Evidence required.');
        queryClient.invalidateQueries({ queryKey: ['disputes'] });
      }),
      webhookHandler.on('dispute.evidence_required', (payload: WebhookEventPayload) => {
        const dueBy = (payload.data as any)?.evidence_due_by;
        toast.warning(`Evidence required${dueBy ? ` by ${new Date(dueBy).toLocaleDateString()}` : ''}`);
      }),
      webhookHandler.on('dispute.resolved', (payload: WebhookEventPayload) => {
        const outcome = (payload.data as any)?.outcome || 'resolved';
        toast.info(`Dispute ${outcome}`);
        queryClient.invalidateQueries({ queryKey: ['disputes'] });
      }),
    );

    // Settlement Events
    unsubscribers.push(
      webhookHandler.on('settlement.created', () => {
        toast.info('New settlement scheduled');
        queryClient.invalidateQueries({ queryKey: ['settlements'] });
      }),
      webhookHandler.on('settlement.processed', () => {
        toast.success('Settlement processed');
        queryClient.invalidateQueries({ queryKey: ['settlements'] });
      }),
    );

    // Subscription Events
    unsubscribers.push(
      webhookHandler.on('subscription.created', () => {
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      }),
      webhookHandler.on('subscription.cancelled', () => {
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      }),
      webhookHandler.on('subscription.payment_failed', () => {
        toast.warning('Customer subscription payment failed');
      }),
    );

    // KYC
    unsubscribers.push(
      webhookHandler.on('kyc.approved', () => {
        toast.success('KYB verification approved! Full features unlocked.');
        queryClient.invalidateQueries({ queryKey: ['merchant-profile'] });
      }),
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [merchantId, queryClient]);
}
