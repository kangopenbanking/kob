/**
 * useRiskScore — Pre-charge risk scoring hook
 * 
 * Calls POST /v1/gateway/risk/score before every charge
 * Implements fail-open on API error (with warning logged)
 * 
 * Standards: KOB Gateway Risk Assessment API
 */

import { useState, useCallback } from 'react';
import { kobApi, KOBApiError } from '@/lib/kob-api-client';

interface RiskScoreRequest {
  amount: string;
  currency: string;
  channel: string;
  customer_id?: string;
  merchant_id?: string;
}

interface RiskScoreResponse {
  action: 'allow' | 'flag_for_review' | 'block';
  score: number;
  reason?: string;
  risk_factors?: string[];
}

export function useRiskScore() {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<RiskScoreResponse | null>(null);

  /**
   * Check risk score before processing a charge
   * Returns the risk assessment action
   * Implements fail-open: if the risk API fails, returns 'allow' with a console warning
   */
  const checkRisk = useCallback(async (params: RiskScoreRequest): Promise<RiskScoreResponse> => {
    setLoading(true);
    try {
      const result = await kobApi.post<RiskScoreResponse>('gateway/risk/score', params);
      setLastResult(result);
      return result;
    } catch (err) {
      // Fail-open: allow charge to proceed with warning
      console.warn('[KOB Risk] Risk scoring API failed, proceeding with fail-open:', err);
      const fallback: RiskScoreResponse = {
        action: 'allow',
        score: -1,
        reason: 'Risk scoring unavailable — fail-open applied',
      };
      setLastResult(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    checkRisk,
    loading,
    lastResult,
  };
}
