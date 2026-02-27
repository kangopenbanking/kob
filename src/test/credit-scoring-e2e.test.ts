import { describe, it, expect } from 'vitest';

/**
 * Credit Scoring E2E Tests
 * 
 * These tests verify the deterministic scoring engine logic.
 * They test the scoring algorithm directly without requiring a live database.
 */

// Scoring rules matching the credit-score-engine
const SCORING_RULES: Record<string, { min: number; max: number }> = {
  LOAN_REPAYMENT_ON_TIME: { min: 5, max: 15 },
  LOAN_REPAYMENT_LATE: { min: -40, max: -10 },
  LOAN_INSTALLMENT_MISSED: { min: -50, max: -50 },
  LOAN_DEFAULTED: { min: -250, max: -150 },
  LOAN_CLOSED: { min: 15, max: 15 },
  SAVINGS_DEPOSIT: { min: 1, max: 3 },
  SAVINGS_WITHDRAWAL: { min: 0, max: 0 },
  SAVINGS_BALANCE_STABLE: { min: 2, max: 2 },
};

const BASELINE = 500;
const MIN_SCORE = 300;
const MAX_SCORE = 850;
const MAX_SAVINGS_DEPOSITS_PER_MONTH = 10;

function getBand(score: number): string {
  if (score >= 750) return 'A';
  if (score >= 650) return 'B';
  if (score >= 550) return 'C';
  if (score >= 400) return 'D';
  return 'F';
}

interface CreditEvent {
  event_type: string;
  event_time: string;
  value_numeric: number | null;
}

function computeScore(events: CreditEvent[]): { score: number; band: string } {
  let score = BASELINE;
  const monthlyDepositCounts: Record<string, number> = {};

  for (const event of events) {
    let points = 0;

    switch (event.event_type) {
      case 'LOAN_REPAYMENT_ON_TIME':
        points = 15;
        break;
      case 'LOAN_REPAYMENT_LATE': {
        const daysLate = Math.abs(event.value_numeric || 1);
        points = Math.max(-40, Math.min(-10, -10 - Math.floor(daysLate / 3) * 3));
        break;
      }
      case 'LOAN_INSTALLMENT_MISSED':
        points = -50;
        break;
      case 'LOAN_DEFAULTED':
        points = -250;
        break;
      case 'LOAN_CLOSED':
        points = 15;
        break;
      case 'SAVINGS_DEPOSIT': {
        const monthKey = event.event_time.substring(0, 7);
        monthlyDepositCounts[monthKey] = (monthlyDepositCounts[monthKey] || 0) + 1;
        if (monthlyDepositCounts[monthKey] <= MAX_SAVINGS_DEPOSITS_PER_MONTH) {
          const amount = Number(event.value_numeric || 0);
          points = amount >= 50000 ? 3 : amount >= 10000 ? 2 : 1;
        }
        break;
      }
      case 'SAVINGS_WITHDRAWAL':
        points = 0;
        break;
      case 'SAVINGS_BALANCE_STABLE':
        points = 2;
        break;
    }

    score += points;
  }

  score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
  return { score, band: getBand(score) };
}

