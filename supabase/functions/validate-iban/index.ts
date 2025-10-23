const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// IBAN country code lengths (ISO 13616)
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IS: 26, IT: 27,
  JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21,
  MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15,
  PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SE: 24,
  SI: 19, SK: 24, SM: 27, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { iban } = await req.json();

    if (!iban) {
      throw new Error('IBAN is required');
    }

    console.log('Validating IBAN:', iban);

    const result = validateIBAN(iban);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error validating IBAN:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function validateIBAN(iban: string): {
  valid: boolean;
  formatted?: string;
  countryCode?: string;
  checkDigits?: string;
  bban?: string;
  errors?: string[];
} {
  const errors: string[] = [];
  
  // Remove spaces and convert to uppercase
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Check minimum length (15 characters)
  if (cleanIban.length < 15) {
    errors.push('IBAN too short (minimum 15 characters)');
    return { valid: false, errors };
  }
  
  // Check maximum length (34 characters)
  if (cleanIban.length > 34) {
    errors.push('IBAN too long (maximum 34 characters)');
    return { valid: false, errors };
  }
  
  // Extract country code (first 2 characters)
  const countryCode = cleanIban.substring(0, 2);
  
  // Check if country code is valid
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errors.push('Invalid country code format');
    return { valid: false, errors };
  }
  
  // Check if country code is supported
  if (!IBAN_LENGTHS[countryCode]) {
    errors.push(`Country code ${countryCode} not supported or invalid`);
    return { valid: false, countryCode, errors };
  }
  
  // Check length for country
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (cleanIban.length !== expectedLength) {
    errors.push(`Invalid length for ${countryCode} (expected ${expectedLength}, got ${cleanIban.length})`);
    return { valid: false, countryCode, errors };
  }
  
  // Extract check digits (characters 3-4)
  const checkDigits = cleanIban.substring(2, 4);
  
  // Check if check digits are numeric
  if (!/^\d{2}$/.test(checkDigits)) {
    errors.push('Check digits must be numeric');
    return { valid: false, countryCode, checkDigits, errors };
  }
  
  // Extract BBAN (Basic Bank Account Number)
  const bban = cleanIban.substring(4);
  
  // Check if BBAN contains only alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(bban)) {
    errors.push('BBAN must contain only alphanumeric characters');
    return { valid: false, countryCode, checkDigits, bban, errors };
  }
  
  // Perform mod-97 validation
  const rearranged = bban + countryCode + checkDigits;
  const numericString = convertToNumeric(rearranged);
  
  if (!numericString) {
    errors.push('Failed to convert IBAN to numeric format');
    return { valid: false, countryCode, checkDigits, bban, errors };
  }
  
  const remainder = mod97(numericString);
  
  if (remainder !== 1) {
    errors.push('Invalid IBAN checksum (mod-97 check failed)');
    return { valid: false, countryCode, checkDigits, bban, errors };
  }
  
  // Format IBAN with spaces every 4 characters
  const formatted = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
  
  return {
    valid: true,
    formatted,
    countryCode,
    checkDigits,
    bban,
  };
}

function convertToNumeric(alphanumeric: string): string | null {
  let result = '';
  
  for (let i = 0; i < alphanumeric.length; i++) {
    const char = alphanumeric[i];
    
    if (/\d/.test(char)) {
      result += char;
    } else if (/[A-Z]/.test(char)) {
      // A=10, B=11, ..., Z=35
      result += (char.charCodeAt(0) - 55).toString();
    } else {
      return null;
    }
  }
  
  return result;
}

function mod97(numericString: string): number {
  // Process in chunks to avoid number overflow
  let remainder = 0;
  
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = numericString.substring(i, i + 7);
    const num = parseInt(remainder.toString() + chunk, 10);
    remainder = num % 97;
  }
  
  return remainder;
}
