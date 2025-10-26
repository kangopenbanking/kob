// Shared validation utilities for edge functions
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

/**
 * Generate a unique error ID for tracking
 */
export function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generic error response with error ID
 */
export function genericErrorResponse(
  corsHeaders: Record<string, string>,
  status: number = 500
): Response {
  const errorId = generateErrorId();
  console.error(`[ERROR-${errorId}] Generic error response sent to client`);
  
  return new Response(
    JSON.stringify({
      error: 'operation_failed',
      error_description: 'Unable to process request. Please contact support.',
      error_id: errorId
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Log error securely (detailed logs server-side only)
 */
export function logError(context: string, error: unknown, metadata?: Record<string, any>) {
  const errorId = generateErrorId();
  console.error(`[SECURE-${errorId}] ${context}:`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    metadata,
    timestamp: new Date().toISOString()
  });
  return errorId;
}

// Payment validation schemas
export const mobileMoneyTransferSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(10000000, 'Amount exceeds maximum limit')
    .refine((val) => val >= 100, 'Minimum amount is 100 XAF'),
  phone_number: z.string()
    .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format')
    .trim(),
  provider: z.enum(['mtn', 'orange', 'MTN', 'Orange'], {
    errorMap: () => ({ message: 'Invalid provider' })
  }),
  description: z.string()
    .max(500, 'Description too long')
    .trim()
    .optional(),
  reference: z.string()
    .max(100, 'Reference too long')
    .regex(/^[a-zA-Z0-9-_\s]*$/, 'Invalid reference format')
    .trim()
    .optional()
});

export const domesticPaymentSchema = z.object({
  instructed_amount: z.object({
    amount: z.string()
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 
        'Invalid amount'),
    currency: z.string()
      .length(3, 'Currency must be 3 characters')
      .toUpperCase()
  }),
  creditor_account: z.object({
    scheme_name: z.string().min(1, 'Scheme name required'),
    identification: z.string()
      .min(1, 'Account identification required')
      .max(50, 'Account identification too long')
  }),
  remittance_information: z.object({
    reference: z.string()
      .max(100, 'Reference too long')
      .trim()
      .optional(),
    unstructured: z.string()
      .max(500, 'Remittance information too long')
      .trim()
      .optional()
  }).optional()
});

export const bankTransferSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .max(100000000, 'Amount exceeds maximum limit'),
  bank_code: z.string()
    .min(1, 'Bank code required')
    .max(10, 'Invalid bank code'),
  account_number: z.string()
    .min(5, 'Account number too short')
    .max(50, 'Account number too long')
    .regex(/^[0-9]+$/, 'Account number must contain only digits'),
  account_name: z.string()
    .min(2, 'Account name too short')
    .max(100, 'Account name too long')
    .trim()
    .optional(),
  narration: z.string()
    .max(500, 'Narration too long')
    .trim()
    .optional(),
  currency: z.string()
    .length(3, 'Currency must be 3 characters')
    .default('XAF')
});

// OAuth validation schemas
export const oauthTokenSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token', 'client_credentials']),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  redirect_uri: z.string().url('Invalid redirect URI').optional(),
  client_id: z.string()
    .min(10, 'Invalid client ID')
    .max(100, 'Invalid client ID'),
  client_secret: z.string()
    .min(20, 'Invalid client secret')
    .max(200, 'Invalid client secret')
    .optional(),
  code_verifier: z.string().optional()
});

// KYC validation schemas
export const kycSubmissionSchema = z.object({
  verification_type: z.enum(['identity', 'address', 'income']),
  document_type: z.string()
    .min(2, 'Document type required')
    .max(50, 'Invalid document type'),
  document_number: z.string()
    .min(5, 'Document number too short')
    .max(50, 'Document number too long')
    .regex(/^[A-Z0-9-]+$/, 'Invalid document number format'),
  full_name: z.string()
    .min(2, 'Name too short')
    .max(200, 'Name too long')
    .trim(),
  date_of_birth: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  address: z.string()
    .max(500, 'Address too long')
    .trim()
    .optional()
});

/**
 * Validate and sanitize input
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError.message || 'Invalid input'
      };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}
