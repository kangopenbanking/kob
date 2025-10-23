const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bic } = await req.json();

    if (!bic) {
      throw new Error('BIC is required');
    }

    console.log('Validating BIC:', bic);

    const result = validateBIC(bic);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error validating BIC:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function validateBIC(bic: string): {
  valid: boolean;
  formatted?: string;
  institutionCode?: string;
  countryCode?: string;
  locationCode?: string;
  branchCode?: string;
  bicType?: 'BIC8' | 'BIC11';
  errors?: string[];
} {
  const errors: string[] = [];
  
  // Remove spaces and convert to uppercase
  const cleanBic = bic.replace(/\s/g, '').toUpperCase();
  
  // BIC must be 8 or 11 characters
  if (cleanBic.length !== 8 && cleanBic.length !== 11) {
    errors.push('BIC must be 8 or 11 characters long');
    return { valid: false, errors };
  }
  
  // Format: AAAABBCCDDD
  // AAAA: Institution Code (4 letters)
  // BB: Country Code (2 letters, ISO 3166-1 alpha-2)
  // CC: Location Code (2 alphanumeric)
  // DDD: Branch Code (3 alphanumeric, optional)
  
  const institutionCode = cleanBic.substring(0, 4);
  const countryCode = cleanBic.substring(4, 6);
  const locationCode = cleanBic.substring(6, 8);
  const branchCode = cleanBic.length === 11 ? cleanBic.substring(8, 11) : undefined;
  
  // Validate institution code (4 letters)
  if (!/^[A-Z]{4}$/.test(institutionCode)) {
    errors.push('Institution code must be 4 letters');
  }
  
  // Validate country code (2 letters)
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errors.push('Country code must be 2 letters');
  }
  
  // Validate location code (2 alphanumeric)
  if (!/^[A-Z0-9]{2}$/.test(locationCode)) {
    errors.push('Location code must be 2 alphanumeric characters');
  }
  
  // Validate branch code if present (3 alphanumeric)
  if (branchCode && !/^[A-Z0-9]{3}$/.test(branchCode)) {
    errors.push('Branch code must be 3 alphanumeric characters');
  }
  
  // Check for test BIC (location code '0')
  const isTestBic = locationCode[1] === '0';
  
  // Check for passive participant (location code '1')
  const isPassive = locationCode[1] === '1';
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  return {
    valid: true,
    formatted: cleanBic,
    institutionCode,
    countryCode,
    locationCode,
    branchCode,
    bicType: cleanBic.length === 8 ? 'BIC8' : 'BIC11',
  };
}
