import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

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
      payment_id,
      debtor_name,
      debtor_iban,
      debtor_bic,
      creditor_name,
      creditor_iban,
      creditor_bic,
      amount,
      currency,
      remittance_information,
      end_to_end_id
    } = await req.json();
    
    // Generate pacs.008 XML
    const msgId = `PACS008-${Date.now()}`;
    const creDtTm = new Date().toISOString();
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>${end_to_end_id}</EndToEndId>
        <TxId>${payment_id}</TxId>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${currency}">${amount}</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr>
        <Nm>${debtor_name}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${debtor_iban}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BICFI>${debtor_bic}</BICFI>
        </FinInstnId>
      </DbtrAgt>
      <CdtrAgt>
        <FinInstnId>
          <BICFI>${creditor_bic}</BICFI>
        </FinInstnId>
      </CdtrAgt>
      <Cdtr>
        <Nm>${creditor_name}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${creditor_iban}</IBAN>
        </Id>
      </CdtrAcct>
      <RmtInf>
        <Ustrd>${remittance_information}</Ustrd>
      </RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
    
    // Store message
    const { data: message, error: msgError } = await supabase
      .from('iso20022_messages')
      .insert({
        message_id: msgId,
        message_type: 'pacs.008',
        message_version: '001.008.08',
        direction: 'outbound',
        status: 'pending',
        raw_xml: xml,
        parsed_data: { payment_id, amount, currency, end_to_end_id },
        business_message_id: msgId,
        creation_date_time: creDtTm,
        debtor_name,
        debtor_iban,
        creditor_name,
        creditor_iban,
        amount,
        currency,
        end_to_end_id
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
        xml 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error generating pacs.008:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
