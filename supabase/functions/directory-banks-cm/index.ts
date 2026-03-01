const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CM_BANKS = [
  { bank_code: '10005', bank_name: 'Afriland First Bank', swift_bic: 'AFRIACMCXXX', supports_rib: true },
  { bank_code: '10009', bank_name: 'Atlantic Bank Cameroon (Banque Atlantique)', swift_bic: 'ATCRCMCMXXX', supports_rib: true },
  { bank_code: '10017', bank_name: 'Ecobank Cameroon', swift_bic: 'ECOCCMCXXXX', supports_rib: true },
  { bank_code: '10023', bank_name: 'Standard Chartered Bank Cameroon', swift_bic: 'SCBLCMCXXXX', supports_rib: true },
  { bank_code: '10025', bank_name: 'Citibank N.A. Cameroon', swift_bic: 'CITICMCXXXX', supports_rib: true },
  { bank_code: '10029', bank_name: 'BICEC (Banque Internationale du Cameroun pour l\'Épargne et le Crédit)', swift_bic: 'BICECMCXXXX', supports_rib: true },
  { bank_code: '10033', bank_name: 'Société Générale Cameroun', swift_bic: 'SGCMCMCXXXX', supports_rib: true },
  { bank_code: '10038', bank_name: 'United Bank for Africa (UBA) Cameroon', swift_bic: 'UNAFCMCXXXX', supports_rib: true },
  { bank_code: '10039', bank_name: 'NFC Bank (National Financial Credit)', swift_bic: 'NFBKCMCXXXX', supports_rib: true },
  { bank_code: '10041', bank_name: 'CBC (Commercial Bank of Cameroon)', swift_bic: 'CBCRCMCXXXX', supports_rib: true },
  { bank_code: '10050', bank_name: 'BGFI Bank Cameroon', swift_bic: 'BGFICMCXXXX', supports_rib: true },
  { bank_code: '10055', bank_name: 'CCA Bank (Crédit Communautaire d\'Afrique)', swift_bic: 'CCAICMCXXXX', supports_rib: true },
  { bank_code: '10060', bank_name: 'National Financial Credit Bank', swift_bic: 'NFCBCMCXXXX', supports_rib: true },
  { bank_code: '10065', bank_name: 'Banque Camerounaise des PME (BC-PME)', swift_bic: 'BCPMCMCXXXX', supports_rib: true },
  { bank_code: '10070', bank_name: 'UBC (Union Bank of Cameroon)', swift_bic: 'UBCMCMCXXXX', supports_rib: true },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({
    country: 'CM',
    country_name: 'Cameroon',
    currency: 'XAF',
    iban_prefix: 'CM',
    iban_length: 27,
    rib_length: 23,
    rib_structure: {
      bank_code: { position: '1-5', length: 5 },
      branch_code: { position: '6-10', length: 5 },
      account_number: { position: '11-21', length: 11 },
      rib_key: { position: '22-23', length: 2 },
    },
    banks: CM_BANKS,
  }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
