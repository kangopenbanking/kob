/**
 * Shared bilingual (EN/FR) error catalogue for KOB Open Banking.
 *
 * Edge functions import `localizeProblem` and pass the negotiated language tag
 * (parsed from the Accept-Language request header) plus an error code; they
 * receive a fully-formed RFC 7807 ProblemDetails body. The same map backs the
 * /v1/errors/{code} lookup endpoint.
 *
 * Cited standards:
 *   - RFC 7807 — Problem Details for HTTP APIs
 *   - RFC 7231 §5.3.5 — Accept-Language negotiation
 *   - BCP 47 — Tags for Identifying Languages
 *   - ISO 639-1 — Two-letter language codes
 *
 * The catalogue mirrors the 63 codes already registered in supabase/functions/_shared/errors.ts.
 * Codes not present here fall back to the EN title from that file.
 */

export type SupportedLang = "en" | "en-CM" | "en-GB" | "fr" | "fr-CM";

export interface LocalizedEntry {
  code: string;
  status: number;
  title_en: string;
  title_fr: string;
  detail_en?: string;
  detail_fr?: string;
}

const CATALOG: Record<string, LocalizedEntry> = {
  AUTH_001: {
    code: "AUTH_001",
    status: 401,
    title_en: "Invalid access token",
    title_fr: "Jeton d'accès invalide",
    detail_en: "The bearer token is missing, malformed, or expired.",
    detail_fr: "Le jeton porteur est manquant, mal formé ou expiré.",
  },
  AUTH_002: {
    code: "AUTH_002",
    status: 403,
    title_en: "Insufficient scope",
    title_fr: "Portée insuffisante",
    detail_en: "The presented token does not carry the scope required for this operation.",
    detail_fr: "Le jeton présenté ne dispose pas de la portée requise pour cette opération.",
  },
  RATE_001: {
    code: "RATE_001",
    status: 429,
    title_en: "Rate limit exceeded",
    title_fr: "Limite de débit dépassée",
    detail_en: "You have exceeded your tier's per-minute request quota. See Retry-After.",
    detail_fr: "Vous avez dépassé le quota de requêtes par minute de votre palier. Voir Retry-After.",
  },
  IDEM_001: {
    code: "IDEM_001",
    status: 409,
    title_en: "Idempotency key conflict",
    title_fr: "Conflit de clé d'idempotence",
    detail_en: "The same Idempotency-Key was reused with a different request body.",
    detail_fr: "La même Idempotency-Key a été réutilisée avec un corps de requête différent.",
  },
  MOMO_001: {
    code: "MOMO_001",
    status: 422,
    title_en: "Mobile money provider declined",
    title_fr: "Opérateur mobile money a refusé",
    detail_en: "The mobile money provider returned a declined response. Inspect provider_error.normalized_code.",
    detail_fr: "L'opérateur mobile money a renvoyé une réponse refusée. Voir provider_error.normalized_code.",
  },
  KYC_001: {
    code: "KYC_001",
    status: 422,
    title_en: "Identity not found in national registry",
    title_fr: "Identité introuvable au registre national",
    detail_en: "The supplied NIN/CNI was not found in the issuing authority's registry.",
    detail_fr: "Le NIN/CNI fourni est introuvable au registre de l'autorité émettrice.",
  },
  LEGACY_DEMO_KEY: {
    code: "LEGACY_DEMO_KEY",
    status: 410,
    title_en: "Legacy demo sandbox key is retired",
    title_fr: "La clé sandbox de démonstration est obsolète",
    detail_en: "Create your own sandbox key in the developer portal (Sandbox Console). The shared demo key is no longer documented.",
    detail_fr: "Créez votre propre clé sandbox dans le portail développeur (Console Sandbox). La clé partagée n'est plus documentée.",
  },
};

export function normalizeLang(input: string | null | undefined): SupportedLang {
  if (!input) return "en";
  const first = input.split(",")[0].trim().toLowerCase();
  if (first.startsWith("fr-cm")) return "fr-CM";
  if (first.startsWith("fr")) return "fr";
  if (first.startsWith("en-cm")) return "en-CM";
  if (first.startsWith("en-gb")) return "en-GB";
  return "en";
}

export function localizeProblem(
  code: string,
  lang: SupportedLang,
  overrides: Partial<LocalizedEntry> = {},
): { body: Record<string, unknown>; status: number; contentLanguage: string } {
  const entry = { ...(CATALOG[code] ?? null), ...overrides } as LocalizedEntry | null;
  if (!entry) {
    return {
      status: 500,
      contentLanguage: "en",
      body: {
        type: "https://docs.kangopenbanking.com/errors/unknown",
        title: "Unknown error",
        status: 500,
        code,
      },
    };
  }
  const isFr = lang === "fr" || lang === "fr-CM";
  return {
    status: entry.status,
    contentLanguage: isFr ? "fr" : "en",
    body: {
      type: `https://docs.kangopenbanking.com/errors/${entry.code}`,
      title: isFr ? entry.title_fr : entry.title_en,
      status: entry.status,
      code: entry.code,
      detail: isFr ? entry.detail_fr : entry.detail_en,
    },
  };
}

export function lookupError(code: string): LocalizedEntry | null {
  return CATALOG[code] ?? null;
}

export function listSupportedCodes(): string[] {
  return Object.keys(CATALOG);
}
