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

    const { xml_content } = await req.json();
    
    // Parse XML
    const parsedData = parseCamt053XML(xml_content);
    
    // Store main message
    const { data: message, error: msgError } = await supabase
      .from('iso20022_messages')
      .insert({
        message_id: parsedData.message_id,
        message_type: 'camt.053',
        message_version: '001.008.08',
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

    // Store account statement
    for (const stmt of parsedData.statements) {
      const { data: statement, error: stmtError } = await supabase
        .from('iso20022_account_statements')
        .insert({
          message_id: message.id,
          statement_id: stmt.statement_id,
          account_iban: stmt.account_iban,
          account_number: stmt.account_number,
          account_currency: stmt.currency,
          statement_date: stmt.statement_date,
          opening_balance: stmt.opening_balance,
          closing_balance: stmt.closing_balance,
          number_of_entries: stmt.entries.length,
          total_credit_entries: stmt.total_credit,
          total_debit_entries: stmt.total_debit
        })
        .select()
        .single();
      
      if (stmtError) {
        console.error('Error storing statement:', stmtError);
        continue;
      }

      // Store entries
      for (const entry of stmt.entries) {
        await supabase.from('iso20022_statement_entries').insert({
          statement_id: statement.id,
          entry_reference: entry.entry_reference,
          amount: entry.amount,
          currency: entry.currency,
          credit_debit_indicator: entry.credit_debit_indicator,
          status: entry.status,
          booking_date: entry.booking_date,
          value_date: entry.value_date,
          debtor_name: entry.debtor_name,
          debtor_account: entry.debtor_account,
          creditor_name: entry.creditor_name,
          creditor_account: entry.creditor_account,
          remittance_information: entry.remittance_information,
          transaction_id: entry.transaction_id,
          end_to_end_id: entry.end_to_end_id
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
    console.error('Error parsing camt.053:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseCamt053XML(xml: string): any {
  // Simplified parser - extract key fields using regex
  
  const extractField = (tag: string): string | null => {
    const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`));
    return match ? match[1] : null;
  };

  const message_id = extractField('MsgId') || `CAMT053-${Date.now()}`;
  const creation_date_time = extractField('CreDtTm') || new Date().toISOString();

  const statements: any[] = [];
  const stmtRegex = /<Stmt>([\s\S]*?)<\/Stmt>/g;
  let stmtMatch;
  
  while ((stmtMatch = stmtRegex.exec(xml)) !== null) {
    const stmtXML = stmtMatch[1];
    
    const stmtId = stmtXML.match(/<Id>([^<]+)<\/Id>/)?.[1] || '';
    const acctIBAN = stmtXML.match(/<Acct>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/)?.[1] || '';
    const acctNum = stmtXML.match(/<Acct>[\s\S]*?<Othr>[\s\S]*?<Id>([^<]+)<\/Id>/)?.[1] || acctIBAN;
    const currency = stmtXML.match(/<Ccy>([^<]+)<\/Ccy>/)?.[1] || 'EUR';
    const stmtDate = stmtXML.match(/<CreDtTm>([^<]+)<\/CreDtTm>/)?.[1]?.split('T')[0] || new Date().toISOString().split('T')[0];
    
    const openBalMatch = stmtXML.match(/<Bal>[\s\S]*?<Tp>[\s\S]*?<CdOrPrtry>[\s\S]*?<Cd>OPBD<\/Cd>[\s\S]*?<\/CdOrPrtry>[\s\S]*?<\/Tp>[\s\S]*?<Amt[^>]*>([^<]+)<\/Amt>/);
    const openBal = parseFloat(openBalMatch?.[1] || '0');
    
    const closeBalMatch = stmtXML.match(/<Bal>[\s\S]*?<Tp>[\s\S]*?<CdOrPrtry>[\s\S]*?<Cd>CLBD<\/Cd>[\s\S]*?<\/CdOrPrtry>[\s\S]*?<\/Tp>[\s\S]*?<Amt[^>]*>([^<]+)<\/Amt>/);
    const closeBal = parseFloat(closeBalMatch?.[1] || '0');

    // Parse entries
    const entries: any[] = [];
    const entryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
    let entryMatch;
    
    while ((entryMatch = entryRegex.exec(stmtXML)) !== null) {
      const entryXML = entryMatch[1];
      
      const amtMatch = entryXML.match(/<Amt Ccy="([^"]+)">([^<]+)<\/Amt>/);
      const amt = parseFloat(amtMatch?.[2] || '0');
      const entryCurrency = amtMatch?.[1] || currency;
      const cdtDbtInd = entryXML.match(/<CdtDbtInd>([^<]+)<\/CdtDbtInd>/)?.[1] || 'CRDT';
      const status = entryXML.match(/<Sts>([^<]+)<\/Sts>/)?.[1] || 'BOOK';
      const bookgDt = entryXML.match(/<BookgDt>[\s\S]*?<Dt>([^<]+)<\/Dt>/)?.[1] || stmtDate;
      const valDt = entryXML.match(/<ValDt>[\s\S]*?<Dt>([^<]+)<\/Dt>/)?.[1] || bookgDt;
      const entryRef = entryXML.match(/<AcctSvcrRef>([^<]+)<\/AcctSvcrRef>/)?.[1] || '';
      
      const dbtrNm = entryXML.match(/<Dbtr>[\s\S]*?<Nm>([^<]+)<\/Nm>/)?.[1] || '';
      const dbtrAcct = entryXML.match(/<DbtrAcct>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/)?.[1] || '';
      const cdtrNm = entryXML.match(/<Cdtr>[\s\S]*?<Nm>([^<]+)<\/Nm>/)?.[1] || '';
      const cdtrAcct = entryXML.match(/<CdtrAcct>[\s\S]*?<IBAN>([^<]+)<\/IBAN>/)?.[1] || '';
      const rmtInf = entryXML.match(/<RmtInf>[\s\S]*?<Ustrd>([^<]+)<\/Ustrd>/)?.[1] || '';
      const endToEndId = entryXML.match(/<EndToEndId>([^<]+)<\/EndToEndId>/)?.[1] || '';
      const txnId = entryXML.match(/<TxId>([^<]+)<\/TxId>/)?.[1] || '';
      
      entries.push({
        entry_reference: entryRef,
        amount: amt,
        currency: entryCurrency,
        credit_debit_indicator: cdtDbtInd,
        status,
        booking_date: bookgDt,
        value_date: valDt,
        debtor_name: dbtrNm,
        debtor_account: dbtrAcct,
        creditor_name: cdtrNm,
        creditor_account: cdtrAcct,
        remittance_information: rmtInf,
        transaction_id: txnId,
        end_to_end_id: endToEndId
      });
    }

    const totalCredit = entries.filter(e => e.credit_debit_indicator === 'CRDT').reduce((sum, e) => sum + e.amount, 0);
    const totalDebit = entries.filter(e => e.credit_debit_indicator === 'DBIT').reduce((sum, e) => sum + e.amount, 0);

    statements.push({
      statement_id: stmtId,
      account_iban: acctIBAN,
      account_number: acctNum,
      currency,
      statement_date: stmtDate,
      opening_balance: openBal,
      closing_balance: closeBal,
      total_credit: totalCredit,
      total_debit: totalDebit,
      entries
    });
  }

  return {
    message_id,
    creation_date_time,
    statements
  };
}
