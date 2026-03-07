import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { xml_content } = await req.json();
    
    // Parse XML (simplified - in production use proper XML parser)
    const parsedData = parsePain001XML(xml_content);
    
    // Store main message
    const { data: message, error: msgError } = await supabase
      .from('iso20022_messages')
      .insert({
        message_id: parsedData.message_id,
        message_type: 'pain.001',
        message_version: '001.009.09',
        direction: 'inbound',
        status: 'received',
        raw_xml: xml_content,
        parsed_data: parsedData,
        business_message_id: parsedData.message_id,
        creation_date_time: parsedData.creation_date_time,
        received_at: new Date().toISOString()
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

    // Store payment instructions and credit transfers
    for (const pmtInf of parsedData.payment_informations) {
      const { data: pmtInstruction, error: pmtError } = await supabase
        .from('iso20022_payment_instructions')
        .insert({
          message_id: message.id,
          payment_information_id: pmtInf.payment_information_id,
          payment_method: pmtInf.payment_method,
          batch_booking: pmtInf.batch_booking,
          requested_execution_date: pmtInf.requested_execution_date,
          debtor_name: pmtInf.debtor_name,
          debtor_account: pmtInf.debtor_account,
          debtor_iban: pmtInf.debtor_iban,
          debtor_agent_bic: pmtInf.debtor_agent_bic,
          total_interbank_settlement_amount: pmtInf.total_amount,
          total_interbank_settlement_currency: pmtInf.currency,
          number_of_transactions: pmtInf.number_of_transactions
        })
        .select()
        .single();
      
      if (pmtError) {
        console.error('Error storing payment instruction:', pmtError);
        continue;
      }

      // Store credit transfers
      for (const txn of pmtInf.transactions) {
        await supabase.from('iso20022_credit_transfers').insert({
          payment_instruction_id: pmtInstruction.id,
          message_id: message.id,
          payment_id: txn.payment_id,
          end_to_end_id: txn.end_to_end_id,
          instruction_id: txn.instruction_id,
          amount: txn.amount,
          currency: txn.currency,
          creditor_name: txn.creditor_name,
          creditor_account: txn.creditor_account,
          creditor_iban: txn.creditor_iban,
          creditor_agent_bic: txn.creditor_agent_bic,
          remittance_information: txn.remittance_information,
          status: 'received'
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: message.id,
        parsed: parsedData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error parsing pain.001:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parsePain001XML(xml: string): any {
  // Simplified parser - extract key fields using regex
  // In production, use proper XML parsing library
  
  const extractField = (tag: string): string | null => {
    const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    return match ? match[1] : null;
  };

  const message_id = extractField('MsgId') || `PAIN001-${Date.now()}`;
  const creation_date_time = extractField('CreDtTm') || new Date().toISOString();
  const nb_of_txs = parseInt(extractField('NbOfTxs') || '0');

  // Extract payment information blocks
  const payment_informations: any[] = [];
  const pmtInfRegex = /<PmtInf>([\s\S]*?)<\/PmtInf>/g;
  let pmtInfMatch;
  
  while ((pmtInfMatch = pmtInfRegex.exec(xml)) !== null) {
    const pmtInfXML = pmtInfMatch[1];
    
    const pmtInfId = pmtInfXML.match(/<PmtInfId>([^<]+)<\/PmtInfId>/)?.[1] || '';
    const pmtMtd = pmtInfXML.match(/<PmtMtd>([^<]+)<\/PmtMtd>/)?.[1] || 'TRF';
    const dbtrNm = pmtInfXML.match(/<Dbtr>[\s\S]*?<Nm>([^<]+)<\/Nm>/)?.[1] || '';
    const dbtrAcct = pmtInfXML.match(/<DbtrAcct>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/)?.[1] || '';
    const dbtrAgtBIC = pmtInfXML.match(/<DbtrAgt>[\s\S]*?<BICFI>([^<]+)<\/BICFI>/)?.[1] || '';

    // Extract transactions
    const transactions: any[] = [];
    const txnRegex = /<CdtTrfTxInf>([\s\S]*?)<\/CdtTrfTxInf>/g;
    let txnMatch;
    
    while ((txnMatch = txnRegex.exec(pmtInfXML)) !== null) {
      const txnXML = txnMatch[1];
      
      const endToEndId = txnXML.match(/<EndToEndId>([^<]+)<\/EndToEndId>/)?.[1] || '';
      const instrId = txnXML.match(/<InstrId>([^<]+)<\/InstrId>/)?.[1] || '';
      const amtMatch = txnXML.match(/<InstdAmt Ccy="([^"]+)">([^<]+)<\/InstdAmt>/);
      const currency = amtMatch?.[1] || 'EUR';
      const amount = parseFloat(amtMatch?.[2] || '0');
      const cdtrNm = txnXML.match(/<Cdtr>[\s\S]*?<Nm>([^<]+)<\/Nm>/)?.[1] || '';
      const cdtrAcct = txnXML.match(/<CdtrAcct>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/)?.[1] || '';
      const cdtrAgtBIC = txnXML.match(/<CdtrAgt>[\s\S]*?<BICFI>([^<]+)<\/BICFI>/)?.[1] || '';
      const rmtInf = txnXML.match(/<RmtInf>[\s\S]*?<Ustrd>([^<]+)<\/Ustrd>/)?.[1] || '';
      
      transactions.push({
        payment_id: instrId || endToEndId,
        end_to_end_id: endToEndId,
        instruction_id: instrId,
        amount,
        currency,
        creditor_name: cdtrNm,
        creditor_account: cdtrAcct,
        creditor_iban: cdtrAcct,
        creditor_agent_bic: cdtrAgtBIC,
        remittance_information: rmtInf
      });
    }

    payment_informations.push({
      payment_information_id: pmtInfId,
      payment_method: pmtMtd,
      batch_booking: false,
      requested_execution_date: new Date().toISOString().split('T')[0],
      debtor_name: dbtrNm,
      debtor_account: dbtrAcct,
      debtor_iban: dbtrAcct,
      debtor_agent_bic: dbtrAgtBIC,
      total_amount: transactions.reduce((sum, t) => sum + t.amount, 0),
      currency: transactions[0]?.currency || 'EUR',
      number_of_transactions: transactions.length,
      transactions
    });
  }

  return {
    message_id,
    creation_date_time,
    number_of_transactions: nb_of_txs,
    payment_informations
  };
}
