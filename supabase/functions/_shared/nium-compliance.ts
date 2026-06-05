// Deno-runtime mirror of src/constants/nium-compliance.ts
// Cite: BEAC Règlement n°02/18/CEMAC/UMAC/CM
// COMPLIANCE CHECK: locked Purpose-of-Payment whitelist.

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

export function isAllowedNiumPopCode(v: unknown): v is NiumPopCode {
  return typeof v === "string" && (ALLOWED_NIUM_POP_CODES as readonly string[]).includes(v);
}
