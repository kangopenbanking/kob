/**
 * useBankingWebhookEvents — Banking App webhook event handlers
 * 
 * Handles 15 event types for the Banking/FI App.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { webhookHandler, type WebhookEventPayload } from '@/lib/kob-webhook-handler';

export function useBankingWebhookEvents(institutionId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!institutionId) return;

    const unsubscribers: Array<() => void> = [];

    // Interbank Payment Events
    unsubscribers.push(
      webhookHandler.on('interbank.payment_submitted', () => {
        queryClient.invalidateQueries({ queryKey: ['interbank-payments'] });
      }),
      webhookHandler.on('interbank.payment_completed', () => {
        toast.success('Interbank payment settled');
        queryClient.invalidateQueries({ queryKey: ['interbank-payments'] });
      }),
      webhookHandler.on('interbank.payment_returned', () => {
        toast.warning('Interbank payment returned');
        queryClient.invalidateQueries({ queryKey: ['interbank-payments'] });
      }),
    );

    // PISP Payment Events
    unsubscribers.push(
      webhookHandler.on('payment.authorised', () => {
        queryClient.invalidateQueries({ queryKey: ['pisp-payments'] });
      }),
      webhookHandler.on('payment.completed', () => {
        toast.success('Payment completed');
        queryClient.invalidateQueries({ queryKey: ['pisp-payments'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      }),
    );

    // Consent Events
    unsubscribers.push(
      webhookHandler.on('consent.authorised', () => {
        queryClient.invalidateQueries({ queryKey: ['aisp-consents'] });
      }),
      webhookHandler.on('consent.revoked', () => {
        toast.info('AISP consent revoked');
        queryClient.invalidateQueries({ queryKey: ['aisp-consents'] });
      }),
    );

    // Loan Events
    unsubscribers.push(
      webhookHandler.on('loan.approved', () => {
        toast.success('Loan approved — ready for disbursement');
        queryClient.invalidateQueries({ queryKey: ['loans'] });
      }),
      webhookHandler.on('loan.disbursed', () => {
        toast.success('Loan disbursed — ledger updated');
        queryClient.invalidateQueries({ queryKey: ['loans'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      }),
    );

    // KYC Events
    unsubscribers.push(
      webhookHandler.on('kyc.approved', () => {
        toast.success('Customer KYC approved');
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      webhookHandler.on('kyc.rejected', () => {
        toast.warning('Customer KYC rejected — branch intervention required');
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
    );

    // Pay-by-Bank
    unsubscribers.push(
      webhookHandler.on('pay_by_bank.intent_authorised', () => {
        queryClient.invalidateQueries({ queryKey: ['pay-by-bank'] });
      }),
    );

    // Virtual Account & Escrow
    unsubscribers.push(
      webhookHandler.on('virtual_account.credited', () => {
        toast.success('Virtual account credited');
        queryClient.invalidateQueries({ queryKey: ['virtual-accounts'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      }),
      webhookHandler.on('escrow.funded', () => {
        queryClient.invalidateQueries({ queryKey: ['escrow'] });
      }),
      webhookHandler.on('escrow.released', () => {
        toast.success('Escrow funds released');
        queryClient.invalidateQueries({ queryKey: ['escrow'] });
        queryClient.invalidateQueries({ queryKey: ['ledger'] });
      }),
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [institutionId, queryClient]);
}
