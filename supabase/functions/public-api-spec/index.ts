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
          mtls: {
            type: 'mutualTLS',
            description: 'Client certificate authentication (RFC 8705) for certificate-bound access tokens',
          },
          oauth2: {
            type: 'oauth2',
            description: 'OAuth 2.0 Authorization Code Flow with PKCE (FAPI 1.0 Advanced)',
            flows: {
              authorizationCode: {
                authorizationUrl: 'https://api.kangopenbanking.com/oauth-authorize',
                tokenUrl: 'https://api.kangopenbanking.com/oauth-token',
                scopes: {
                  openid: 'OpenID Connect',
                  accounts: 'Read account information',
                  balances: 'Read account balances',
                  transactions: 'Read transaction history',
                  payments: 'Initiate payments',
                  offline_access: 'Refresh tokens',
                },
              },
            },
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
          Certificate: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              thumbprint: { type: 'string', description: 'RFC 8705 base64url-encoded SHA-256 thumbprint' },
              fingerprint: { type: 'string', description: 'SHA-256 fingerprint (hex format)' },
              subject_dn: { type: 'string', description: 'Certificate subject distinguished name' },
              issuer_dn: { type: 'string', description: 'Certificate issuer distinguished name' },
              serial_number: { type: 'string' },
              valid_from: { type: 'string', format: 'date-time' },
              valid_until: { type: 'string', format: 'date-time' },
              is_revoked: { type: 'boolean' },
              usage_count: { type: 'integer' },
              last_used_at: { type: 'string', format: 'date-time' },
            },
          },
          Payment: {
            type: 'object',
            properties: {
              payment_id: { type: 'string', format: 'uuid' },
              amount: { type: 'number', format: 'double' },
              currency: { type: 'string', default: 'XAF' },
              status: { type: 'string', enum: ['pending', 'completed', 'failed', 'cancelled'] },
              created_at: { type: 'string', format: 'date-time' },
            },
          },
          Transaction: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string', format: 'uuid' },
              amount: { type: 'number', format: 'double' },
              currency: { type: 'string' },
              type: { type: 'string', enum: ['debit', 'credit'] },
              description: { type: 'string' },
              balance_after: { type: 'number' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
          MobileMoneyCharge: {
            type: 'object',
            properties: {
              transaction_id: { type: 'string' },
              phone_number: { type: 'string' },
              amount: { type: 'number' },
              currency: { type: 'string', default: 'XAF' },
              status: { type: 'string' },
            },
          },
          Webhook: {
            type: 'object',
            properties: {
              webhook_id: { type: 'string', format: 'uuid' },
              url: { type: 'string', format: 'uri' },
              events: { type: 'array', items: { type: 'string' } },
              is_active: { type: 'boolean' },
            },
          },
        },
      },
      tags: [
        { name: 'Authentication', description: 'OAuth 2.0 and authentication endpoints' },
        { name: 'Certificates', description: 'mTLS certificate management (FAPI 1.0 Advanced)' },
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
        { name: 'Webhooks', description: 'Webhook configuration and management' },
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
        '/certificate-upload': {
          post: {
            summary: 'Upload client certificate',
            description: 'Register a new X.509 client certificate for mTLS authentication',
            operationId: 'uploadCertificate',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['certificate_pem', 'tpp_registration_id'],
                    properties: {
                      certificate_pem: { type: 'string', description: 'PEM-encoded X.509 certificate' },
                      tpp_registration_id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Certificate uploaded successfully',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Certificate' },
                  },
                },
              },
              '400': { description: 'Invalid certificate format' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/certificate-list': {
          get: {
            summary: 'List registered certificates',
            description: 'Retrieve all X.509 certificates registered for the authenticated user',
            operationId: 'listCertificates',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'tpp_registration_id',
                in: 'query',
                description: 'Filter by TPP registration ID',
                required: false,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '200': {
                description: 'Certificates retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        certificates: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Certificate' },
                        },
                        count: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/certificate-revoke': {
          post: {
            summary: 'Revoke client certificate',
            description: 'Revoke a certificate and invalidate all associated access tokens',
            operationId: 'revokeCertificate',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['certificate_id', 'reason'],
                    properties: {
                      certificate_id: { type: 'string', format: 'uuid' },
                      reason: { type: 'string', enum: ['key_compromise', 'cessation_of_operation', 'superseded'] },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Certificate revoked successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        certificate_id: { type: 'string' },
                        revoked_at: { type: 'string', format: 'date-time' },
                        tokens_revoked: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Bad request' },
              '401': { description: 'Unauthorized' },
              '404': { description: 'Certificate not found' },
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
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/aisp-balances': {
          get: {
            summary: 'Get account balances',
            description: 'Retrieve balance information for user accounts',
            operationId: 'getBalances',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'account_id',
                in: 'query',
                description: 'Filter by specific account ID',
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '200': {
                description: 'Balances retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        balances: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              account_id: { type: 'string' },
                              balance_type: { type: 'string', enum: ['InterimAvailable', 'InterimBooked', 'Expected'] },
                              amount: { type: 'number' },
                              currency: { type: 'string' },
                            },
                          },
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
        '/aisp-transactions': {
          get: {
            summary: 'Get transaction history',
            description: 'Retrieve transaction history for user accounts',
            operationId: 'getTransactions',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'account_id',
                in: 'query',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
              {
                name: 'from_date',
                in: 'query',
                schema: { type: 'string', format: 'date' },
              },
              {
                name: 'to_date',
                in: 'query',
                schema: { type: 'string', format: 'date' },
              },
            ],
            responses: {
              '200': {
                description: 'Transactions retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        transactions: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Transaction' },
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
        '/aisp-beneficiaries': {
          get: {
            summary: 'Get beneficiaries',
            description: 'Retrieve list of saved beneficiaries',
            operationId: 'getBeneficiaries',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Beneficiaries retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        beneficiaries: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              account_number: { type: 'string' },
                              bank_code: { type: 'string' },
                            },
                          },
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
        '/aisp-standing-orders': {
          get: {
            summary: 'Get standing orders',
            description: 'Retrieve list of active standing orders',
            operationId: 'getStandingOrders',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Standing orders retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        standing_orders: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/aisp-direct-debits': {
          get: {
            summary: 'Get direct debits',
            description: 'Retrieve list of active direct debits',
            operationId: 'getDirectDebits',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Direct debits retrieved successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        direct_debits: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/aisp-create-consent': {
          post: {
            summary: 'Create AISP consent',
            description: 'Create a new Account Information consent',
            operationId: 'createAispConsent',
            tags: ['AISP'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['permissions', 'expiration_date'],
                    properties: {
                      permissions: { 
                        type: 'array',
                        items: { type: 'string', enum: ['ReadAccountsBasic', 'ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsBasic', 'ReadTransactionsDetail'] },
                      },
                      expiration_date: { type: 'string', format: 'date-time' },
                      account_ids: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Consent created successfully',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        consent_id: { type: 'string' },
                        status: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/pisp-create-consent': {
          post: {
            summary: 'Create PISP consent',
            description: 'Create a new Payment Initiation consent',
            operationId: 'createPispConsent',
            tags: ['PISP'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['debtor_account', 'creditor_account', 'amount', 'currency'],
                    properties: {
                      debtor_account: { type: 'string' },
                      creditor_account: { type: 'string' },
                      creditor_name: { type: 'string' },
                      amount: { type: 'number' },
                      currency: { type: 'string', default: 'XAF' },
                      reference: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Payment consent created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        consent_id: { type: 'string' },
                        status: { type: 'string' },
                        authorization_url: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/pisp-domestic-payment': {
          post: {
            summary: 'Create domestic payment',
            description: 'Initiate a domestic payment within Cameroon',
            operationId: 'createDomesticPayment',
            tags: ['PISP'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['consent_id'],
                    properties: {
                      consent_id: { type: 'string' },
                      initiation: {
                        type: 'object',
                        properties: {
                          instruction_id: { type: 'string' },
                          end_to_end_id: { type: 'string' },
                          debtor_account: { type: 'object' },
                          creditor_account: { type: 'object' },
                          amount: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Payment created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Payment' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/pisp-payment-submission': {
          post: {
            summary: 'Submit payment for processing',
            description: 'Submit an authorized payment for processing',
            operationId: 'submitPayment',
            tags: ['PISP'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['payment_id', 'consent_id'],
                    properties: {
                      payment_id: { type: 'string', format: 'uuid' },
                      consent_id: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Payment submitted',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        payment_id: { type: 'string' },
                        status: { type: 'string' },
                        submission_time: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/pisp-payment-details': {
          get: {
            summary: 'Get payment details',
            description: 'Retrieve details of a specific payment',
            operationId: 'getPaymentDetails',
            tags: ['PISP'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'payment_id',
                in: 'query',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: {
              '200': {
                description: 'Payment details retrieved',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Payment' },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
              '404': { description: 'Payment not found' },
            },
          },
        },
        '/bulk-transfers': {
          post: {
            summary: 'Process bulk transfers',
            description: 'Process multiple transfers in a single batch',
            operationId: 'bulkTransfers',
            tags: ['PISP'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['csv_data'],
                    properties: {
                      csv_data: { type: 'string', description: 'CSV formatted transfer data' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Bulk transfer processed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        successful: { type: 'integer' },
                        failed: { type: 'integer' },
                        results: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/savings-create': {
          post: {
            summary: 'Create savings account',
            description: 'Create a new savings account',
            operationId: 'createSavings',
            tags: ['Savings'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['product_id', 'initial_deposit'],
                    properties: {
                      product_id: { type: 'string', format: 'uuid' },
                      initial_deposit: { type: 'number', minimum: 10000 },
                      account_name: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Savings account created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Account' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/savings-deposit': {
          post: {
            summary: 'Deposit to savings',
            description: 'Make a deposit to a savings account',
            operationId: 'savingsDeposit',
            tags: ['Savings'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['account_id', 'amount'],
                    properties: {
                      account_id: { type: 'string', format: 'uuid' },
                      amount: { type: 'number', minimum: 1000 },
                      reference: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Deposit successful',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/savings-withdraw': {
          post: {
            summary: 'Withdraw from savings',
            description: 'Make a withdrawal from a savings account',
            operationId: 'savingsWithdraw',
            tags: ['Savings'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['account_id', 'amount'],
                    properties: {
                      account_id: { type: 'string', format: 'uuid' },
                      amount: { type: 'number', minimum: 1000 },
                      reference: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Withdrawal successful',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/mobile-money-charge': {
          post: {
            summary: 'Collect mobile money payment',
            description: 'Initiate a mobile money collection from customer',
            operationId: 'mobileMoneyCharge',
            tags: ['Mobile Money'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['phone_number', 'amount', 'provider'],
                    properties: {
                      phone_number: { type: 'string', pattern: '^237[0-9]{9}$' },
                      amount: { type: 'number', minimum: 100 },
                      currency: { type: 'string', default: 'XAF' },
                      provider: { type: 'string', enum: ['mtn', 'orange'] },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Payment initiated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/MobileMoneyCharge' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/mobile-money-verify': {
          post: {
            summary: 'Verify mobile money transaction',
            description: 'Verify the status of a mobile money transaction',
            operationId: 'verifyMobileMoney',
            tags: ['Mobile Money'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['transaction_id'],
                    properties: {
                      transaction_id: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Verification result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' },
                        verified_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
              '404': { description: 'Transaction not found' },
            },
          },
        },
        '/mobile-money-transfer': {
          post: {
            summary: 'Send mobile money',
            description: 'Send money to a mobile money account (disbursement)',
            operationId: 'mobileMoneyTransfer',
            tags: ['Mobile Money'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['phone_number', 'amount', 'provider'],
                    properties: {
                      phone_number: { type: 'string' },
                      amount: { type: 'number' },
                      provider: { type: 'string', enum: ['mtn', 'orange'] },
                      reference: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Transfer initiated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/MobileMoneyCharge' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/mobile-money-to-bank': {
          post: {
            summary: 'Transfer mobile money to bank',
            description: 'Transfer from mobile money to bank account',
            operationId: 'mobileMoneyToBank',
            tags: ['Mobile Money'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['mobile_money_account', 'bank_account', 'amount'],
                    properties: {
                      mobile_money_account: { type: 'string' },
                      bank_account: { type: 'string' },
                      amount: { type: 'number' },
                      provider: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Transfer initiated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/stripe-payment-intent': {
          post: {
            summary: 'Create Stripe payment',
            description: 'Create a Stripe payment intent',
            operationId: 'createStripePayment',
            tags: ['Payments'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'currency'],
                    properties: {
                      amount: { type: 'number' },
                      currency: { type: 'string', default: 'XAF' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Payment intent created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        client_secret: { type: 'string' },
                        payment_intent_id: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/stripe-confirm-payment': {
          post: {
            summary: 'Confirm Stripe payment',
            description: 'Confirm a Stripe payment intent',
            operationId: 'confirmStripePayment',
            tags: ['Payments'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['payment_intent_id'],
                    properties: {
                      payment_intent_id: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Payment confirmed',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Payment' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/flutterwave-bank-transfer': {
          post: {
            summary: 'Bank transfer via Flutterwave',
            description: 'Initiate bank transfer using Flutterwave',
            operationId: 'flutterwaveBankTransfer',
            tags: ['Payments'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['account_number', 'account_bank', 'amount'],
                    properties: {
                      account_number: { type: 'string' },
                      account_bank: { type: 'string' },
                      amount: { type: 'number' },
                      narration: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Transfer initiated',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/flutterwave-list-banks': {
          get: {
            summary: 'List available banks',
            description: 'Get list of banks supported by Flutterwave',
            operationId: 'listBanks',
            tags: ['Payments'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Banks retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        banks: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              code: { type: 'string' },
                              name: { type: 'string' },
                            },
                          },
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
        '/bank-sync': {
          post: {
            summary: 'Sync bank accounts',
            description: 'Synchronize bank account data',
            operationId: 'bankSync',
            tags: ['Banking Operations'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['connection_id'],
                    properties: {
                      connection_id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Sync completed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        synced_at: { type: 'string', format: 'date-time' },
                        accounts_synced: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/bank-reconcile': {
          post: {
            summary: 'Reconcile transactions',
            description: 'Reconcile bank statements with system transactions',
            operationId: 'bankReconcile',
            tags: ['Banking Operations'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['bank_connection_id', 'reconciliation_date'],
                    properties: {
                      bank_connection_id: { type: 'string', format: 'uuid' },
                      reconciliation_date: { type: 'string', format: 'date' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Reconciliation completed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        matched_count: { type: 'integer' },
                        unmatched_bank: { type: 'integer' },
                        unmatched_system: { type: 'integer' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/generate-bank-statement': {
          post: {
            summary: 'Generate bank statement',
            description: 'Generate a PDF bank statement for an account',
            operationId: 'generateBankStatement',
            tags: ['Banking Operations'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['account_id', 'start_date', 'end_date'],
                    properties: {
                      account_id: { type: 'string', format: 'uuid' },
                      start_date: { type: 'string', format: 'date' },
                      end_date: { type: 'string', format: 'date' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Statement generated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        pdf_url: { type: 'string' },
                        generated_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/iso20022-pain001-parser': {
          post: {
            summary: 'Parse ISO20022 pain.001',
            description: 'Parse ISO20022 pain.001 payment initiation message',
            operationId: 'parsePain001',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/xml': {
                  schema: { type: 'string' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Message parsed',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              '400': { description: 'Invalid XML' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/iso20022-pacs008-generator': {
          post: {
            summary: 'Generate ISO20022 pacs.008',
            description: 'Generate ISO20022 pacs.008 payment message',
            operationId: 'generatePacs008',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['payment_id'],
                    properties: {
                      payment_id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Message generated',
                content: {
                  'application/xml': {
                    schema: { type: 'string' },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/swift-mt103-parser': {
          post: {
            summary: 'Parse SWIFT MT103',
            description: 'Parse SWIFT MT103 message',
            operationId: 'parseMT103',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'text/plain': {
                  schema: { type: 'string' },
                },
              },
            },
            responses: {
              '200': {
                description: 'Message parsed',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
              '400': { description: 'Invalid SWIFT message' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/swift-mt103-generator': {
          post: {
            summary: 'Generate SWIFT MT103',
            description: 'Generate SWIFT MT103 message',
            operationId: 'generateMT103',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['payment_id'],
                    properties: {
                      payment_id: { type: 'string', format: 'uuid' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Message generated',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/validate-iban': {
          post: {
            summary: 'Validate IBAN',
            description: 'Validate International Bank Account Number',
            operationId: 'validateIban',
            tags: ['Standards'],
            security: [],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['iban'],
                    properties: {
                      iban: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Validation result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        valid: { type: 'boolean' },
                        country_code: { type: 'string' },
                        bank_code: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
            },
          },
        },
        '/virtual-card-create': {
          post: {
            summary: 'Create virtual card',
            description: 'Issue a new virtual card',
            operationId: 'createVirtualCard',
            tags: ['Virtual Cards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['card_type', 'currency'],
                    properties: {
                      card_type: { type: 'string', enum: ['debit', 'prepaid'] },
                      currency: { type: 'string', default: 'XAF' },
                      initial_balance: { type: 'number' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Card created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        card_id: { type: 'string' },
                        card_number: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/virtual-card-list': {
          get: {
            summary: 'List virtual cards',
            description: 'Get all virtual cards for the user',
            operationId: 'listVirtualCards',
            tags: ['Virtual Cards'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Cards retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        cards: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/virtual-card-topup': {
          post: {
            summary: 'Top up virtual card',
            description: 'Add funds to a virtual card',
            operationId: 'topUpCard',
            tags: ['Virtual Cards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['card_id', 'amount'],
                    properties: {
                      card_id: { type: 'string', format: 'uuid' },
                      amount: { type: 'number', minimum: 1000 },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Top up successful',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Transaction' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/kyc-submit': {
          post: {
            summary: 'Submit KYC documents',
            description: 'Submit identity verification documents',
            operationId: 'submitKyc',
            tags: ['KYC & Compliance'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['document_type', 'document_file'],
                    properties: {
                      document_type: { type: 'string', enum: ['national_id', 'passport', 'drivers_license'] },
                      document_file: { type: 'string', format: 'binary' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'KYC submitted',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        verification_id: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/sanctions-screen': {
          post: {
            summary: 'Screen against sanctions',
            description: 'Check user against sanctions and watchlists',
            operationId: 'sanctionsScreen',
            tags: ['KYC & Compliance'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['full_name', 'date_of_birth'],
                    properties: {
                      full_name: { type: 'string' },
                      date_of_birth: { type: 'string', format: 'date' },
                      nationality: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Screening completed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['clear', 'potential_match', 'confirmed_match'] },
                        matches: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/sca-initiate': {
          post: {
            summary: 'Initiate SCA',
            description: 'Initiate Strong Customer Authentication',
            operationId: 'initiateScA',
            tags: ['KYC & Compliance'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['challenge_type'],
                    properties: {
                      challenge_type: { type: 'string', enum: ['sms', 'email', 'totp'] },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Challenge sent',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        challenge_id: { type: 'string' },
                        expires_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/admin-create-client': {
          post: {
            summary: 'Create API client',
            description: 'Register a new TPP/API client',
            operationId: 'createClient',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['institution_id', 'client_name'],
                    properties: {
                      institution_id: { type: 'string', format: 'uuid' },
                      client_name: { type: 'string' },
                      redirect_uris: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Client created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        client_id: { type: 'string' },
                        client_secret: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/admin-webhooks': {
          get: {
            summary: 'List webhooks',
            description: 'Get all registered webhooks',
            operationId: 'listWebhooks',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Webhooks retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        webhooks: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Webhook' },
                        },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
          post: {
            summary: 'Create webhook',
            description: 'Register a new webhook endpoint',
            operationId: 'createWebhook',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['url', 'events'],
                    properties: {
                      url: { type: 'string', format: 'uri' },
                      events: { type: 'array', items: { type: 'string' } },
                      secret: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Webhook created',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Webhook' },
                  },
                },
              },
              '400': { description: 'Invalid request' },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/consent-authorize': {
          post: {
            summary: 'Authorize consent',
            description: 'User authorizes or rejects consent',
            operationId: 'authorizeConsent',
            tags: ['Authentication'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['consent_id', 'consent_type', 'authorized'],
                    properties: {
                      consent_id: { type: 'string' },
                      consent_type: { type: 'string', enum: ['aisp', 'pisp'] },
                      authorized: { type: 'boolean' },
                      selected_accounts: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Consent updated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        consent_id: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/consent-revoke': {
          post: {
            summary: 'Revoke consent',
            description: 'Revoke an existing consent',
            operationId: 'revokeConsent',
            tags: ['Authentication'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['consent_id', 'consent_type'],
                    properties: {
                      consent_id: { type: 'string' },
                      consent_type: { type: 'string', enum: ['aisp', 'pisp'] },
                      reason: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Consent revoked',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        revoked_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '401': { description: 'Unauthorized' },
            },
          },
        },
        '/exchange-rate-get': {
          get: {
            summary: 'Get exchange rates',
            description: 'Get current exchange rates',
            operationId: 'getExchangeRates',
            tags: ['Banking Operations'],
            security: [],
            parameters: [
              {
                name: 'from',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
              {
                name: 'to',
                in: 'query',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Exchange rate retrieved',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        rate: { type: 'number' },
                        from_currency: { type: 'string' },
                        to_currency: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid request' },
            },
          },
        },
        '/data-export': {
          post: {
            summary: 'Export user data',
            description: 'Export all user data (GDPR compliance)',
            operationId: 'exportData',
            tags: ['KYC & Compliance'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Export initiated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        export_id: { type: 'string' },
                        status: { type: 'string' },
                        download_url: { type: 'string' },
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

    return new Response(JSON.stringify(openapiSpec), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });

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
