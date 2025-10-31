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
      // OAuth & Security Endpoints
      '/oauth-authorize': {
        get: {
          tags: ['OAuth'],
          summary: 'Authorize OAuth request',
          description: 'Initiate OAuth 2.0 authorization flow with PKCE support',
          operationId: 'oauthAuthorize',
          parameters: [
            { name: 'response_type', in: 'query', required: true, schema: { type: 'string', enum: ['code'] } },
            { name: 'client_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'redirect_uri', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'scope', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'state', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'code_challenge', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'code_challenge_method', in: 'query', required: false, schema: { type: 'string', enum: ['S256'] } }
          ],
          responses: {
            '302': { description: 'Redirect to authorization page or back to client' },
            '400': { description: 'Invalid request parameters' }
          }
        }
      },
      '/oauth-token': {
        post: {
          tags: ['OAuth'],
          summary: 'Exchange authorization code for token',
          description: 'Token endpoint for OAuth 2.0 authorization code grant',
          operationId: 'oauthToken',
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  required: ['grant_type', 'code', 'client_id', 'redirect_uri'],
                  properties: {
                    grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token'] },
                    code: { type: 'string' },
                    client_id: { type: 'string' },
                    redirect_uri: { type: 'string' },
                    code_verifier: { type: 'string' },
                    refresh_token: { type: 'string' }
                  }
                }
              }
            }
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
                      token_type: { type: 'string', example: 'Bearer' },
                      expires_in: { type: 'integer', example: 3600 },
                      refresh_token: { type: 'string' },
                      scope: { type: 'string' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid grant or client credentials' }
          }
        }
      },
      '/oauth-introspect': {
        post: {
          tags: ['OAuth'],
          summary: 'Introspect access token',
          description: 'Validate and get information about an access token',
          operationId: 'oauthIntrospect',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  required: ['token'],
                  properties: {
                    token: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Token introspection result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      active: { type: 'boolean' },
                      scope: { type: 'string' },
                      client_id: { type: 'string' },
                      exp: { type: 'integer' },
                      sub: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/oidc-config': {
        get: {
          tags: ['OAuth'],
          summary: 'OpenID Connect configuration',
          description: 'OpenID Connect discovery document',
          operationId: 'oidcConfig',
          security: [],
          responses: {
            '200': {
              description: 'OIDC configuration',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      issuer: { type: 'string' },
                      authorization_endpoint: { type: 'string' },
                      token_endpoint: { type: 'string' },
                      jwks_uri: { type: 'string' },
                      response_types_supported: { type: 'array', items: { type: 'string' } },
                      grant_types_supported: { type: 'array', items: { type: 'string' } }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/jwks-endpoint': {
        get: {
          tags: ['OAuth'],
          summary: 'JSON Web Key Set',
          description: 'Public keys for token verification',
          operationId: 'jwksEndpoint',
          security: [],
          responses: {
            '200': {
              description: 'JWKS',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      keys: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            kty: { type: 'string' },
                            use: { type: 'string' },
                            kid: { type: 'string' },
                            n: { type: 'string' },
                            e: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/par-endpoint': {
        post: {
          tags: ['OAuth'],
          summary: 'Pushed Authorization Request',
          description: 'Submit authorization request parameters in advance (FAPI compliance)',
          operationId: 'parEndpoint',
          security: [{ mtls: [] }],
          requestBody: {
            required: true,
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  required: ['client_id', 'response_type', 'redirect_uri', 'scope'],
                  properties: {
                    client_id: { type: 'string' },
                    response_type: { type: 'string' },
                    redirect_uri: { type: 'string' },
                    scope: { type: 'string' },
                    state: { type: 'string' },
                    code_challenge: { type: 'string' },
                    code_challenge_method: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Request URI created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      request_uri: { type: 'string' },
                      expires_in: { type: 'integer', example: 600 }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/dcr-register': {
        post: {
          tags: ['OAuth'],
          summary: 'Dynamic Client Registration',
          description: 'Register a new OAuth client dynamically',
          operationId: 'dcrRegister',
          security: [{ mtls: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['client_name', 'redirect_uris'],
                  properties: {
                    client_name: { type: 'string' },
                    redirect_uris: { type: 'array', items: { type: 'string' } },
                    token_endpoint_auth_method: { type: 'string' },
                    grant_types: { type: 'array', items: { type: 'string' } },
                    scope: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Client registered',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      client_id: { type: 'string' },
                      client_secret: { type: 'string' },
                      client_id_issued_at: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // Phone Authentication
      '/phone-auth-send-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Send OTP to phone',
          description: 'Initiate phone-based authentication by sending OTP',
          operationId: 'phoneAuthSendOtp',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone_number'],
                  properties: {
                    phone_number: { type: 'string', example: '+237670000000' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      expires_in: { type: 'integer', example: 300 }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid phone number' },
            '429': { description: 'Too many requests' }
          }
        }
      },
      '/phone-auth-verify-otp': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify OTP code',
          description: 'Verify the OTP sent to phone number',
          operationId: 'phoneAuthVerifyOtp',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone_number', 'otp_code'],
                  properties: {
                    phone_number: { type: 'string', example: '+237670000000' },
                    otp_code: { type: 'string', example: '123456' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP verified successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      access_token: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '400': { description: 'Invalid or expired OTP' }
          }
        }
      },
      '/phone-auth-pin-login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with PIN',
          description: 'Authenticate using phone number and PIN',
          operationId: 'phoneAuthPinLogin',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone_number', 'pin'],
                  properties: {
                    phone_number: { type: 'string' },
                    pin: { type: 'string', minLength: 4, maxLength: 6 }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      access_token: { type: 'string' },
                      user: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            },
            '401': { description: 'Invalid credentials' }
          }
        }
      },
      '/phone-auth-check-pin': {
        post: {
          tags: ['Authentication'],
          summary: 'Check if PIN is set',
          description: 'Check if user has set up a PIN for their phone number',
          operationId: 'phoneAuthCheckPin',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone_number'],
                  properties: {
                    phone_number: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'PIN status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      has_pin: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/pin-code-set': {
        post: {
          tags: ['Authentication'],
          summary: 'Set PIN code',
          description: 'Set or update PIN for authenticated user',
          operationId: 'pinCodeSet',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['pin'],
                  properties: {
                    pin: { type: 'string', minLength: 4, maxLength: 6 }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'PIN set successfully' },
            '400': { description: 'Invalid PIN format' }
          }
        }
      },
      '/pin-code-verify': {
        post: {
          tags: ['Authentication'],
          summary: 'Verify PIN code',
          description: 'Verify PIN for transaction authorization',
          operationId: 'pinCodeVerify',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['pin'],
                  properties: {
                    pin: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'PIN verified',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' }
                    }
                  }
                }
              }
            },
            '401': { description: 'Invalid PIN' }
          }
        }
      },
      '/password-reset-with-pin': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password with PIN',
          description: 'Reset account password using PIN verification',
          operationId: 'passwordResetWithPin',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phone_number', 'pin', 'new_password'],
                  properties: {
                    phone_number: { type: 'string' },
                    pin: { type: 'string' },
                    new_password: { type: 'string', minLength: 8 }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Password reset successfully' },
            '400': { description: 'Invalid request' },
            '401': { description: 'Invalid PIN' }
          }
        }
      },

      // CAPTCHA
      '/captcha-generate': {
        post: {
          tags: ['Security'],
          summary: 'Generate CAPTCHA',
          description: 'Generate a CAPTCHA challenge for bot prevention',
          operationId: 'captchaGenerate',
          security: [],
          responses: {
            '200': {
              description: 'CAPTCHA generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      challenge_id: { type: 'string' },
                      image: { type: 'string', description: 'Base64 encoded image' },
                      expires_in: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/captcha-verify': {
        post: {
          tags: ['Security'],
          summary: 'Verify CAPTCHA',
          description: 'Verify CAPTCHA response',
          operationId: 'captchaVerify',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['challenge_id', 'response'],
                  properties: {
                    challenge_id: { type: 'string' },
                    response: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Verification result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      verified: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // Credit Scoring
      '/credit-score-fetch': {
        get: {
          tags: ['Credit Scoring'],
          summary: 'Get credit score',
          description: 'Retrieve current credit score for authenticated user',
          operationId: 'creditScoreFetch',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Credit score retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      score: { type: 'integer', minimum: 300, maximum: 850 },
                      grade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
                      last_updated: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-score-calculate': {
        post: {
          tags: ['Credit Scoring'],
          summary: 'Calculate credit score',
          description: 'Calculate credit score based on user financial data',
          operationId: 'creditScoreCalculate',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Score calculated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      score: { type: 'integer' },
                      factors: {
                        type: 'object',
                        properties: {
                          payment_history: { type: 'number' },
                          credit_utilization: { type: 'number' },
                          credit_age: { type: 'number' },
                          credit_mix: { type: 'number' },
                          new_credit: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-score-simulate': {
        post: {
          tags: ['Credit Scoring'],
          summary: 'Simulate credit score impact',
          description: 'Simulate how actions would impact credit score',
          operationId: 'creditScoreSimulate',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action_type'],
                  properties: {
                    action_type: { type: 'string', enum: ['pay_off_debt', 'new_credit', 'late_payment'] },
                    amount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Simulation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      current_score: { type: 'integer' },
                      projected_score: { type: 'integer' },
                      impact: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-score-tips': {
        get: {
          tags: ['Credit Scoring'],
          summary: 'Get credit improvement tips',
          description: 'Get personalized tips to improve credit score',
          operationId: 'creditScoreTips',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Tips retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tips: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            category: { type: 'string' },
                            tip: { type: 'string' },
                            impact: { type: 'string', enum: ['high', 'medium', 'low'] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-report-generate': {
        post: {
          tags: ['Credit Scoring'],
          summary: 'Generate credit report',
          description: 'Generate detailed credit report PDF',
          operationId: 'creditReportGenerate',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Report generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      report_id: { type: 'string' },
                      pdf_url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-api-auth': {
        post: {
          tags: ['Credit Scoring'],
          summary: 'Authenticate for credit API',
          description: 'Get API credentials for programmatic credit score access',
          operationId: 'creditApiAuth',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'API credentials',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      api_key: { type: 'string' },
                      expires_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/credit-api-query-score': {
        get: {
          tags: ['Credit Scoring'],
          summary: 'Query credit score via API',
          description: 'Programmatically query credit score',
          operationId: 'creditApiQueryScore',
          security: [{ apiKey: [] }],
          parameters: [
            { name: 'user_id', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Score retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user_id: { type: 'string' },
                      score: { type: 'integer' },
                      timestamp: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/njangibox-credit-fetch': {
        get: {
          tags: ['Credit Scoring'],
          summary: 'Fetch from NjangiBox bureau',
          description: 'Fetch credit data from NjangiBox credit bureau',
          operationId: 'njangiboxCreditFetch',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Credit data fetched',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      score: { type: 'integer' },
                      history: { type: 'array', items: { type: 'object' } }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // AISP Endpoints
      '/aisp-accounts': {
        get: {
          tags: ['AISP'],
          summary: 'Get user accounts',
          description: 'Retrieve list of user bank accounts with consent',
          operationId: 'aispAccounts',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'consent_id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Valid AISP consent ID'
            }
          ],
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
                        items: { $ref: '#/components/schemas/Account' }
                      }
                    }
                  }
                }
              }
            },
            '401': { description: 'Unauthorized - Invalid or expired token' },
            '403': { description: 'Forbidden - Consent not granted or expired' }
          }
        }
      },
      '/aisp-balances': {
        get: {
          tags: ['AISP'],
          summary: 'Get account balances',
          description: 'Retrieve balances for authorized accounts',
          operationId: 'aispBalances',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'consent_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'account_id', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Balances retrieved',
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
                            currency: { type: 'string' },
                            available: { type: 'number' },
                            current: { type: 'number' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/aisp-transactions': {
        get: {
          tags: ['AISP'],
          summary: 'Get account transactions',
          description: 'Retrieve transaction history for authorized accounts',
          operationId: 'aispTransactions',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'consent_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'account_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'from_date', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'to_date', in: 'query', schema: { type: 'string', format: 'date' } }
          ],
          responses: {
            '200': {
              description: 'Transactions retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      transactions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Transaction' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/aisp-beneficiaries': {
        get: {
          tags: ['AISP'],
          summary: 'Get beneficiaries',
          description: 'Retrieve list of saved beneficiaries',
          operationId: 'aispBeneficiaries',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'consent_id', in: 'query', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Beneficiaries retrieved',
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
                            account_number: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/aisp-standing-orders': {
        get: {
          tags: ['AISP'],
          summary: 'Get standing orders',
          description: 'Retrieve active standing orders',
          operationId: 'aispStandingOrders',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'consent_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'account_id', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Standing orders retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      standing_orders: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            frequency: { type: 'string' },
                            amount: { type: 'number' },
                            next_payment_date: { type: 'string', format: 'date' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/aisp-direct-debits': {
        get: {
          tags: ['AISP'],
          summary: 'Get direct debits',
          description: 'Retrieve active direct debit mandates',
          operationId: 'aispDirectDebits',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'consent_id', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'account_id', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Direct debits retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      direct_debits: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            merchant: { type: 'string' },
                            status: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/aisp-create-consent': {
        post: {
          tags: ['AISP'],
          summary: 'Create AISP consent',
          description: 'Create a new Account Information consent',
          operationId: 'aispCreateConsent',
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
                      items: { type: 'string' },
                      example: ['ReadAccountsBasic', 'ReadBalances', 'ReadTransactionsDetail']
                    },
                    expiration_date: { type: 'string', format: 'date-time' },
                    transaction_from_date: { type: 'string', format: 'date-time' },
                    transaction_to_date: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Consent created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      consent_id: { type: 'string' },
                      status: { type: 'string' },
                      authorization_url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // PISP Endpoints
      '/pisp-create-consent': {
        post: {
          tags: ['PISP'],
          summary: 'Create payment consent',
          description: 'Create consent for payment initiation',
          operationId: 'pispCreateConsent',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'currency', 'creditor_account'],
                  properties: {
                    amount: { type: 'number', example: 100.00 },
                    currency: { type: 'string', example: 'XAF' },
                    creditor_account: {
                      type: 'object',
                      properties: {
                        iban: { type: 'string' },
                        name: { type: 'string' }
                      }
                    },
                    reference: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Consent created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      consent_id: { type: 'string' },
                      status: { type: 'string' },
                      authorization_url: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/pisp-domestic-payment': {
        post: {
          tags: ['PISP'],
          summary: 'Create domestic payment',
          description: 'Initiate a domestic payment',
          operationId: 'pispDomesticPayment',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['consent_id', 'debtor_account'],
                  properties: {
                    consent_id: { type: 'string' },
                    debtor_account: {
                      type: 'object',
                      properties: {
                        iban: { type: 'string' },
                        name: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Payment created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payment_id: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/pisp-payment-submission': {
        post: {
          tags: ['PISP'],
          summary: 'Submit payment for processing',
          description: 'Submit authorized payment for execution',
          operationId: 'pispPaymentSubmission',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['payment_id'],
                  properties: {
                    payment_id: { type: 'string' }
                  }
                }
              }
            }
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
                      submission_date: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/pisp-payment-details/{paymentId}': {
        get: {
          tags: ['PISP'],
          summary: 'Get payment details',
          description: 'Retrieve details of a specific payment',
          operationId: 'pispPaymentDetails',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'paymentId', in: 'path', required: true, schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'Payment details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      payment_id: { type: 'string' },
                      status: { type: 'string' },
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // Consent Management
      '/consent-authorize': {
        post: {
          tags: ['Consent Management'],
          summary: 'Authorize consent',
          description: 'User authorizes a pending consent',
          operationId: 'consentAuthorize',
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
                    account_ids: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Consent authorized',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      consent_id: { type: 'string' },
                      status: { type: 'string', example: 'Authorised' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/consent-revoke': {
        post: {
          tags: ['Consent Management'],
          summary: 'Revoke consent',
          description: 'User revokes an existing consent',
          operationId: 'consentRevoke',
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
                    consent_type: { type: 'string', enum: ['aisp', 'pisp'] }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Consent revoked',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      consent_id: { type: 'string' },
                      status: { type: 'string', example: 'Revoked' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api-consents-list': {
        get: {
          tags: ['Consent Management'],
          summary: 'List user consents',
          description: 'List all consents for authenticated user (GDPR)',
          operationId: 'apiConsentsList',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Authorised', 'Revoked', 'Expired'] } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: ['aisp', 'pisp'] } }
          ],
          responses: {
            '200': {
              description: 'Consents list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      consents: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            consent_id: { type: 'string' },
                            type: { type: 'string' },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // Savings
      '/savings-create': {
        post: {
          tags: ['Savings'],
          summary: 'Create savings account',
          description: 'Open a new savings account',
          operationId: 'savingsCreate',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['product_id', 'currency'],
                  properties: {
                    product_id: { type: 'string' },
                    currency: { type: 'string', example: 'XAF' },
                    initial_deposit: { type: 'number', minimum: 0 }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Savings account created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      account_id: { type: 'string' },
                      account_number: { type: 'string' },
                      balance: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/savings-deposit': {
        post: {
          tags: ['Savings'],
          summary: 'Deposit to savings',
          description: 'Make a deposit to savings account',
          operationId: 'savingsDeposit',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['account_id', 'amount'],
                  properties: {
                    account_id: { type: 'string' },
                    amount: { type: 'number', minimum: 0.01 },
                    reference: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Deposit successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      transaction_id: { type: 'string' },
                      new_balance: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
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

        // Loans
        '/loan-apply': {
          post: {
            summary: 'Apply for loan',
            description: 'Submit loan application',
            operationId: 'loanApply',
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
                      product_id: { type: 'string' },
                      amount: { type: 'number', minimum: 1000 },
                      term_months: { type: 'integer', minimum: 1, maximum: 360 },
                      purpose: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Application submitted',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        application_id: { type: 'string' },
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
        '/loan-calculate': {
          post: {
            summary: 'Calculate loan terms',
            description: 'Calculate monthly payments and total interest',
            operationId: 'loanCalculate',
            tags: ['Loans'],
            security: [],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'interest_rate', 'term_months'],
                    properties: {
                      amount: { type: 'number' },
                      interest_rate: { type: 'number' },
                      term_months: { type: 'integer' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Calculation result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        monthly_payment: { type: 'number' },
                        total_interest: { type: 'number' },
                        total_payment: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/loan-repay': {
          post: {
            summary: 'Make loan repayment',
            description: 'Process loan repayment',
            operationId: 'loanRepay',
            tags: ['Loans'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['loan_id', 'amount'],
                    properties: {
                      loan_id: { type: 'string' },
                      amount: { type: 'number', minimum: 0.01 },
                      payment_method: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Repayment processed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        payment_id: { type: 'string' },
                        remaining_balance: { type: 'number' },
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

        // ISO20022 Standards
        '/iso20022-pain001-parser': {
          post: {
            summary: 'Parse ISO20022 pain.001',
            description: 'Parse ISO20022 pain.001 (Payment Initiation) message',
            operationId: 'iso20022Pain001Parser',
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
                    schema: {
                      type: 'object',
                      properties: {
                        message_id: { type: 'string' },
                        debtor: { type: 'object' },
                        transactions: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
              '400': { description: 'Invalid XML' },
            },
          },
        },
        '/iso20022-pacs008-generator': {
          post: {
            summary: 'Generate ISO20022 pacs.008',
            description: 'Generate ISO20022 pacs.008 (Payment Clearing and Settlement) message',
            operationId: 'iso20022Pacs008Generator',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'debtor', 'creditor'],
                    properties: {
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      debtor: { type: 'object' },
                      creditor: { type: 'object' },
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
            },
          },
        },
        '/iso20022-pacs002-generator': {
          post: {
            summary: 'Generate ISO20022 pacs.002',
            description: 'Generate ISO20022 pacs.002 (Payment Status Report) message',
            operationId: 'iso20022Pacs002Generator',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['original_message_id', 'status'],
                    properties: {
                      original_message_id: { type: 'string' },
                      status: { type: 'string' },
                      reason_code: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Status report generated',
                content: {
                  'application/xml': {
                    schema: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        '/iso20022-camt053-parser': {
          post: {
            summary: 'Parse ISO20022 camt.053',
            description: 'Parse ISO20022 camt.053 (Bank Statement) message',
            operationId: 'iso20022Camt053Parser',
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
                description: 'Statement parsed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        account: { type: 'object' },
                        opening_balance: { type: 'number' },
                        closing_balance: { type: 'number' },
                        entries: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // SWIFT
        '/swift-mt103-parser': {
          post: {
            summary: 'Parse SWIFT MT103',
            description: 'Parse SWIFT MT103 (Single Customer Credit Transfer) message',
            operationId: 'swiftMt103Parser',
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
                    schema: {
                      type: 'object',
                      properties: {
                        sender_reference: { type: 'string' },
                        value_date: { type: 'string' },
                        currency: { type: 'string' },
                        amount: { type: 'number' },
                        ordering_customer: { type: 'string' },
                        beneficiary: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/swift-mt103-generator': {
          post: {
            summary: 'Generate SWIFT MT103',
            description: 'Generate SWIFT MT103 message',
            operationId: 'swiftMt103Generator',
            tags: ['Standards'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount', 'currency', 'sender', 'beneficiary'],
                    properties: {
                      amount: { type: 'number' },
                      currency: { type: 'string' },
                      sender: { type: 'object' },
                      beneficiary: { type: 'object' },
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
            },
          },
        },
        '/swift-mt940-parser': {
          post: {
            summary: 'Parse SWIFT MT940',
            description: 'Parse SWIFT MT940 (Customer Statement) message',
            operationId: 'swiftMt940Parser',
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
                description: 'Statement parsed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        account: { type: 'string' },
                        statement_number: { type: 'string' },
                        opening_balance: { type: 'object' },
                        closing_balance: { type: 'object' },
                        transactions: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Validation
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
                        check_digits: { type: 'string' },
                        bban: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/validate-bic': {
          post: {
            summary: 'Validate BIC/SWIFT',
            description: 'Validate Business Identifier Code / SWIFT code',
            operationId: 'validateBic',
            tags: ['Standards'],
            security: [],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['bic'],
                    properties: {
                      bic: { type: 'string' },
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
                        institution_code: { type: 'string' },
                        country_code: { type: 'string' },
                        location_code: { type: 'string' },
                        branch_code: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Admin
        '/admin-create-user': {
          post: {
            summary: 'Create user account',
            description: 'Create new user account (admin only)',
            operationId: 'adminCreateUser',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['email', 'password', 'full_name'],
                    properties: {
                      email: { type: 'string', format: 'email' },
                      password: { type: 'string', minLength: 8 },
                      full_name: { type: 'string' },
                      role: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'User created',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        user_id: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
              '403': { description: 'Forbidden - admin only' },
            },
          },
        },
        '/admin-create-client': {
          post: {
            summary: 'Register TPP client',
            description: 'Register new Third Party Provider client',
            operationId: 'adminCreateClient',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['client_name', 'redirect_uris'],
                    properties: {
                      client_name: { type: 'string' },
                      redirect_uris: { type: 'array', items: { type: 'string' } },
                      client_type: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Client registered',
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
            },
          },
        },
        '/admin-webhooks': {
          get: {
            summary: 'List webhooks',
            description: 'List all registered webhooks',
            operationId: 'adminListWebhooks',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Webhooks list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        webhooks: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              url: { type: 'string' },
                              events: { type: 'array', items: { type: 'string' } },
                              is_active: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Create webhook',
            description: 'Register new webhook endpoint',
            operationId: 'adminCreateWebhook',
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
                    schema: {
                      type: 'object',
                      properties: {
                        webhook_id: { type: 'string' },
                        secret: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/admin-transaction-review': {
          get: {
            summary: 'Get flagged transactions',
            description: 'List transactions flagged for review',
            operationId: 'adminGetFlaggedTransactions',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Flagged transactions',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        transactions: {
                          type: 'array',
                          items: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Review transaction',
            description: 'Approve or reject flagged transaction',
            operationId: 'adminReviewTransaction',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['transaction_id', 'action'],
                    properties: {
                      transaction_id: { type: 'string' },
                      action: { type: 'string', enum: ['approve', 'reject'] },
                      notes: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Transaction reviewed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        transaction_id: { type: 'string' },
                        new_status: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/admin-metrics': {
          get: {
            summary: 'Get system metrics',
            description: 'Retrieve system performance and usage metrics',
            operationId: 'adminGetMetrics',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'period',
                in: 'query',
                schema: { type: 'string', enum: ['hour', 'day', 'week', 'month'] },
              },
            ],
            responses: {
              '200': {
                description: 'Metrics data',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        api_calls: { type: 'integer' },
                        active_users: { type: 'integer' },
                        transactions: { type: 'integer' },
                        average_response_time: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/admin-system-config': {
          get: {
            summary: 'Get system configuration',
            description: 'Retrieve system configuration settings',
            operationId: 'adminGetSystemConfig',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Configuration settings',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        maintenance_mode: { type: 'boolean' },
                        rate_limits: { type: 'object' },
                        features: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Update system configuration',
            description: 'Update system configuration settings',
            operationId: 'adminUpdateSystemConfig',
            tags: ['Admin'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      maintenance_mode: { type: 'boolean' },
                      rate_limits: { type: 'object' },
                      features: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Configuration updated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Communications
        '/send-communication': {
          post: {
            summary: 'Send communication',
            description: 'Send email or SMS to user',
            operationId: 'sendCommunication',
            tags: ['Communications'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['template_key', 'recipient'],
                    properties: {
                      template_key: { type: 'string' },
                      recipient: { type: 'string' },
                      variables: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Communication sent',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        message_id: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/send-bulk-communication': {
          post: {
            summary: 'Send bulk communications',
            description: 'Send communications to multiple recipients',
            operationId: 'sendBulkCommunication',
            tags: ['Communications'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['template_key', 'recipients'],
                    properties: {
                      template_key: { type: 'string' },
                      recipients: { type: 'array', items: { type: 'string' } },
                      variables: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Bulk send initiated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        batch_id: { type: 'string' },
                        total_recipients: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/send-invoice-email': {
          post: {
            summary: 'Email invoice',
            description: 'Send invoice via email',
            operationId: 'sendInvoiceEmail',
            tags: ['Communications'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['invoice_id'],
                    properties: {
                      invoice_id: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Invoice sent',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        sent_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Invoicing
        '/generate-invoice': {
          post: {
            summary: 'Generate invoice',
            description: 'Generate PDF invoice',
            operationId: 'generateInvoice',
            tags: ['Invoicing'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['institution_id', 'period_start', 'period_end'],
                    properties: {
                      institution_id: { type: 'string' },
                      period_start: { type: 'string', format: 'date' },
                      period_end: { type: 'string', format: 'date' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Invoice generated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        invoice_id: { type: 'string' },
                        pdf_url: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/generate-bank-statement': {
          post: {
            summary: 'Generate bank statement',
            description: 'Generate PDF bank statement',
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
                      account_id: { type: 'string' },
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
                        statement_id: { type: 'string' },
                        pdf_url: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Monitoring & Health
        '/api-health': {
          get: {
            summary: 'Health check',
            description: 'Simple health check endpoint',
            operationId: 'apiHealth',
            tags: ['Monitoring'],
            security: [],
            responses: {
              '200': {
                description: 'API is healthy',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', example: 'ok' },
                        timestamp: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/system-health-check': {
          get: {
            summary: 'System health check',
            description: 'Comprehensive system health status',
            operationId: 'systemHealthCheck',
            tags: ['Monitoring'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'System health status',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' },
                        database: { type: 'object' },
                        apis: { type: 'object' },
                        services: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/transaction-monitor': {
          post: {
            summary: 'Monitor transaction',
            description: 'Monitor transaction for suspicious activity',
            operationId: 'monitorTransaction',
            tags: ['Monitoring'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['transaction'],
                    properties: {
                      transaction: { type: 'object' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Monitoring result',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        flagged: { type: 'boolean' },
                        alerts: { type: 'array', items: { type: 'object' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Webhooks
        '/webhook-delivery': {
          post: {
            summary: 'Process webhook deliveries',
            description: 'Process pending webhook deliveries',
            operationId: 'webhookDelivery',
            tags: ['Webhooks'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Deliveries processed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        processed: { type: 'integer' },
                        succeeded: { type: 'integer' },
                        failed: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Certificates
        '/certificate-upload': {
          post: {
            summary: 'Upload certificate',
            description: 'Upload client certificate for mTLS',
            operationId: 'certificateUpload',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['certificate'],
                    properties: {
                      certificate: { type: 'string', format: 'binary' },
                      description: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Certificate uploaded',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        certificate_id: { type: 'string' },
                        thumbprint: { type: 'string' },
                        valid_until: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/certificate-list': {
          get: {
            summary: 'List certificates',
            description: 'List client certificates',
            operationId: 'certificateList',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            responses: {
              '200': {
                description: 'Certificates list',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        certificates: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              thumbprint: { type: 'string' },
                              valid_until: { type: 'string', format: 'date-time' },
                              is_revoked: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/certificate-revoke': {
          post: {
            summary: 'Revoke certificate',
            description: 'Revoke client certificate',
            operationId: 'certificateRevoke',
            tags: ['Certificates'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['certificate_id'],
                    properties: {
                      certificate_id: { type: 'string' },
                      reason: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Certificate revoked',
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
            },
          },
        },

        // Bulk Operations
        '/bulk-transfers': {
          post: {
            summary: 'Process bulk transfers',
            description: 'Process multiple transfers in batch',
            operationId: 'bulkTransfers',
            tags: ['Payments'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['transfers'],
                    properties: {
                      transfers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['amount', 'recipient'],
                          properties: {
                            amount: { type: 'number' },
                            recipient: { type: 'string' },
                            reference: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Batch processed',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        batch_id: { type: 'string' },
                        total: { type: 'integer' },
                        successful: { type: 'integer' },
                        failed: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },

        // Developer Tools
        '/test-data-generator': {
          post: {
            summary: 'Generate test data',
            description: 'Generate test data for sandbox',
            operationId: 'testDataGenerator',
            tags: ['Developer Tools'],
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['scenario'],
                    properties: {
                      scenario: { type: 'string' },
                      clear_existing: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Test data generated',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        records_created: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/postman-collection': {
          get: {
            summary: 'Get Postman collection',
            description: 'Generate Postman collection for API testing',
            operationId: 'postmanCollection',
            tags: ['Developer Tools'],
            security: [],
            responses: {
              '200': {
                description: 'Postman collection',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
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
