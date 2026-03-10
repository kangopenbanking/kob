// Consolidated router for ISO 20022 and SWIFT messaging
// Actions: camt053-parse, pacs002-generate, pacs008-generate, pain001-parse, mt103-generate, mt103-parse, mt940-parse
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    if (!action) return new Response(JSON.stringify({ error: 'action parameter required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Auth check (all actions require auth)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // For user-context operations (MT103, MT940)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

    switch (action) {
      case 'camt053-parse': return handleCamt053(supabase, params);
      case 'pacs002-generate': return handlePacs002(supabase, params);
      case 'pacs008-generate': return handlePacs008(supabase, params);
      case 'pain001-parse': return handlePain001(supabase, params);
      case 'mt103-generate': return handleMt103Generate(userClient, user, params);
      case 'mt103-parse': return handleMt103Parse(userClient, user, params);
      case 'mt940-parse': return handleMt940Parse(userClient, user, params);
      default: return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error: any) {
    console.error('iso-messaging error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// ── camt.053 parser ──
async function handleCamt053(supabase: any, params: any) {
  const { xml_content } = params;
  const extractField = (xml: string, tag: string): string | null => { const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return match ? match[1] : null; };

  const message_id = extractField(xml_content, 'MsgId') || `CAMT053-${Date.now()}`;
  const creation_date_time = extractField(xml_content, 'CreDtTm') || new Date().toISOString();

  const { data: message, error: msgError } = await supabase.from('iso20022_messages').insert({ message_id, message_type: 'camt.053', message_version: '001.008.08', direction: 'inbound', status: 'received', raw_xml: xml_content, parsed_data: { message_id, creation_date_time, statements: [] }, business_message_id: message_id, creation_date_time, received_at: new Date().toISOString() }).select().single();
  if (msgError) return new Response(JSON.stringify({ error: 'Failed to store message' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ success: true, message_id: message.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── pacs.002 generator ──
async function handlePacs002(supabase: any, params: any) {
  const { original_message_id, transaction_id, end_to_end_id, status_code, status_reason } = params;
  const msgId = `PACS002-${Date.now()}`;
  const creDtTm = new Date().toISOString();
  const statusElement = status_code === 'ACCP' ? `<AccptncDtTm>${creDtTm}</AccptncDtTm>` : status_code === 'RJCT' ? `<StsRsnInf><Rsn><Cd>${status_reason || 'NARR'}</Cd></Rsn></StsRsnInf>` : '';

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10"><FIToFIPmtStsRpt><GrpHdr><MsgId>${msgId}</MsgId><CreDtTm>${creDtTm}</CreDtTm></GrpHdr><OrgnlGrpInfAndSts><OrgnlMsgId>${original_message_id}</OrgnlMsgId><OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId><GrpSts>${status_code}</GrpSts></OrgnlGrpInfAndSts><TxInfAndSts><OrgnlEndToEndId>${end_to_end_id}</OrgnlEndToEndId><OrgnlTxId>${transaction_id}</OrgnlTxId><TxSts>${status_code}</TxSts>${statusElement}</TxInfAndSts></FIToFIPmtStsRpt></Document>`;

  const { data: message, error: msgError } = await supabase.from('iso20022_messages').insert({ message_id: msgId, message_type: 'pacs.002', message_version: '001.010.10', direction: 'outbound', status: 'sent', raw_xml: xml, parsed_data: { original_message_id, transaction_id, end_to_end_id, status_code, status_reason }, business_message_id: msgId, creation_date_time: creDtTm, related_message_id: original_message_id, sent_at: creDtTm }).select().single();
  if (msgError) return new Response(JSON.stringify({ error: 'Failed to store message' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ success: true, message_id: message.id, iso_message_id: msgId, status: status_code, xml }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── pacs.008 generator ──
async function handlePacs008(supabase: any, params: any) {
  const { payment_id, debtor_name, debtor_iban, debtor_bic, creditor_name, creditor_iban, creditor_bic, amount, currency, remittance_information, end_to_end_id } = params;
  const msgId = `PACS008-${Date.now()}`;
  const creDtTm = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"><FIToFICstmrCdtTrf><GrpHdr><MsgId>${msgId}</MsgId><CreDtTm>${creDtTm}</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr><CdtTrfTxInf><PmtId><EndToEndId>${end_to_end_id}</EndToEndId><TxId>${payment_id}</TxId></PmtId><IntrBkSttlmAmt Ccy="${currency}">${amount}</IntrBkSttlmAmt><ChrgBr>SHAR</ChrgBr><Dbtr><Nm>${debtor_name}</Nm></Dbtr><DbtrAcct><Id><IBAN>${debtor_iban}</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId><BICFI>${debtor_bic}</BICFI></FinInstnId></DbtrAgt><CdtrAgt><FinInstnId><BICFI>${creditor_bic}</BICFI></FinInstnId></CdtrAgt><Cdtr><Nm>${creditor_name}</Nm></Cdtr><CdtrAcct><Id><IBAN>${creditor_iban}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${remittance_information}</Ustrd></RmtInf></CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`;

  const { data: message, error: msgError } = await supabase.from('iso20022_messages').insert({ message_id: msgId, message_type: 'pacs.008', message_version: '001.008.08', direction: 'outbound', status: 'pending', raw_xml: xml, parsed_data: { payment_id, amount, currency, end_to_end_id }, business_message_id: msgId, creation_date_time: creDtTm, debtor_name, debtor_iban, creditor_name, creditor_iban, amount, currency, end_to_end_id }).select().single();
  if (msgError) return new Response(JSON.stringify({ error: 'Failed to store message' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ success: true, message_id: message.id, iso_message_id: msgId, xml }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── pain.001 parser ──
async function handlePain001(supabase: any, params: any) {
  const { xml_content } = params;
  const extractField = (xml: string, tag: string): string | null => { const match = xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`)); return match ? match[1] : null; };
  const message_id = extractField(xml_content, 'MsgId') || `PAIN001-${Date.now()}`;
  const creation_date_time = extractField(xml_content, 'CreDtTm') || new Date().toISOString();

  const { data: message, error: msgError } = await supabase.from('iso20022_messages').insert({ message_id, message_type: 'pain.001', message_version: '001.009.09', direction: 'inbound', status: 'received', raw_xml: xml_content, parsed_data: { message_id, creation_date_time, payment_informations: [] }, business_message_id: message_id, creation_date_time, received_at: new Date().toISOString() }).select().single();
  if (msgError) return new Response(JSON.stringify({ error: 'Failed to store message' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify({ success: true, message_id: message.id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── MT103 generate ──
async function handleMt103Generate(supabase: any, user: any, params: any) {
  const { paymentData, institutionId } = params;
  const mt103Message = `{1:F01${paymentData.senderBic}0000000000}{2:O103${paymentData.receiverBic}}{4::20:${paymentData.transactionReference}:32A:${paymentData.valueDate}${paymentData.currency}${paymentData.amount}-}`;

  const { data: swiftMessage, error } = await supabase.from('swift_messages').insert({ institution_id: institutionId, message_type: 'MT103', direction: 'outbound', message_content: mt103Message, parsed_data: paymentData, sender_bic: paymentData.senderBic, receiver_bic: paymentData.receiverBic, transaction_reference: paymentData.transactionReference, value_date: paymentData.valueDate, currency: paymentData.currency, amount: paymentData.amount, status: 'validated', created_by: user.id }).select().single();
  if (error) throw error;

  await supabase.from('swift_mt103_payments').insert({ swift_message_id: swiftMessage.id, transaction_reference: paymentData.transactionReference, related_reference: paymentData.relatedReference, bank_operation_code: paymentData.bankOperationCode || 'CRED', value_date: paymentData.valueDate, currency: paymentData.currency, amount: paymentData.amount, ordering_customer: paymentData.orderingCustomer, ordering_institution: paymentData.orderingInstitution, beneficiary_customer: paymentData.beneficiaryCustomer, beneficiary_institution: paymentData.beneficiaryInstitution, remittance_info: paymentData.remittanceInfo, details_of_charges: paymentData.detailsOfCharges || 'SHA', sender_to_receiver_info: paymentData.senderToReceiverInfo });

  return new Response(JSON.stringify({ success: true, message: 'MT103 generated successfully', mt103Message, swiftMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── MT103 parse ──
async function handleMt103Parse(supabase: any, user: any, params: any) {
  const { mt103Content, institutionId } = params;
  if (!mt103Content) throw new Error('MT103 content is required');

  const { data: swiftMessage, error } = await supabase.from('swift_messages').insert({ institution_id: institutionId, message_type: 'MT103', direction: 'inbound', message_content: mt103Content, parsed_data: { raw: true }, status: 'validated', created_by: user.id }).select().single();
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, message: 'MT103 parsed successfully', data: { swiftMessage } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ── MT940 parse ──
async function handleMt940Parse(supabase: any, user: any, params: any) {
  const { mt940Content, institutionId } = params;
  if (!mt940Content) throw new Error('MT940 content is required');

  const { data: swiftMessage, error } = await supabase.from('swift_messages').insert({ institution_id: institutionId, message_type: 'MT940', direction: 'inbound', message_content: mt940Content, parsed_data: { raw: true }, status: 'validated', created_by: user.id }).select().single();
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, message: 'MT940 parsed successfully', data: { swiftMessage } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}