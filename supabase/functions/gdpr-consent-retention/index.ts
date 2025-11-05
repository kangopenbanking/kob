import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupResult {
  deleted_count: number;
  retention_period_days: number;
  cutoff_date: string;
  execution_time_ms: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('Starting GDPR consent_events data retention cleanup...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate cutoff date (2 years ago)
    const retentionDays = 730; // 2 years = 730 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString();

    console.log(`Deleting consent_events older than: ${cutoffDateStr}`);

    // First, count how many records will be deleted
    const { count: recordsToDelete, error: countError } = await supabase
      .from('consent_events')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDateStr);

    if (countError) {
      console.error('Error counting records:', countError);
      throw countError;
    }

    console.log(`Found ${recordsToDelete} records to delete`);

    // Delete old consent events
    // Note: This uses RLS policies, so it will only delete what the service role is allowed to delete
    const { error: deleteError, count: deletedCount } = await supabase
      .from('consent_events')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDateStr);

    if (deleteError) {
      console.error('Error deleting records:', deleteError);
      throw deleteError;
    }

    const executionTime = Date.now() - startTime;

    const result: CleanupResult = {
      deleted_count: deletedCount || 0,
      retention_period_days: retentionDays,
      cutoff_date: cutoffDateStr,
      execution_time_ms: executionTime,
    };

    console.log('Cleanup completed successfully:', result);

    // Log the cleanup event to audit logs for compliance tracking
    await supabase.rpc('log_audit_event', {
      _action_type: 'gdpr_data_retention',
      _entity_type: 'consent_events',
      _entity_id: null,
      _details: {
        deleted_count: result.deleted_count,
        retention_period_days: retentionDays,
        cutoff_date: cutoffDateStr,
        execution_time_ms: executionTime,
        automated: true,
      },
    }).catch(err => {
      console.error('Error logging audit event:', err);
      // Don't fail the cleanup if audit logging fails
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully deleted ${result.deleted_count} consent events older than 2 years`,
        data: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('GDPR data retention cleanup failed:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to execute GDPR data retention cleanup',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
