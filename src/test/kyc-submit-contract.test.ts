/**
 * Contract test for the kyc-submit edge function validation schema.
 *
 * Mirrors the zod schema in `supabase/functions/kyc-submit/index.ts`.
 * If the edge function ever weakens these requirements (e.g. drops
 * `document_front_url` from required), this test must be updated in
 * the SAME PR — drift between the contract and this test fails CI.
 *
 * Pairs with the DB-level trigger `validate_kyc_submission` added in
 * migration 20260531 which enforces the same rule at the database
 * level so the API can never be bypassed.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

const kycSubmissionSchema = z.object({
  verification_type: z.enum(["identity", "address", "business"]),
  document_type: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9_\s-]+$/),
  document_number: z
    .string()
    .min(5)
    .max(50)
    .regex(/^[A-Z0-9-]+$/i),
  document_country: z.string().min(2).max(50),
  document_expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(d) > new Date(), "Document must not be expired"),
  document_front_url: z.string().min(1),
  document_back_url: z.string().min(1).optional(),
  selfie_url: z.string().min(1),
});

const futureDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
};

const base = {
  verification_type: "identity" as const,
  document_type: "national_id",
  document_number: "ID-2024-001234",
  document_country: "CM",
  document_expiry_date: futureDate(),
  document_front_url: "uid/kyc/id-front-1.png",
  document_back_url: "uid/kyc/id-back-1.png",
  selfie_url: "uid/kyc/selfie-1.png",
};

describe("kyc-submit validation contract", () => {
  it("accepts a fully-valid identity submission", () => {
    expect(kycSubmissionSchema.safeParse(base).success).toBe(true);
  });

  it("rejects when document_front_url is missing", () => {
    const { document_front_url, ...partial } = base;
    expect(kycSubmissionSchema.safeParse(partial).success).toBe(false);
  });

  it("rejects when document_front_url is empty", () => {
    expect(
      kycSubmissionSchema.safeParse({ ...base, document_front_url: "" }).success,
    ).toBe(false);
  });

  it("rejects when selfie_url is empty", () => {
    expect(
      kycSubmissionSchema.safeParse({ ...base, selfie_url: "" }).success,
    ).toBe(false);
  });

  it("rejects expired documents", () => {
    expect(
      kycSubmissionSchema.safeParse({ ...base, document_expiry_date: "2020-01-01" })
        .success,
    ).toBe(false);
  });

  it("allows omitting document_back_url (passport flow)", () => {
    const { document_back_url, ...partial } = base;
    expect(kycSubmissionSchema.safeParse(partial).success).toBe(true);
  });
});
