import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface EnforcedLimits {
  min_amount: number;
  max_amount: number;
  daily_limit: number;
  monthly_limit: number;
  max_charge_cap?: number;
}

export function validateAmountRange(amount: number, limits?: EnforcedLimits): string | null {
  if (!limits) return null;

  if (limits.min_amount > 0 && amount < limits.min_amount) {
    return `Amount is below minimum limit of ${limits.min_amount}`;
  }

  if (limits.max_amount > 0 && amount > limits.max_amount) {
    return `Amount exceeds maximum limit of ${limits.max_amount}`;
  }

  return null;
}

interface UsageSumParams {
  supabase: ReturnType<typeof createClient>;
  table: string;
  amountColumn?: string;
  dateColumn?: string;
  filters?: Record<string, string | number | boolean | null>;
  statuses?: string[];
  period: 'day' | 'month';
}

export async function sumUsageForPeriod({
  supabase,
  table,
  amountColumn = 'amount',
  dateColumn = 'created_at',
  filters = {},
  statuses,
  period,
}: UsageSumParams): Promise<number> {
  const start = new Date();
  if (period === 'day') {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  let query = supabase
    .from(table)
    .select(`${amountColumn}, status`)
    .gte(dateColumn, start.toISOString());

  for (const [key, value] of Object.entries(filters)) {
    query = value === null ? query.is(key, null) : query.eq(key, value as any);
  }

  if (statuses && statuses.length > 0) {
    query = query.in('status', statuses as any);
  }

  const { data, error } = await query;
  if (error || !data) return 0;

  return data.reduce((sum: number, row: Record<string, unknown>) => {
    return sum + Number(row[amountColumn] || 0);
  }, 0);
}
