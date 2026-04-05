/**
 * useComplianceScreen — Pre-payout compliance screening hook
 * 
 * Calls POST /v1/compliance/screen before every payout
 * Blocks flagged or blocked recipients
 * 
 * Standards: KOB Compliance & AML Screening API
 */

import { useState, useCallback } from 'react';
import { kobApi, KOBApiError } from '@/lib/kob-api-client';

interface ComplianceScreenRequest {
  recipient_name: string;
  recipient_account: string;
  amount: string;
  currency: string;
  channel: string;
}

interface ComplianceScreenResponse {
  status: 'clear' | 'flagged' | 'blocked';
  reason?: string;
  reference_id?: string;
  flagged_lists?: string[];
}

export function useComplianceScreen() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<ComplianceScreenResponse | null>(null);

  /**
   * Screen a recipient before processing a payout
   * Returns the compliance screening result
   */
  const screenRecipient = useCallback(async (params: ComplianceScreenRequest): Promise<ComplianceScreenResponse> => {
    setLoading(true);
    try {
      const result = await kobApi.post<ComplianceScreenResponse>('compliance/screen', params);
      setLastResult(result);
      return result;
    } catch (err) {
      // Compliance screening failure should block the payout for safety
      console.error('[KOB Compliance] Screening API failed:', err);
      const fallback: ComplianceScreenResponse = {
        status: 'flagged',
        reason: 'Compliance screening unavailable. Please try again later.',
      };
      setLastResult(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    screenRecipient,
    loading,
    lastResult,
  };
}
