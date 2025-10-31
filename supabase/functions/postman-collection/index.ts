import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const postmanCollection = {
      info: {
        name: 'Kang Open Banking API',
        description: 'Unified Open Banking API for Cameroon - COBAC & BEAC Compliant',
        version: '1.0.0',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{access_token}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'base_url',
          value: 'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1',
          type: 'string',
        },
        {
          key: 'access_token',
          value: 'YOUR_ACCESS_TOKEN',
          type: 'string',
        },
      ],
      item: [
        {
          name: 'Authentication',
          item: [
            {
              name: 'Get Access Token',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/x-www-form-urlencoded',
                  },
                ],
                url: {
                  raw: '{{base_url}}/oauth-token',
                  host: ['{{base_url}}'],
                  path: ['oauth-token'],
                },
                body: {
                  mode: 'urlencoded',
                  urlencoded: [
                    { key: 'grant_type', value: 'authorization_code' },
                    { key: 'client_id', value: 'YOUR_CLIENT_ID' },
                    { key: 'client_secret', value: 'YOUR_CLIENT_SECRET' },
                    { key: 'code', value: 'AUTH_CODE' },
                  ],
                },
                description: 'Exchange authorization code for access token',
              },
            },
          ],
        },
        {
          name: 'Credit Scoring',
          item: [
            {
              name: 'Fetch Credit Score',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/credit-score-fetch',
                  host: ['{{base_url}}'],
                  path: ['credit-score-fetch'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      user_id: '{{user_id}}',
                      force_refresh: false,
                      include_report: true,
                    },
                    null,
                    2
                  ),
                },
                description: 'Fetch user credit score with optional report',
              },
            },
            {
              name: 'Calculate Credit Score',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/credit-score-calculate',
                  host: ['{{base_url}}'],
                  path: ['credit-score-calculate'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      user_id: '{{user_id}}',
                      include_external: true,
                    },
                    null,
                    2
                  ),
                },
              },
            },
          ],
        },
        {
          name: 'AISP (Account Information)',
          item: [
            {
              name: 'List Accounts',
              request: {
                method: 'GET',
                header: [],
                url: {
                  raw: '{{base_url}}/aisp-accounts',
                  host: ['{{base_url}}'],
                  path: ['aisp-accounts'],
                },
              },
            },
            {
              name: 'Get Balances',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/aisp-balances',
                  host: ['{{base_url}}'],
                  path: ['aisp-balances'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({ account_id: '{{account_id}}' }, null, 2),
                },
              },
            },
            {
              name: 'Get Transactions',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/aisp-transactions',
                  host: ['{{base_url}}'],
                  path: ['aisp-transactions'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify({ account_id: '{{account_id}}' }, null, 2),
                },
              },
            },
          ],
        },
        {
          name: 'Loans',
          item: [
            {
              name: 'Apply for Loan',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/loan-apply',
                  host: ['{{base_url}}'],
                  path: ['loan-apply'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      product_id: '{{product_id}}',
                      amount: 100000,
                      term_months: 12,
                      purpose: 'Business expansion',
                    },
                    null,
                    2
                  ),
                },
              },
            },
            {
              name: 'Calculate Loan',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/loan-calculate',
                  host: ['{{base_url}}'],
                  path: ['loan-calculate'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      amount: 100000,
                      term_months: 12,
                      interest_rate: 15,
                    },
                    null,
                    2
                  ),
                },
              },
            },
          ],
        },
        {
          name: 'Mobile Money',
          item: [
            {
              name: 'Charge Mobile Money',
              request: {
                method: 'POST',
                header: [
                  {
                    key: 'Content-Type',
                    value: 'application/json',
                  },
                ],
                url: {
                  raw: '{{base_url}}/mobile-money-charge',
                  host: ['{{base_url}}'],
                  path: ['mobile-money-charge'],
                },
                body: {
                  mode: 'raw',
                  raw: JSON.stringify(
                    {
                      phone_number: '237650000000',
                      amount: 5000,
                      currency: 'XAF',
                    },
                    null,
                    2
                  ),
                },
              },
            },
          ],
        },
      ],
    };

    return new Response(JSON.stringify(postmanCollection, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="kang-openbanking-api.postman_collection.json"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating Postman collection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Failed to generate Postman collection',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
