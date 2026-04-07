const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. List verified domains on this Resend account
  const domainsRes = await fetch('https://api.resend.com/domains', {
    headers: { 'Authorization': `Bearer ${resendApiKey}` },
  });
  const domainsBody = await domainsRes.text();

  // 2. Try sending a test email from Resend's test domain (to verify API key works)
  const testRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Kang OB <onboarding@resend.dev>',
      to: ['kangopenbanking@gmail.com'],
      subject: 'Resend API Key Test - Kang OB',
      html: '<h1>API Key Test</h1><p>If you receive this, the Resend API key is valid.</p>',
    }),
  });
  const testBody = await testRes.text();

  return new Response(JSON.stringify({
    domains: { status: domainsRes.status, body: JSON.parse(domainsBody) },
    testSend: { status: testRes.status, body: JSON.parse(testBody) },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
