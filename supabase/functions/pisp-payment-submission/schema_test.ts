// Schema validation tests for pisp-payment-submission.
// Validates the OBIE Read/Write 4.0 §5.4 request body shape.
import { z } from 'https://esm.sh/zod@3.23.8';
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

// Re-declare the schema here to keep the test isolated from Supabase runtime.
const AMOUNT_PATTERN = /^[0-9]{1,15}$/;
const MCC_PATTERN = /^[0-9]{4}$/;
const SubmissionBodySchema = z.object({
  payment_id: z.string().trim().min(1).max(128),
  instructed_amount: z.object({
    amount: z.string().regex(AMOUNT_PATTERN),
    currency: z.enum(['XAF', 'XOF', 'EUR', 'USD']),
  }),
  creditor_account: z.object({
    scheme: z.enum(['IBAN', 'RIB', 'ACCOUNT_NUMBER']),
    identification: z.string().trim().min(1).max(64),
    name: z.string().trim().max(140).optional(),
  }),
  debtor_account: z
    .object({
      scheme: z.enum(['IBAN', 'RIB', 'ACCOUNT_NUMBER']),
      identification: z.string().trim().min(1).max(64),
      name: z.string().trim().max(140).optional(),
    })
    .optional(),
  remittance_information: z
    .object({
      unstructured: z.string().max(140).optional(),
      reference: z.string().max(35).optional(),
    })
    .optional(),
  risk: z.object({
    payment_context_code: z.enum(['BillPayment', 'EcommerceGoods', 'EcommerceServices', 'Other']),
    merchant_category_code: z.string().regex(MCC_PATTERN).optional(),
    merchant_customer_identification: z.string().max(70).optional(),
  }),
});

const validBody = {
  payment_id: 'pmt_01HFG',
  instructed_amount: { amount: '50000', currency: 'XAF' },
  creditor_account: { scheme: 'RIB', identification: '10005-00001-12345-67', name: 'Acme' },
  risk: { payment_context_code: 'EcommerceGoods', merchant_category_code: '5411' },
};

Deno.test('accepts a valid OBIE 4.0 §5.4 submission body', () => {
  const r = SubmissionBodySchema.safeParse(validBody);
  assertEquals(r.success, true);
});

Deno.test('rejects body missing instructed_amount', () => {
  const r = SubmissionBodySchema.safeParse({ ...validBody, instructed_amount: undefined });
  assertEquals(r.success, false);
});

Deno.test('rejects non-string monetary amount', () => {
  const r = SubmissionBodySchema.safeParse({
    ...validBody,
    instructed_amount: { amount: 50000 as unknown as string, currency: 'XAF' },
  });
  assertEquals(r.success, false);
});

Deno.test('rejects unknown currency', () => {
  const r = SubmissionBodySchema.safeParse({
    ...validBody,
    instructed_amount: { amount: '50000', currency: 'GBP' as 'XAF' },
  });
  assertEquals(r.success, false);
});

Deno.test('rejects unknown creditor_account.scheme', () => {
  const r = SubmissionBodySchema.safeParse({
    ...validBody,
    creditor_account: { scheme: 'BIC' as 'RIB', identification: 'X' },
  });
  assertEquals(r.success, false);
});

Deno.test('rejects missing risk block', () => {
  const r = SubmissionBodySchema.safeParse({ ...validBody, risk: undefined });
  assertEquals(r.success, false);
});

Deno.test('rejects invalid MCC pattern', () => {
  const r = SubmissionBodySchema.safeParse({
    ...validBody,
    risk: { payment_context_code: 'EcommerceGoods', merchant_category_code: '54' },
  });
  assertEquals(r.success, false);
});

Deno.test('rejects unknown payment_context_code', () => {
  const r = SubmissionBodySchema.safeParse({
    ...validBody,
    risk: { payment_context_code: 'Donation' as 'Other' },
  });
  assertEquals(r.success, false);
});