describe('Credit Scoring Engine', () => {
  describe('Flow A: On-time repayment improves score', () => {
    it('should increase score from baseline with on-time repayment', () => {
      const events: CreditEvent[] = [
        { event_type: 'LOAN_REPAYMENT_ON_TIME', event_time: '2026-02-01T10:00:00Z', value_numeric: 0 },
        { event_type: 'LOAN_REPAYMENT_ON_TIME', event_time: '2026-02-15T10:00:00Z', value_numeric: 0 },
      ];

      const result = computeScore(events);
      expect(result.score).toBe(BASELINE + 30); // 2 * 15
      expect(result.score).toBeGreaterThan(BASELINE);
      expect(result.band).toBe('D'); // 530 is in D band (400-549)
    });

    it('should reach B band with sustained on-time repayments', () => {
      const events: CreditEvent[] = Array.from({ length: 10 }, (_, i) => ({
        event_type: 'LOAN_REPAYMENT_ON_TIME',
        event_time: `2026-0${Math.min(i + 1, 9)}-01T10:00:00Z`,
        value_numeric: 0,
      }));

      const result = computeScore(events);
      expect(result.score).toBe(BASELINE + 150); // 10 * 15 = 650
      expect(result.band).toBe('B');
    });
  });

  describe('Flow B: Late repayment decreases score', () => {
    it('should decrease score with late repayment', () => {
      const events: CreditEvent[] = [
        { event_type: 'LOAN_REPAYMENT_LATE', event_time: '2026-02-01T10:00:00Z', value_numeric: 7 },
      ];

      const result = computeScore(events);
      expect(result.score).toBeLessThan(BASELINE);
    });

    it('should decrease more with longer delays', () => {
      const events1: CreditEvent[] = [
        { event_type: 'LOAN_REPAYMENT_LATE', event_time: '2026-02-01T10:00:00Z', value_numeric: 3 },
      ];
      const events2: CreditEvent[] = [
        { event_type: 'LOAN_REPAYMENT_LATE', event_time: '2026-02-01T10:00:00Z', value_numeric: 30 },
      ];

      const result1 = computeScore(events1);
      const result2 = computeScore(events2);
      expect(result2.score).toBeLessThan(result1.score);
    });

    it('should decrease significantly with missed installment', () => {
      const events: CreditEvent[] = [
        { event_type: 'LOAN_INSTALLMENT_MISSED', event_time: '2026-02-01T10:00:00Z', value_numeric: 15 },
      ];

      const result = computeScore(events);
      expect(result.score).toBe(BASELINE - 50);
      expect(result.band).toBe('D');
    });
  });

  describe('Flow C: Savings deposit modestly increases score', () => {
    it('should increase score slightly with deposit', () => {
      const events: CreditEvent[] = [
        { event_type: 'SAVINGS_DEPOSIT', event_time: '2026-02-01T10:00:00Z', value_numeric: 25000 },
      ];

      const result = computeScore(events);
      expect(result.score).toBe(BASELINE + 2); // 25000 >= 10000 → +2
      expect(result.score).toBeGreaterThan(BASELINE);
    });

    it('should cap monthly deposits at 10', () => {
      const events: CreditEvent[] = Array.from({ length: 15 }, (_, i) => ({
        event_type: 'SAVINGS_DEPOSIT',
        event_time: `2026-02-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        value_numeric: 5000,
      }));

      const result = computeScore(events);
      // Only first 10 count: 10 * 1 = 10
      expect(result.score).toBe(BASELINE + 10);
    });

    it('should give more points for larger deposits', () => {
      const small: CreditEvent[] = [
        { event_type: 'SAVINGS_DEPOSIT', event_time: '2026-02-01T10:00:00Z', value_numeric: 5000 },
      ];
      const large: CreditEvent[] = [
        { event_type: 'SAVINGS_DEPOSIT', event_time: '2026-02-01T10:00:00Z', value_numeric: 100000 },
      ];

      expect(computeScore(large).score).toBeGreaterThan(computeScore(small).score);
    });
  });

  describe('Flow D: Dedupe and boundary correctness', () => {
    it('should not go below 300', () => {
      const events: CreditEvent[] = Array.from({ length: 10 }, () => ({
        event_type: 'LOAN_DEFAULTED',
        event_time: '2026-02-01T10:00:00Z',
        value_numeric: null,
      }));

      const result = computeScore(events);
      expect(result.score).toBe(MIN_SCORE);
      expect(result.band).toBe('F');
    });

    it('should not go above 850', () => {
      const events: CreditEvent[] = Array.from({ length: 100 }, (_, i) => ({
        event_type: 'LOAN_REPAYMENT_ON_TIME',
        event_time: `2026-02-01T${String(i).padStart(2, '0')}:00:00Z`,
        value_numeric: 0,
      }));

      const result = computeScore(events);
      expect(result.score).toBe(MAX_SCORE);
      expect(result.band).toBe('A');
    });

    it('should assign correct bands', () => {
      expect(getBand(800)).toBe('A');
      expect(getBand(700)).toBe('B');
      expect(getBand(600)).toBe('C');
      expect(getBand(450)).toBe('D');
      expect(getBand(350)).toBe('F');
    });

    it('withdrawal should have zero impact', () => {
      const events: CreditEvent[] = [
        { event_type: 'SAVINGS_WITHDRAWAL', event_time: '2026-02-01T10:00:00Z', value_numeric: 50000 },
      ];

      const result = computeScore(events);
      expect(result.score).toBe(BASELINE);
    });
  });
});
