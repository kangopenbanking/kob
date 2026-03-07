import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

import { corsHeaders } from "../_shared/cors.ts";

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

    const { paymentData, institutionId } = await req.json();

    console.log('Generating MT103 message...');

    const mt103Message = generateMT103(paymentData);

    // Store in database
    const { data: swiftMessage, error: messageError } = await supabaseClient
      .from('swift_messages')
      .insert({
        institution_id: institutionId,
        message_type: 'MT103',
        direction: 'outbound',
        message_content: mt103Message,
        parsed_data: paymentData,
        sender_bic: paymentData.senderBic,
        receiver_bic: paymentData.receiverBic,
        transaction_reference: paymentData.transactionReference,
        value_date: paymentData.valueDate,
        currency: paymentData.currency,
        amount: paymentData.amount,
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
        transaction_reference: paymentData.transactionReference,
        related_reference: paymentData.relatedReference,
        bank_operation_code: paymentData.bankOperationCode || 'CRED',
        value_date: paymentData.valueDate,
        currency: paymentData.currency,
        amount: paymentData.amount,
        ordering_customer: paymentData.orderingCustomer,
        ordering_institution: paymentData.orderingInstitution,
        beneficiary_customer: paymentData.beneficiaryCustomer,
        beneficiary_institution: paymentData.beneficiaryInstitution,
        remittance_info: paymentData.remittanceInfo,
        details_of_charges: paymentData.detailsOfCharges || 'SHA',
        sender_to_receiver_info: paymentData.senderToReceiverInfo,
      });

    if (paymentError) throw paymentError;

    console.log('MT103 generated and stored successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MT103 generated successfully',
        mt103Message,
        swiftMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error generating MT103:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generateMT103(data: any): string {
  const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(2, 14);
  
  // Block 1: Basic Header
  const block1 = `{1:F01${data.senderBic}0000000000}`;
  
  // Block 2: Application Header (Output)
  const block2 = `{2:O1030800${timestamp}${data.receiverBic}0000000000${timestamp}N}`;
  
  // Block 3: User Header (optional)
  const block3 = `{3:{108:${data.transactionReference}}}`;
  
  // Block 4: Text Block
  let block4 = `{4:\n`;
  
  // Field 20: Transaction Reference (mandatory)
  block4 += `:20:${data.transactionReference}\n`;
  
  // Field 21: Related Reference (optional)
  if (data.relatedReference) {
    block4 += `:21:${data.relatedReference}\n`;
  }
  
  // Field 23B: Bank Operation Code (optional)
  block4 += `:23B:${data.bankOperationCode || 'CRED'}\n`;
  
  // Field 32A: Value Date, Currency, Amount (mandatory)
  const valueDate = formatSwiftDate(data.valueDate);
  const amount = formatAmount(data.amount);
  block4 += `:32A:${valueDate}${data.currency}${amount}\n`;
  
  // Field 50K: Ordering Customer (mandatory)
  block4 += `:50K:`;
  if (data.orderingCustomer.account) {
    block4 += `/${data.orderingCustomer.account}\n`;
  }
  block4 += `${data.orderingCustomer.name}\n`;
  if (data.orderingCustomer.address) {
    block4 += data.orderingCustomer.address.join('\n') + '\n';
  }
  
  // Field 52A: Ordering Institution (optional)
  if (data.orderingInstitution?.bic) {
    block4 += `:52A:${data.orderingInstitution.bic}\n`;
  }
  
  // Field 57A: Account With Institution (optional)
  if (data.beneficiaryInstitution?.bic) {
    block4 += `:57A:${data.beneficiaryInstitution.bic}\n`;
  }
  
  // Field 59: Beneficiary Customer (mandatory)
  block4 += `:59:`;
  if (data.beneficiaryCustomer.account) {
    block4 += `/${data.beneficiaryCustomer.account}\n`;
  }
  block4 += `${data.beneficiaryCustomer.name}\n`;
  if (data.beneficiaryCustomer.address) {
    block4 += data.beneficiaryCustomer.address.join('\n') + '\n';
  }
  
  // Field 70: Remittance Information (optional)
  if (data.remittanceInfo) {
    block4 += `:70:${data.remittanceInfo}\n`;
  }
  
  // Field 71A: Details of Charges (mandatory)
  block4 += `:71A:${data.detailsOfCharges || 'SHA'}\n`;
  
  // Field 72: Sender to Receiver Information (optional)
  if (data.senderToReceiverInfo) {
    block4 += `:72:${data.senderToReceiverInfo}\n`;
  }
  
  block4 += `-}`;
  
  // Block 5: Trailer (checksum - simplified)
  const block5 = `{5:{CHK:000000000000}}`;
  
  return block1 + block2 + block3 + block4 + block5;
}

function formatSwiftDate(dateString: string): string {
  // Convert YYYY-MM-DD to YYMMDD
  const date = new Date(dateString);
  const yy = date.getFullYear().toString().substring(2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return yy + mm + dd;
}

function formatAmount(amount: number): string {
  // Format amount with comma as decimal separator and no thousands separator
  return amount.toFixed(2).replace('.', ',');
}
