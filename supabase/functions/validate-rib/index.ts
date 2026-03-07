import { corsHeaders } from "../_shared/cors.ts";

// Cameroon bank directory for enrichment
const CM_BANKS: Record<string, { name: string; swift_bic: string }> = {
  '10005': { name: 'Afriland First Bank', swift_bic: 'AFRIACMCXXX' },
  '10009': { name: 'Atlantic Bank Cameroon (Banque Atlantique)', swift_bic: 'ATCRCMCMXXX' },
  '10017': { name: 'Ecobank Cameroon', swift_bic: 'ECOCCMCXXXX' },
  '10023': { name: 'Standard Chartered Bank Cameroon', swift_bic: 'SCBLCMCXXXX' },
  '10025': { name: 'Citibank N.A. Cameroon', swift_bic: 'CITICMCXXXX' },
  '10029': { name: 'BICEC (Banque Internationale du Cameroun pour l\'Épargne et le Crédit)', swift_bic: 'BICECMCXXXX' },
  '10033': { name: 'Société Générale Cameroun', swift_bic: 'SGCMCMCXXXX' },
  '10038': { name: 'United Bank for Africa (UBA) Cameroon', swift_bic: 'UNAFCMCXXXX' },
  '10039': { name: 'NFC Bank (National Financial Credit)', swift_bic: 'NFBKCMCXXXX' },
  '10041': { name: 'CBC (Commercial Bank of Cameroon)', swift_bic: 'CBCRCMCXXXX' },
  '10050': { name: 'BGFI Bank Cameroon', swift_bic: 'BGFICMCXXXX' },
  '10055': { name: 'CCA Bank (Crédit Communautaire d\'Afrique)', swift_bic: 'CCAICMCXXXX' },
  '10060': { name: 'National Financial Credit Bank', swift_bic: 'NFCBCMCXXXX' },
  '10065': { name: 'Banque Camerounaise des PME (BC-PME)', swift_bic: 'BCPMCMCXXXX' },
  '10070': { name: 'UBC (Union Bank of Cameroon)', swift_bic: 'UBCMCMCXXXX' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rib, country } = await req.json();

    if (!rib) {
      throw new Error('RIB is required');
    }

    console.log('Validating RIB:', rib);

    const result = validateRIB(rib, country || 'CM');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error validating RIB:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function validateRIB(rib: string, country: string): {
  valid: boolean;
  bank_code?: string;
  branch_code?: string;
  account_number?: string;
  rib_key?: string;
  bank_name?: string;
  swift_bic?: string;
  derived_iban?: string;
  formatted_display?: string;
  errors?: string[];
} {
  const errors: string[] = [];

  // Remove spaces and non-digit characters
  const cleanRib = rib.replace(/[\s\-]/g, '');

  if (country.toUpperCase() !== 'CM') {
    errors.push(`RIB validation currently only supports Cameroon (CM). Got: ${country}`);
    return { valid: false, errors };
  }

  // Must be exactly 23 digits
  if (!/^\d{23}$/.test(cleanRib)) {
    errors.push('Cameroon RIB must be exactly 23 digits');
    return { valid: false, errors };
  }

  // Extract structured fields
  const bank_code = cleanRib.substring(0, 5);
  const branch_code = cleanRib.substring(5, 10);
  const account_number = cleanRib.substring(10, 21);
  const rib_key = cleanRib.substring(21, 23);

  // Validate RIB key using MOD-97 algorithm (French/CEMAC standard)
  // Formula: (bank_code * 89 + branch_code * 15 + account_number) mod 97
  // Since account_number can be up to 11 digits, we use chunked modular arithmetic
  const computedKey = computeRibKey(bank_code, branch_code, account_number);
  const expectedKey = computedKey.toString().padStart(2, '0');

  if (rib_key !== expectedKey) {
    errors.push(`Invalid RIB key: expected ${expectedKey}, got ${rib_key}`);
    return { valid: false, bank_code, branch_code, account_number, rib_key, errors };
  }

  // Look up bank info
  const bankInfo = CM_BANKS[bank_code];

  // Derive IBAN: CM + 2 check digits + 23-digit RIB
  const derived_iban = deriveIBAN(cleanRib);

  // Format display: XXXXX-XXXXX-XXXXXXXXXXX-XX
  const formatted_display = `${bank_code}-${branch_code}-${account_number}-${rib_key}`;

  return {
    valid: true,
    bank_code,
    branch_code,
    account_number,
    rib_key,
    bank_name: bankInfo?.name,
    swift_bic: bankInfo?.swift_bic,
    derived_iban,
    formatted_display,
  };
}

function computeRibKey(bankCode: string, branchCode: string, accountNumber: string): number {
  // The standard CEMAC/French RIB key algorithm:
  // key = 97 - ((89 * bank_code + 15 * branch_code + 3 * account_number) mod 97)
  // We use modular arithmetic to avoid BigInt issues with large numbers
  
  const bank = parseInt(bankCode, 10);
  const branch = parseInt(branchCode, 10);
  
  // For the 11-digit account number, compute mod 97 in chunks
  let accountMod = 0;
  for (let i = 0; i < accountNumber.length; i++) {
    accountMod = (accountMod * 10 + parseInt(accountNumber[i], 10)) % 97;
  }
  
  const combined = ((bank % 97) * 89 + (branch % 97) * 15 + accountMod * 3) % 97;
  const key = 97 - combined;
  return key;
}

function deriveIBAN(rib23: string): string {
  // CM IBAN = "CM" + 2 check digits + 23-digit RIB
  // Check digits: 98 - mod97("CM00" + RIB rearranged as numeric)
  // Rearrange: RIB + "CM00", convert letters to numbers (C=12, M=22)
  const rearranged = rib23 + '122200'; // C=12, M=22, 00
  
  // Compute mod 97
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i += 7) {
    const chunk = rearranged.substring(i, i + 7);
    const num = parseInt(remainder.toString() + chunk, 10);
    remainder = num % 97;
  }
  
  const checkDigits = (98 - remainder).toString().padStart(2, '0');
  const iban = `CM${checkDigits}${rib23}`;
  
  // Format with spaces every 4 chars
  return iban.match(/.{1,4}/g)?.join(' ') || iban;
}
