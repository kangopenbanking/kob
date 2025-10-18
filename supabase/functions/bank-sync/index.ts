import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { bank_connection_id } = await req.json();

    if (!bank_connection_id) {
      return new Response(JSON.stringify({ error: 'Bank connection ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch bank connection details
    const { data: connection, error: connError } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('id', bank_connection_id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'Bank connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting sync for bank: ${connection.bank_name}`);

    // Update sync status to in progress
    await supabase.rpc('update_bank_sync_status', {
      _connection_id: bank_connection_id,
      _status: 'in_progress',
      _error_message: null
    });

    // Process based on connection type
    let syncResult;
    
    switch (connection.connection_type) {
      case 'REST_API':
        syncResult = await syncRestAPI(connection, supabase);
        break;
      case 'SFTP':
        syncResult = await syncSFTP(connection, supabase);
        break;
      case 'H2H':
        syncResult = await syncH2H(connection, supabase);
        break;
      default:
        throw new Error(`Unsupported connection type: ${connection.connection_type}`);
    }

    // Update sync status to success
    await supabase.rpc('update_bank_sync_status', {
      _connection_id: bank_connection_id,
      _status: 'success',
      _error_message: null
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Bank sync completed successfully',
      result: syncResult
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Bank sync error:', error);
    
    // Update sync status to failed if bank_connection_id is available
    const { bank_connection_id } = await req.json().catch(() => ({}));
    if (bank_connection_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase.rpc('update_bank_sync_status', {
        _connection_id: bank_connection_id,
        _status: 'failed',
        _error_message: error.message
      });
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// REST API sync handler
async function syncRestAPI(connection: any, supabase: any) {
  console.log('Syncing via REST API...');
  
  // Extract API credentials from connection_config
  const config = connection.connection_config;
  const baseUrl = connection.base_url;
  
  // Make API call to fetch transactions
  const response = await fetch(`${baseUrl}/transactions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    records_fetched: data.transactions?.length || 0,
    sync_method: 'REST_API'
  };
}

// SFTP sync handler
async function syncSFTP(connection: any, supabase: any) {
  console.log('Syncing via SFTP...');
  
  // In production, this would use an SFTP client library
  // For now, return a placeholder
  
  return {
    records_fetched: 0,
    sync_method: 'SFTP',
    note: 'SFTP integration requires additional configuration'
  };
}

// H2H (Host-to-Host) sync handler
async function syncH2H(connection: any, supabase: any) {
  console.log('Syncing via H2H...');
  
  // H2H typically involves direct file transfer or API calls
  // Implementation depends on specific bank protocols
  
  return {
    records_fetched: 0,
    sync_method: 'H2H',
    note: 'H2H integration requires bank-specific configuration'
  };
}
