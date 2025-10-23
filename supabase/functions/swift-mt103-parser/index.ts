import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MT103Data {
  transactionReference: string;
  relatedReference?: string;
  bankOperationCode?: string;
  valueDate: string;
  currency: string;
  amount: number;
  orderingCustomer: {
    account?: string;
    name: string;
    address?: string[];
  };
  orderingInstitution?: {
    bic?: string;
    name?: string;
  };
  beneficiaryCustomer: {
    account?: string;
    name: string;
    address?: string[];
  };
  beneficiaryInstitution?: {
    bic?: string;
    name?: string;
  };
  remittanceInfo?: string;
  detailsOfCharges?: string;
  senderToReceiverInfo?: string;
  senderBic?: string;
  receiverBic?: string;
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

    const { mt103Content, institutionId } = await req.json();

    if (!mt103Content) {
      throw new Error('MT103 content is required');
    }

    console.log('Parsing MT103 message...');

    // Parse MT103 blocks
    const blocks = parseMT103Blocks(mt103Content);
    const mt103Data = parseMT103Fields(blocks.block4);

    // Extract BICs from blocks 1 and 2
    const senderBic = extractSenderBic(blocks.block1, blocks.block2);
    const receiverBic = extractReceiverBic(blocks.block2);

    mt103Data.senderBic = senderBic;
    mt103Data.receiverBic = receiverBic;

    // Store in database
    const { data: swiftMessage, error: messageError } = await supabaseClient
      .from('swift_messages')
      .insert({
        institution_id: institutionId,
        message_type: 'MT103',
        direction: 'inbound',
        message_content: mt103Content,
        parsed_data: mt103Data,
        sender_bic: senderBic,
        receiver_bic: receiverBic,
        transaction_reference: mt103Data.transactionReference,
        value_date: mt103Data.valueDate,
        currency: mt103Data.currency,
        amount: mt103Data.amount,
        status: 'validated',
        created_by: user.id,
      })
      .select()
      .single();

    if (messageError) throw messageError;

    // Store MT103 payment details
    const { error: paymentError } = await supabaseClient
      .from('swift_mt103_payments')
      .insert({
        swift_message_id: swiftMessage.id,
        transaction_reference: mt103Data.transactionReference,
        related_reference: mt103Data.relatedReference,
        bank_operation_code: mt103Data.bankOperationCode,
        value_date: mt103Data.valueDate,
        currency: mt103Data.currency,
        amount: mt103Data.amount,
        ordering_customer: mt103Data.orderingCustomer,
        ordering_institution: mt103Data.orderingInstitution,
        beneficiary_customer: mt103Data.beneficiaryCustomer,
        beneficiary_institution: mt103Data.beneficiaryInstitution,
        remittance_info: mt103Data.remittanceInfo,
        details_of_charges: mt103Data.detailsOfCharges,
        sender_to_receiver_info: mt103Data.senderToReceiverInfo,
      });

    if (paymentError) throw paymentError;

    console.log('MT103 parsed and stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MT103 parsed successfully',
        data: { swiftMessage, mt103Data },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error parsing MT103:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseMT103Blocks(content: string) {
  const block1Match = content.match(/\{1:(.*?)\}/);
  const block2Match = content.match(/\{2:(.*?)\}/);
  const block3Match = content.match(/\{3:(.*?)\}/);
  const block4Match = content.match(/\{4:\s*(.*?)\s*-\}/s);
  const block5Match = content.match(/\{5:(.*?)\}/);

  return {
    block1: block1Match ? block1Match[1] : '',
    block2: block2Match ? block2Match[1] : '',
    block3: block3Match ? block3Match[1] : '',
    block4: block4Match ? block4Match[1] : '',
    block5: block5Match ? block5Match[1] : '',
  };
}

function extractSenderBic(block1: string, block2: string): string {
  // Block 1 format: F01BANKUS33AXXX0000000000
  const block1Match = block1.match(/[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?/);
  if (block1Match) return block1Match[0];

  // Try block 2 if block 1 fails
  const block2Match = block2.match(/[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?/);
  return block2Match ? block2Match[0] : '';
}

function extractReceiverBic(block2: string): string {
  // Block 2 Output format: O1030800230123BANKGB22XXXX
  const match = block2.match(/[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?/);
  return match ? match[0] : '';
}

function parseMT103Fields(block4: string): MT103Data {
  const data: Partial<MT103Data> = {};

  // Field 20: Transaction Reference (mandatory)
  const field20 = block4.match(/:20:(.*?)(?=\n:|$)/s);
  data.transactionReference = field20 ? field20[1].trim() : '';

  // Field 21: Related Reference
  const field21 = block4.match(/:21:(.*?)(?=\n:|$)/s);
  data.relatedReference = field21 ? field21[1].trim() : undefined;

  // Field 23B: Bank Operation Code
  const field23B = block4.match(/:23B:(.*?)(?=\n:|$)/s);
  data.bankOperationCode = field23B ? field23B[1].trim() : undefined;

  // Field 32A: Value Date, Currency, Amount (mandatory)
  const field32A = block4.match(/:32A:(\d{6})([A-Z]{3})([\d,\.]+)(?=\n:|$)/s);
  if (field32A) {
    data.valueDate = parseSwiftDate(field32A[1]);
    data.currency = field32A[2];
    data.amount = parseFloat(field32A[3].replace(/,/g, ''));
  }

  // Field 50K: Ordering Customer (mandatory)
  const field50K = block4.match(/:50K:(.*?)(?=\n:|$)/s);
  if (field50K) {
    const lines = field50K[1].trim().split('\n');
    const account = lines[0].startsWith('/') ? lines[0].substring(1) : undefined;
    data.orderingCustomer = {
      account,
      name: account ? lines[1] : lines[0],
      address: account ? lines.slice(2) : lines.slice(1),
    };
  }

  // Field 52A/D: Ordering Institution
  const field52 = block4.match(/:52[AD]:(.*?)(?=\n:|$)/s);
  if (field52) {
    const content = field52[1].trim();
    const bicMatch = content.match(/([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?)/);
    data.orderingInstitution = {
      bic: bicMatch ? bicMatch[0] : undefined,
      name: content.split('\n')[0],
    };
  }

  // Field 59: Beneficiary Customer (mandatory)
  const field59 = block4.match(/:59:(.*?)(?=\n:|$)/s);
  if (field59) {
    const lines = field59[1].trim().split('\n');
    const account = lines[0].startsWith('/') ? lines[0].substring(1) : undefined;
    data.beneficiaryCustomer = {
      account,
      name: account ? lines[1] : lines[0],
      address: account ? lines.slice(2) : lines.slice(1),
    };
  }

  // Field 57A/D: Beneficiary Institution
  const field57 = block4.match(/:57[AD]:(.*?)(?=\n:|$)/s);
  if (field57) {
    const content = field57[1].trim();
    const bicMatch = content.match(/([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?)/);
    data.beneficiaryInstitution = {
      bic: bicMatch ? bicMatch[0] : undefined,
      name: content.split('\n')[0],
    };
  }

  // Field 70: Remittance Information
  const field70 = block4.match(/:70:(.*?)(?=\n:|$)/s);
  data.remittanceInfo = field70 ? field70[1].trim() : undefined;

  // Field 71A: Details of Charges
  const field71A = block4.match(/:71A:(.*?)(?=\n:|$)/s);
  data.detailsOfCharges = field71A ? field71A[1].trim() : undefined;

  // Field 72: Sender to Receiver Information
  const field72 = block4.match(/:72:(.*?)(?=\n:|$)/s);
  data.senderToReceiverInfo = field72 ? field72[1].trim() : undefined;

  return data as MT103Data;
}

function parseSwiftDate(swiftDate: string): string {
  // YYMMDD format
  const year = '20' + swiftDate.substring(0, 2);
  const month = swiftDate.substring(2, 4);
  const day = swiftDate.substring(4, 6);
  return `${year}-${month}-${day}`;
}
