import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      original_message_id,
      transaction_id,
      end_to_end_id,
      status_code,
      status_reason
    } = await req.json();
    
    // Generate pacs.002 XML
    const msgId = `PACS002-${Date.now()}`;
    const creDtTm = new Date().toISOString();
    
    // Status codes: ACCP (Accepted), RJCT (Rejected), PDNG (Pending)
    const statusElement = status_code === 'ACCP' 
      ? `<AccptncDtTm>${creDtTm}</AccptncDtTm>`
      : status_code === 'RJCT'
      ? `<StsRsnInf><Rsn><Cd>${status_reason || 'NARR'}</Cd></Rsn></StsRsnInf>`
      : '';
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>${original_message_id}</OrgnlMsgId>
      <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
      <GrpSts>${status_code}</GrpSts>
    </OrgnlGrpInfAndSts>
    <TxInfAndSts>
      <OrgnlEndToEndId>${end_to_end_id}</OrgnlEndToEndId>
      <OrgnlTxId>${transaction_id}</OrgnlTxId>
      <TxSts>${status_code}</TxSts>
      ${statusElement}
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>`;
    
    // Store message
    const { data: message, error: msgError } = await supabase
      .from('iso20022_messages')
      .insert({
        message_id: msgId,
        message_type: 'pacs.002',
        message_version: '001.010.10',
        direction: 'outbound',
        status: 'sent',
        raw_xml: xml,
        parsed_data: { 
          original_message_id, 
          transaction_id, 
          end_to_end_id, 
          status_code, 
          status_reason 
        },
        business_message_id: msgId,
        creation_date_time: creDtTm,
        related_message_id: original_message_id,
        sent_at: creDtTm
      })
      .select()
      .single();
    
    if (msgError) {
      console.error('Error storing message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to store message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: message.id,
        iso_message_id: msgId,
        status: status_code,
        xml 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error generating pacs.002:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
