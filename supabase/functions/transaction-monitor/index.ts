import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonitoringRule {
  rule_id: string;
  rule_name: string;
  alert_type: string;
  threshold: number;
  severity: string;
}

const MONITORING_RULES: MonitoringRule[] = [
  { rule_id: 'VEL001', rule_name: 'High Velocity Transactions', alert_type: 'velocity', threshold: 10, severity: 'high' },
  { rule_id: 'AMT001', rule_name: 'Large Transaction Amount', alert_type: 'amount_threshold', threshold: 1000000, severity: 'high' },
  { rule_id: 'PAT001', rule_name: 'Unusual Pattern Detected', alert_type: 'pattern_anomaly', threshold: 0, severity: 'medium' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      transaction_id,
      user_id,
      amount,
      transaction_type,
      transaction_data
    } = await req.json();

    const alerts = [];

    // Rule 1: Check velocity (transactions per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentTxCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', oneHourAgo.toISOString());

    if (recentTxCount && recentTxCount >= 10) {
      alerts.push({
        transaction_id,
        user_id,
        alert_type: 'velocity',
        severity: 'high',
        rule_id: 'VEL001',
        rule_name: 'High Velocity Transactions',
        alert_description: `${recentTxCount} transactions in the last hour`,
        transaction_details: transaction_data,
        risk_indicators: { transaction_count: recentTxCount, time_window: '1 hour' }
      });
    }

    // Rule 2: Check amount threshold
    if (amount > 1000000) {
      alerts.push({
        transaction_id,
        user_id,
        alert_type: 'amount_threshold',
        severity: amount > 5000000 ? 'critical' : 'high',
        rule_id: 'AMT001',
        rule_name: 'Large Transaction Amount',
        alert_description: `Transaction amount ${amount} exceeds threshold`,
        transaction_details: transaction_data,
        risk_indicators: { amount, threshold: 1000000 }
      });
    }

    // Rule 3: Pattern anomaly (simplified - check for round amounts which can indicate structuring)
    if (amount % 1000000 === 0 && amount > 1000000) {
      alerts.push({
        transaction_id,
        user_id,
        alert_type: 'pattern_anomaly',
        severity: 'medium',
        rule_id: 'PAT001',
        rule_name: 'Suspicious Pattern - Round Amount',
        alert_description: 'Transaction with suspiciously round amount',
        transaction_details: transaction_data,
        risk_indicators: { amount, pattern: 'round_amount' }
      });
    }

    // Insert alerts into database
    if (alerts.length > 0) {
      const { error: alertError } = await supabase
        .from('transaction_monitoring_alerts')
        .insert(alerts);

      if (alertError) {
        console.error('Error creating alerts:', alertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_generated: alerts.length,
        alerts: alerts.map(a => ({ 
          type: a.alert_type, 
          severity: a.severity, 
          description: a.alert_description 
        }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in transaction-monitor:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
