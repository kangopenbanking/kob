/**
 * useConsumerWebhookEvents — Consumer App webhook event handlers
 * 
 * Handles 17 event types for the Consumer App via the webhook event bus.
 * Refreshes queries, shows toasts, and manages UI state on events.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { webhookHandler, type WebhookEventPayload } from '@/lib/kob-webhook-handler';

export function useConsumerWebhookEvents(userId?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;

    const unsubscribers: Array<() => void> = [];

    // KYC Events
    unsubscribers.push(
      webhookHandler.on('kyc.submitted', () => {
        toast.info('Documents received, under review');
      }),
      webhookHandler.on('kyc.approved', () => {
        toast.success('KYC verification approved! Welcome to Kang.');
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        navigate('/app/home');
      }),
      webhookHandler.on('kyc.rejected', (payload: WebhookEventPayload) => {
        const reason = (payload.data as any)?.rejection_reason || 'Please resubmit your documents';
        toast.error(`KYC rejected: ${reason}`);
      }),
    );

    // Loan Events
    unsubscribers.push(
      webhookHandler.on('loan.approved', () => {
        toast.success('Your loan application has been approved!');
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      }),
      webhookHandler.on('loan.disbursed', () => {
        toast.success('Loan disbursed to your wallet');
        queryClient.invalidateQueries({ queryKey: ['wallets'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      }),
      webhookHandler.on('loan.defaulted', () => {
        toast.error('Urgent: Your loan requires immediate attention');
      }),
    );

    // Payment Events
    unsubscribers.push(
      webhookHandler.on('payment.completed', () => {
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }),
      webhookHandler.on('payment.rejected', (payload: WebhookEventPayload) => {
        const reason = (payload.data as any)?.reason || 'Payment was rejected';
        toast.error(`Payment rejected: ${reason}`);
      }),
    );

    // Mobile Money Events
    unsubscribers.push(
      webhookHandler.on('mobile_money.charge_completed', () => {
        toast.success('Mobile money transfer completed');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }),
      webhookHandler.on('mobile_money.charge_failed', (payload: WebhookEventPayload) => {
        const reason = (payload.data as any)?.failure_reason || 'Transfer failed';
        toast.error(`Mobile money failed: ${reason}`);
      }),
    );

    // Consent Events
    unsubscribers.push(
      webhookHandler.on('consent.expired', () => {
        toast.warning('Account access has expired. Please re-authorize.');
        queryClient.invalidateQueries({ queryKey: ['linked-accounts'] });
      }),
      webhookHandler.on('consent.revoked', () => {
        toast.info('Account access has been revoked');
        queryClient.invalidateQueries({ queryKey: ['linked-accounts'] });
      }),
    );

    // Other Events
    unsubscribers.push(
      webhookHandler.on('escrow.released', () => {
        toast.success('Escrow funds have been released');
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      }),
      webhookHandler.on('subscription.renewed', () => {
        toast.success('Your subscription has been renewed');
      }),
      webhookHandler.on('subscription.payment_failed', () => {
        toast.error('Subscription payment failed. Please update your payment method.');
      }),
      webhookHandler.on('pay_by_bank.payment_completed', () => {
        toast.success('Payment completed successfully');
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      }),
      webhookHandler.on('pay_by_bank.intent_rejected', () => {
        toast.error('Payment authorization was rejected');
        navigate('/app/home');
      }),
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [userId, queryClient, navigate]);
}
