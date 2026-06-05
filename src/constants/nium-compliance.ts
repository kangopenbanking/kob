/**
 * BEAC / COBAC compliance constants for Nium global accounts.
 *
 * Cite: BEAC Règlement n°02/18/CEMAC/UMAC/CM relatif aux relations
 *       financières extérieures des États membres de la CEMAC.
 *
 * COMPLIANCE CHECK: Purpose-of-Payment (PoP) values sent to Nium are
 * permanently locked to this whitelist. Generic terms like "Transfer"
 * or "Consulting" are FORBIDDEN. Any addition requires Guardian sign-off
 * (Standing Orders 1, 4).
 */
export const NIUM_POP_CODES = {
  SOFTWARE_DIGITAL_SERVICES: "Software/Digital Services",
  ROYALTIES: "Royalties",
} as const;

export type NiumPopCode = (typeof NIUM_POP_CODES)[keyof typeof NIUM_POP_CODES];

export const ALLOWED_NIUM_POP_CODES: readonly NiumPopCode[] = Object.freeze([
  NIUM_POP_CODES.SOFTWARE_DIGITAL_SERVICES,
  NIUM_POP_CODES.ROYALTIES,
]);

export const DEFAULT_NIUM_POP_CODE: NiumPopCode =
  NIUM_POP_CODES.SOFTWARE_DIGITAL_SERVICES;

export function isAllowedNiumPopCode(value: unknown): value is NiumPopCode {
  return (
    typeof value === "string" &&
    (ALLOWED_NIUM_POP_CODES as readonly string[]).includes(value)
  );
}

export function assertAllowedNiumPopCode(value: unknown): NiumPopCode {
  if (!isAllowedNiumPopCode(value)) {
    throw new Error(
      `pop_code_forbidden: must be one of ${ALLOWED_NIUM_POP_CODES.join(", ")}`,
    );
  }
  return value;
}

/** Default payout method enum, mirrored in profiles.default_payout_method. */
export const DEFAULT_PAYOUT_METHODS = ["KANG_WALLET", "MOBILE_MONEY"] as const;
export type DefaultPayoutMethod = (typeof DEFAULT_PAYOUT_METHODS)[number];
