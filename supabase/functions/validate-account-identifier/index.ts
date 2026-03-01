const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// IBAN country code lengths (from validate-iban)
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CM: 27, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18,
  DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22,
  GI: 23, GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20,
  LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18,
  NO: 15, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24,
  SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24,
  XK: 20,
};

type IdentifierType = 'DOMESTIC_RIB' | 'IBAN' | 'LOCAL_BANK' | 'MOMO';
type Rail = 'DOMESTIC' | 'INTERNATIONAL' | 'LOCAL';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, country, value } = await req.json();

    if (!type || !value) {
      throw new Error('type and value are required');
    }

    const result = validateAccountIdentifier(type as IdentifierType, value, country || 'CM');

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error validating account identifier:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function validateAccountIdentifier(type: IdentifierType, value: string, country: string): {
  valid: boolean;
  identifier_type: IdentifierType;
  rail: Rail;
  normalized_value?: string;
  display?: string;
  country?: string;
  errors?: string[];
} {
  switch (type) {
    case 'DOMESTIC_RIB':
      return validateDomesticRib(value, country);
    case 'IBAN':
      return validateIban(value);
    case 'LOCAL_BANK':
    case 'MOMO':
      return {
        valid: true,
        identifier_type: type,
        rail: 'LOCAL',
        normalized_value: value.trim(),
        display: value.trim(),
        country,
      };
    default:
      return {
        valid: false,
        identifier_type: type,
        rail: 'LOCAL',
        errors: [`Unsupported identifier type: ${type}`],
      };
  }
}

function validateDomesticRib(value: string, country: string): {
  valid: boolean;
  identifier_type: IdentifierType;
  rail: Rail;
  normalized_value?: string;
  display?: string;
  country?: string;
  errors?: string[];
} {
  const clean = value.replace(/[\s\-]/g, '');
  
  if (country.toUpperCase() !== 'CM') {
    return { valid: false, identifier_type: 'DOMESTIC_RIB', rail: 'DOMESTIC', errors: ['DOMESTIC_RIB only supported for CM'] };
  }

  if (!/^\d{23}$/.test(clean)) {
    return { valid: false, identifier_type: 'DOMESTIC_RIB', rail: 'DOMESTIC', errors: ['Cameroon RIB must be exactly 23 digits'] };
  }

  // Format: XXXXX-XXXXX-XXXXXXXXXXX-XX
  const display = `${clean.substring(0, 5)}-${clean.substring(5, 10)}-${clean.substring(10, 21)}-${clean.substring(21, 23)}`;

  return {
    valid: true,
    identifier_type: 'DOMESTIC_RIB',
    rail: 'DOMESTIC',
    normalized_value: clean,
    display,
    country: 'CM',
  };
}

function validateIban(value: string): {
  valid: boolean;
  identifier_type: IdentifierType;
  rail: Rail;
  normalized_value?: string;
  display?: string;
  country?: string;
  errors?: string[];
} {
  const clean = value.replace(/\s/g, '').toUpperCase();

  if (clean.length < 15 || clean.length > 34) {
    return { valid: false, identifier_type: 'IBAN', rail: 'INTERNATIONAL', errors: ['IBAN must be between 15 and 34 characters'] };
  }

  const countryCode = clean.substring(0, 2);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { valid: false, identifier_type: 'IBAN', rail: 'INTERNATIONAL', errors: ['Invalid country code'] };
  }

  const expected = IBAN_LENGTHS[countryCode];
  if (expected && clean.length !== expected) {
    return { valid: false, identifier_type: 'IBAN', rail: 'INTERNATIONAL', errors: [`Invalid length for ${countryCode}: expected ${expected}, got ${clean.length}`] };
  }

  // MOD-97 check
  const bban = clean.substring(4);
  const checkDigits = clean.substring(2, 4);
  const rearranged = bban + countryCode + checkDigits;

  let numericStr = '';
  for (const ch of rearranged) {
    if (/\d/.test(ch)) numericStr += ch;
    else if (/[A-Z]/.test(ch)) numericStr += (ch.charCodeAt(0) - 55).toString();
    else return { valid: false, identifier_type: 'IBAN', rail: 'INTERNATIONAL', errors: ['Invalid characters in IBAN'] };
  }

  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const chunk = numericStr.substring(i, i + 7);
    remainder = parseInt(remainder.toString() + chunk, 10) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, identifier_type: 'IBAN', rail: 'INTERNATIONAL', errors: ['Invalid IBAN checksum'] };
  }

  const display = clean.match(/.{1,4}/g)?.join(' ') || clean;

  return {
    valid: true,
    identifier_type: 'IBAN',
    rail: 'INTERNATIONAL',
    normalized_value: clean,
    display,
    country: countryCode,
  };
}
