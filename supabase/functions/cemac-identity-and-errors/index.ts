// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
//
// CEMAC identity verification (/v1/verify/nin, /v1/verify/cni) and the
// bilingual error lookup (/v1/errors/{code}). Routed via Supabase function
// path /functions/v1/cemac-identity-and-errors which the API edge proxy maps
// to /v1/verify/* and /v1/errors/*.
//
// Cited standards:
//   - ICAO 9303 — Machine Readable Travel Documents
//   - CIPRES Inter-African civil-status interoperability convention
//   - RFC 7807 — Problem Details for HTTP APIs
//   - RFC 7231 §5.3.5 — Accept-Language negotiation
//   - BCP 47 — Language tags
//
// verify_jwt is FALSE (validated in-code per project policy).

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  lookupError,
  listSupportedCodes,
  normalizeLang,
  localizeProblem,
} from "../_shared/i18n-errors.ts";

interface NinReq {
  country: "CM" | "GA" | "CG" | "TD" | "CF" | "GQ";
  nin: string;
  holder_first_name?: string;
  holder_last_name?: string;
  holder_dob?: string;
  consent_id: string;
}

interface CniReq extends Omit<NinReq, "nin"> {
  cni_number: string;
}

const NIN_PATTERN = /^[A-Z0-9]{8,18}$/;
const CNI_PATTERN = /^[A-Z0-9]{6,18}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY_SET = new Set(["CM", "GA", "CG", "TD", "CF", "GQ"]);

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function problem(code: string, lang: ReturnType<typeof normalizeLang>, status?: number) {
  const { body, status: catalogStatus, contentLanguage } = localizeProblem(code, lang);
  return new Response(JSON.stringify(body), {
    status: status ?? catalogStatus,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/problem+json",
      "Content-Language": contentLanguage,
    },
  });
}

function validateNin(body: NinReq): string | null {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  if (!COUNTRY_SET.has(body.country)) return "country must be one of CM,GA,CG,TD,CF,GQ";
  if (!NIN_PATTERN.test(body.nin || "")) return "nin must match ^[A-Z0-9]{8,18}$";
  if (!UUID_PATTERN.test(body.consent_id || "")) return "consent_id must be a valid UUID v4";
  return null;
}

function validateCni(body: CniReq): string | null {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  if (!COUNTRY_SET.has(body.country)) return "country must be one of CM,GA,CG,TD,CF,GQ";
  if (!CNI_PATTERN.test(body.cni_number || "")) return "cni_number must match ^[A-Z0-9]{6,18}$";
  if (!UUID_PATTERN.test(body.consent_id || "")) return "consent_id must be a valid UUID v4";
  return null;
}

/**
 * Stub registry resolver. Production deployments wire this to the relevant
 * national identity authority per country (ANTIC Cameroun, ANIP Gabon, etc.).
 * Sandbox always returns a deterministic match for ids beginning with "11"
 * and a not-found for ids beginning with "00".
 */
function resolveIdentityStub(input: { country: string; id: string; holderName?: string }) {
  const id = input.id.toUpperCase();
  if (id.startsWith("00")) return null;
  return {
    match: true,
    score: id.startsWith("11") ? 97 : 88,
    holder_full_name: input.holderName?.toUpperCase() ?? "MBALLA NGONO JEAN",
    holder_dob: "1990-05-12",
    issuing_authority: input.country === "CM" ? "ANTIC Cameroun" : `Registre national ${input.country}`,
    issued_at: "2018-03-14",
    expires_at: "2028-03-14",
    verified_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  // Function deploys at /functions/v1/cemac-identity-and-errors/<suffix>.
  // The suffix preserves /verify/nin, /verify/cni, /errors/{code} segments.
  const pathname = url.pathname.replace(/^.*?\/cemac-identity-and-errors/, "");
  const lang = normalizeLang(req.headers.get("Accept-Language"));

  try {
    // ----- /v1/errors/{code} -----
    if (req.method === "GET" && pathname.startsWith("/errors/")) {
      const code = decodeURIComponent(pathname.slice("/errors/".length));
      if (!code) return problem("KYC_001", lang, 404);
      const entry = lookupError(code);
      if (!entry) {
        return json({ type: "https://docs.kangopenbanking.com/errors/unknown", title: "Unknown code", status: 404, code }, {
          status: 404,
          headers: { "Content-Type": "application/problem+json", "Content-Language": "en" },
        });
      }
      const langQuery = url.searchParams.get("lang") ?? lang;
      const normalized = normalizeLang(langQuery);
      return json(
        {
          ...entry,
          type: `https://docs.kangopenbanking.com/errors/${entry.code}`,
          remediation_url: `https://kangopenbanking.com/developer/errors/${entry.code}`,
        },
        { headers: { "Content-Language": normalized.startsWith("fr") ? "fr" : "en" } },
      );
    }

    // ----- GET /errors (list codes) -----
    if (req.method === "GET" && (pathname === "/errors" || pathname === "/errors/")) {
      return json({ codes: listSupportedCodes() }, { headers: { "Content-Language": "en" } });
    }

    // ----- POST /v1/verify/nin -----
    if (req.method === "POST" && pathname === "/verify/nin") {
      const body = (await req.json().catch(() => null)) as NinReq | null;
      if (!body) return problem("AUTH_001", lang, 400);
      const err = validateNin(body);
      if (err) {
        return json(
          {
            type: "https://docs.kangopenbanking.com/errors/validation",
            title: lang.startsWith("fr") ? "Requête invalide" : "Invalid request",
            status: 400,
            detail: err,
          },
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json", "Content-Language": lang.startsWith("fr") ? "fr" : "en" },
          },
        );
      }
      const result = resolveIdentityStub({
        country: body.country,
        id: body.nin,
        holderName: [body.holder_first_name, body.holder_last_name].filter(Boolean).join(" ") || undefined,
      });
      if (!result) return problem("KYC_001", lang, 404);
      return json(result, { headers: { "Content-Language": lang.startsWith("fr") ? "fr" : "en" } });
    }

    // ----- POST /v1/verify/cni -----
    if (req.method === "POST" && pathname === "/verify/cni") {
      const body = (await req.json().catch(() => null)) as CniReq | null;
      if (!body) return problem("AUTH_001", lang, 400);
      const err = validateCni(body);
      if (err) {
        return json(
          {
            type: "https://docs.kangopenbanking.com/errors/validation",
            title: lang.startsWith("fr") ? "Requête invalide" : "Invalid request",
            status: 400,
            detail: err,
          },
          {
            status: 400,
            headers: { "Content-Type": "application/problem+json", "Content-Language": lang.startsWith("fr") ? "fr" : "en" },
          },
        );
      }
      const result = resolveIdentityStub({
        country: body.country,
        id: body.cni_number,
        holderName: [body.holder_first_name, body.holder_last_name].filter(Boolean).join(" ") || undefined,
      });
      if (!result) return problem("KYC_001", lang, 404);
      return json(result, { headers: { "Content-Language": lang.startsWith("fr") ? "fr" : "en" } });
    }

    return json(
      { type: "https://docs.kangopenbanking.com/errors/not-found", title: "Not found", status: 404, path: pathname },
      { status: 404, headers: { "Content-Type": "application/problem+json", "Content-Language": "en" } },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return json(
      { type: "https://docs.kangopenbanking.com/errors/internal", title: "Internal error", status: 500, detail },
      { status: 500, headers: { "Content-Type": "application/problem+json" } },
    );
  }
});
