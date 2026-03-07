import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

interface MT940Entry {
  valueDate: string;
  entryDate?: string;
  dcIndicator: string;
  fundsCode?: string;
  amount: number;
  transactionType: string;
  reference: string;
  accountServicingRef?: string;
  supplementaryDetails?: string;
  transactionDescription?: string;
}

interface MT940Data {
  transactionReference: string;
  accountIdentification: string;
  statementNumber: string;
  sequenceNumber?: string;
  openingBalance: {
    indicator: string;
    date: string;
    currency: string;
    amount: number;
  };
  closingBalance: {
    indicator: string;
    date: string;
    currency: string;
    amount: number;
  };
  closingAvailableBalance?: {
    date: string;
    currency: string;
    amount: number;
  };
  forwardAvailableBalance?: {
    date: string;
    currency: string;
    amount: number;
  };
  entries: MT940Entry[];
  informationToAccountOwner?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mt940Content, institutionId } = await req.json();

    if (!mt940Content) {
      throw new Error('MT940 content is required');
    }

    console.log('Parsing MT940 statement...');

    const mt940Data = parseMT940(mt940Content);

    // Store in database
    const { data: swiftMessage, error: messageError } = await supabaseClient
      .from('swift_messages')
      .insert({
        institution_id: institutionId,
        message_type: 'MT940',
        direction: 'inbound',
        message_content: mt940Content,
        parsed_data: mt940Data,
        transaction_reference: mt940Data.transactionReference,
        currency: mt940Data.openingBalance.currency,
        status: 'validated',
        created_by: user.id,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Store MT940 statement
    const { data: statement, error: statementError } = await supabaseClient
      .from('swift_mt940_statements')
      .insert({
        swift_message_id: swiftMessage.id,
        transaction_reference: mt940Data.transactionReference,
        account_identification: mt940Data.accountIdentification,
        statement_number: mt940Data.statementNumber,
        sequence_number: mt940Data.sequenceNumber,
        opening_balance: mt940Data.openingBalance.amount,
        opening_balance_date: mt940Data.openingBalance.date,
        opening_balance_currency: mt940Data.openingBalance.currency,
        opening_balance_dc_indicator: mt940Data.openingBalance.indicator,
        closing_balance: mt940Data.closingBalance.amount,
        closing_balance_date: mt940Data.closingBalance.date,
        closing_balance_currency: mt940Data.closingBalance.currency,
        closing_balance_dc_indicator: mt940Data.closingBalance.indicator,
        closing_available_balance: mt940Data.closingAvailableBalance?.amount,
        closing_available_balance_date: mt940Data.closingAvailableBalance?.date,
        forward_available_balance: mt940Data.forwardAvailableBalance?.amount,
        forward_available_balance_date: mt940Data.forwardAvailableBalance?.date,
        information_to_account_owner: mt940Data.informationToAccountOwner,
      })
      .select()
      .single();

    if (statementError) throw statementError;

    // Store statement entries
    const entryInserts = mt940Data.entries.map((entry) => ({
      mt940_statement_id: statement.id,
      value_date: entry.valueDate,
      entry_date: entry.entryDate,
      dc_indicator: entry.dcIndicator,
      funds_code: entry.fundsCode,
      amount: entry.amount,
      transaction_type: entry.transactionType,
      reference: entry.reference,
      account_servicing_ref: entry.accountServicingRef,
      supplementary_details: entry.supplementaryDetails,
      transaction_description: entry.transactionDescription,
    }));

    const { error: entriesError } = await supabaseClient
      .from('swift_mt940_entries')
      .insert(entryInserts);

    if (entriesError) throw entriesError;

    console.log('MT940 parsed and stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MT940 parsed successfully',
        data: { swiftMessage, statement, mt940Data },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error parsing MT940:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseMT940(content: string): MT940Data {
  const data: Partial<MT940Data> = { entries: [] };

  // Field 20: Transaction Reference
  const field20 = content.match(/:20:(.*?)(?=\n:|$)/s);
  data.transactionReference = field20 ? field20[1].trim() : '';

  // Field 25: Account Identification
  const field25 = content.match(/:25:(.*?)(?=\n:|$)/s);
  data.accountIdentification = field25 ? field25[1].trim() : '';

  // Field 28C: Statement Number/Sequence Number
  const field28C = content.match(/:28C:(.*?)(?=\n:|$)/s);
  if (field28C) {
    const parts = field28C[1].trim().split('/');
    data.statementNumber = parts[0];
    data.sequenceNumber = parts[1];
  }

  // Field 60F: Opening Balance
  const field60F = content.match(/:60F:([CD])(\d{6})([A-Z]{3})([\d,\.]+)(?=\n:|$)/);
  if (field60F) {
    data.openingBalance = {
      indicator: field60F[1],
      date: parseSwiftDate(field60F[2]),
      currency: field60F[3],
      amount: parseFloat(field60F[4].replace(/,/g, '')),
    };
  }

  // Field 62F: Closing Balance
  const field62F = content.match(/:62F:([CD])(\d{6})([A-Z]{3})([\d,\.]+)(?=\n:|$)/);
  if (field62F) {
    data.closingBalance = {
      indicator: field62F[1],
      date: parseSwiftDate(field62F[2]),
      currency: field62F[3],
      amount: parseFloat(field62F[4].replace(/,/g, '')),
    };
  }

  // Field 64: Closing Available Balance
  const field64 = content.match(/:64:([CD])(\d{6})([A-Z]{3})([\d,\.]+)(?=\n:|$)/);
  if (field64) {
    data.closingAvailableBalance = {
      date: parseSwiftDate(field64[2]),
      currency: field64[3],
      amount: parseFloat(field64[4].replace(/,/g, '')),
    };
  }

  // Field 65: Forward Available Balance
  const field65 = content.match(/:65:([CD])(\d{6})([A-Z]{3})([\d,\.]+)(?=\n:|$)/);
  if (field65) {
    data.forwardAvailableBalance = {
      date: parseSwiftDate(field65[2]),
      currency: field65[3],
      amount: parseFloat(field65[4].replace(/,/g, '')),
    };
  }

  // Field 61: Statement Line (entries)
  const field61Regex = /:61:(\d{6})(\d{4})?([CD]|R[CD])([A-Z])?(\d+,\d+)([A-Z]{4})([^\n]+)(?:\n:86:([^\n:]+))?/g;
  let match;
  while ((match = field61Regex.exec(content)) !== null) {
    const entry: MT940Entry = {
      valueDate: parseSwiftDate(match[1]),
      entryDate: match[2] ? parseSwiftDate(match[1].substring(0, 2) + match[2]) : undefined,
      dcIndicator: match[3],
      fundsCode: match[4],
      amount: parseFloat(match[5].replace(/,/g, '')),
      transactionType: match[6],
      reference: match[7].trim(),
      transactionDescription: match[8] ? match[8].trim() : undefined,
    };
    data.entries!.push(entry);
  }

  // Field 86: Information to Account Owner
  const field86 = content.match(/:86:(.*?)(?=\n:|$)/s);
  data.informationToAccountOwner = field86 ? field86[1].trim() : undefined;

  return data as MT940Data;
}

function parseSwiftDate(swiftDate: string): string {
  // YYMMDD format
  const year = '20' + swiftDate.substring(0, 2);
  const month = swiftDate.substring(2, 4);
  const day = swiftDate.substring(4, 6);
  return `${year}-${month}-${day}`;
}
