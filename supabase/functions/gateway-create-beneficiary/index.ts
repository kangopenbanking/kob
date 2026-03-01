import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cameroon bank directory for enrichment
const CM_BANKS: Record<string, { name: string; swift_bic: string }> = {
  '10005': { name: 'Afriland First Bank', swift_bic: 'AFRIACMCXXX' },
  '10009': { name: 'Atlantic Bank Cameroon (Banque Atlantique)', swift_bic: 'ATCRCMCMXXX' },
  '10017': { name: 'Ecobank Cameroon', swift_bic: 'ECOCCMCXXXX' },
  '10023': { name: 'Standard Chartered Bank Cameroon', swift_bic: 'SCBLCMCXXXX' },
  '10025': { name: 'Citibank N.A. Cameroon', swift_bic: 'CITICMCXXXX' },
  '10029': { name: 'BICEC (Banque Internationale du Cameroun)', swift_bic: 'BICECMCXXXX' },
  '10033': { name: 'Société Générale Cameroun', swift_bic: 'SGCMCMCXXXX' },
  '10038': { name: 'United Bank for Africa (UBA) Cameroon', swift_bic: 'UNAFCMCXXXX' },
  '10039': { name: 'NFC Bank', swift_bic: 'NFBKCMCXXXX' },
  '10041': { name: 'CBC (Commercial Bank of Cameroon)', swift_bic: 'CBCRCMCXXXX' },
  '10050': { name: 'BGFI Bank Cameroon', swift_bic: 'BGFICMCXXXX' },
  '10055': { name: 'CCA Bank', swift_bic: 'CCAICMCXXXX' },
  '10060': { name: 'National Financial Credit Bank', swift_bic: 'NFCBCMCXXXX' },
  '10065': { name: 'Banque Camerounaise des PME (BC-PME)', swift_bic: 'BCPMCMCXXXX' },
  '10070': { name: 'UBC (Union Bank of Cameroon)', swift_bic: 'UBCMCMCXXXX' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, name, channel = 'mobile_money', account_number, bank_code, bank_name, phone, email, metadata, account_identifier } = body;

    if (!merchant_id || !name) return new Response(JSON.stringify({ error: 'merchant_id and name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Build enriched metadata from account_identifier if provided
    let enrichedMetadata = metadata || {};
    let resolvedBankCode = bank_code;
    let resolvedBankName = bank_name;

    if (account_identifier) {
      const { type, country, value } = account_identifier;

      if (type === 'DOMESTIC_RIB') {
        const cleanRib = (value || '').replace(/[\s\-]/g, '');
        if (!/^\d{23}$/.test(cleanRib)) {
          return new Response(JSON.stringify({ error: 'invalid_rib', message: 'Cameroon RIB must be exactly 23 digits' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const ribBankCode = cleanRib.substring(0, 5);
        const ribBranchCode = cleanRib.substring(5, 10);
        const ribAccountNumber = cleanRib.substring(10, 21);
        const ribKey = cleanRib.substring(21, 23);
        const bankInfo = CM_BANKS[ribBankCode];

        resolvedBankCode = resolvedBankCode || ribBankCode;
        resolvedBankName = resolvedBankName || bankInfo?.name;

        enrichedMetadata = {
          ...enrichedMetadata,
          account_identifier_type: 'DOMESTIC_RIB',
          account_identifier_country: country || 'CM',
          account_identifier_value: cleanRib,
          rib_bank_code: ribBankCode,
          rib_branch_code: ribBranchCode,
          rib_account_number: ribAccountNumber,
          rib_key: ribKey,
          swift_bic: bankInfo?.swift_bic,
          display: `${ribBankCode}-${ribBranchCode}-${ribAccountNumber}-${ribKey}`,
          rail: 'DOMESTIC',
        };
      } else if (type === 'IBAN') {
        const cleanIban = (value || '').replace(/\s/g, '').toUpperCase();
        if (cleanIban.length < 15 || cleanIban.length > 34) {
          return new Response(JSON.stringify({ error: 'invalid_iban', message: 'IBAN must be between 15 and 34 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const ibanDisplay = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
        enrichedMetadata = {
          ...enrichedMetadata,
          account_identifier_type: 'IBAN',
          account_identifier_country: cleanIban.substring(0, 2),
          account_identifier_value: cleanIban,
          display: ibanDisplay,
          rail: 'INTERNATIONAL',
        };
      }
    }

    const { data: beneficiary, error } = await supabase.from('gateway_beneficiaries').insert({
      merchant_id, name, channel, account_number, bank_code: resolvedBankCode, bank_name: resolvedBankName, phone, email, metadata: enrichedMetadata,
    }).select().single();

    if (error) throw error;
    return new Response(JSON.stringify(beneficiary), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
