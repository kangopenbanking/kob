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
    // Generate OpenAPI spec dynamically
    const openapiSpec = {
      openapi: '3.0.3',
      info: {
        title: 'Kang Open Banking API',
        version: '1.0.0',
        description: 'Unified Open Banking API for Cameroon - COBAC & BEAC Compliant. Provides Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, and comprehensive financial services.',
        contact: {
          name: 'Kang Open Banking Support',
          email: 'support@kangopenbanking.com',
          url: 'https://kangopenbanking.com/contact',
        },
        termsOfService: 'https://kangopenbanking.com/terms',
        license: {
          name: 'Proprietary',
          url: 'https://kangopenbanking.com/terms',
        },
      },
      servers: [
        {
          url: 'https://api.kangopenbanking.com',
          description: 'Production API Server',
        },
      ],
      security: [
        { bearerAuth: [] },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'OAuth 2.0 access token with Bearer scheme',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'string', description: 'Detailed error information' },
            },
          },
          CreditScore: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 300, maximum: 850 },
              score_range: { type: 'string', enum: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'] },
              calculated_at: { type: 'string', format: 'date-time' },
              expires_at: { type: 'string', format: 'date-time' },
            },
          },
          Account: {
            type: 'object',
            properties: {
              account_id: { type: 'string', format: 'uuid' },
              account_number: { type: 'string' },
              account_type: { type: 'string', enum: ['checking', 'savings', 'loan', 'business'] },
              currency: { type: 'string', default: 'XAF' },
              balance: { type: 'number', format: 'double' },
              status: { type: 'string', enum: ['active', 'inactive', 'frozen', 'closed'] },
            },
          },
        },
      },
      tags: [
        { name: 'Authentication', description: 'OAuth 2.0 and authentication endpoints' },
        { name: 'AISP', description: 'Account Information Service Provider endpoints' },
        { name: 'PISP', description: 'Payment Initiation Service Provider endpoints' },
        { name: 'Credit Scoring', description: 'Credit score calculation and reporting' },
        { name: 'Loans', description: 'Loan application and management' },
        { name: 'Savings', description: 'Savings account management' },
        { name: 'Mobile Money', description: 'Mobile money integration endpoints' },
        { name: 'Payments', description: 'Payment processing (Stripe, Flutterwave)' },
        { name: 'Banking Operations', description: 'Core banking functionality' },
        { name: 'Standards', description: 'ISO20022 and SWIFT message processing' },
        { name: 'Virtual Cards', description: 'Virtual card issuance and management' },
        { name: 'KYC & Compliance', description: 'Identity verification and compliance checks' },
        { name: 'Admin', description: 'Administrative endpoints' },
      ],
      paths: {
        '/oauth-token': {
          post: {
            summary: 'Exchange authorization code for access token',
            description: 'OAuth 2.0 token endpoint supporting authorization_code and refresh_token grant types',
            operationId: 'getAccessToken',
            tags: ['Authentication'],
            security: [],
            requestBody: {
              required: true,
              content: {
                'application/x-www-form-urlencoded': {
                  schema: {
                    type: 'object',
                    required: ['grant_type', 'client_id', 'client_secret'],
                    properties: {
                      grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
                      client_id: { type: 'string' },
                      client_secret: { type: 'string' },
                      code: { type: 'string' },
                      refresh_token: { type: 'string' },
                      redirect_uri: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Token issued successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        token_type: { type: 'string', default: 'Bearer' },
                        expires_in: { type: 'integer', default: 3600 },
                        refresh_token: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Bad request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/credit-score-fetch': {
          post: {
            summary: 'Fetch user credit score',
            description: 'Retrieve the authenticated user\'s credit score with optional detailed report',
            operationId: 'getCreditScore',
            tags: ['Credit Scoring'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['user_id'],
                    properties: {
                      user_id: { type: 'string', format: 'uuid' },
                      force_refresh: { type: 'boolean', default: false },
                      include_report: { type: 'boolean', default: false },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Credit score retrieved successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreditScore' },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
              '500': { description: 'Server error' },
            },
          },
        },
        '/aisp-accounts': {
          get: {
            summary: 'List user accounts',
            description: 'Retrieve all accounts for the authenticated user',
            operationId: 'getAccounts',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Accounts retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        accounts: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Account' },
                        },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/loan-apply': {
          post: {
            summary: 'Apply for a loan',
            description: 'Submit a loan application with automatic credit assessment',
            operationId: 'applyForLoan',
            tags: ['Loans'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['product_id', 'amount', 'term_months'],
                    properties: {
                      product_id: { type: 'string', format: 'uuid' },
                      amount: { type: 'number', minimum: 50000 },
                      term_months: { type: 'integer', minimum: 3, maximum: 60 },
                      purpose: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Loan application submitted',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        application_id: { type: 'string', format: 'uuid' },
                        status: { type: 'string' },
                        credit_score: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
      },
    };

    return new Response(JSON.stringify(openapiSpec, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        error: 'Failed to load API specification',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
