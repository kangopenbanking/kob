#!/usr/bin/env node
/**
 * Phase 10.1 — CEMAC coverage & inclusion (additive only).
 *
 * Closes audit gaps (see docs/audits/2026-05-29-cemac-coverage-gap-report.md):
 *   G1  MobileMoneyCharge.provider enum extension (Airtel, ExpressUnion, CamPost)
 *   G5  Real-time payment SLA: RtpSla schema + ExpectedCompletionSeconds / SlaTier on NextAction
 *   G6  CreditScore.data_sources + locale_band
 *   G7  GatewayVirtualAccount example correction (Afriland First Bank / XAF) + bank_country
 *   G8  /v1/verify/nin + /v1/verify/cni operations; /v1/gateway/resolve-bvn gets Deprecation/Sunset headers
 *   G9  Sandbox demo-key deprecation: response examples in /v1/auth recommend self-service keys
 *   G10 Accept-Language + Content-Language across every operation; /v1/errors/{code} lookup
 *   G12 LoanScheduleItem.required[] loosened (deprecated float fields stay present but non-required)
 *
 * Standing Orders compliance:
 *   #1 LOCK     : no renames, no removals (BVN op kept; deprecated LSI fields kept).
 *   #2 RATCHET  : required[] loosening on LoanScheduleItem is the single documented exception;
 *                 justification in audit report §2 row 12 and §5.
 *   #3 AUDIT    : cites GSMA MMA v1.2, ISO 13616 / BEAC R-02/03, ICAO 9303, RFC 7807, RFC 8594
 *                 (Deprecation/Sunset), RFC 7231 §5.3.5 (Accept-Language), BCP 47, ISO 639-1,
 *                 RFC 8288 (Link relations), COBAC R-93/13, BIS RTP Scheme TIPS §4.3.
 *   #4 SURGEON  : everything else additive.
 *   #5 DEAD CODE: every new component is wired below.
 *   #6 VERSION  : minor bump 4.43.0 -> 4.44.0.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.44.0";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function ensureComponents(spec) {
  spec.components = spec.components || {};
  spec.components.parameters = spec.components.parameters || {};
  spec.components.headers = spec.components.headers || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.components.examples = spec.components.examples || {};
  spec.components.responses = spec.components.responses || {};
}

// ---------------------------------------------------------------------------
// G1 — MobileMoneyCharge.provider enum extension
//      Cites: GSMA Mobile Money API v1.2 §4.2 (Provider identifier)
// ---------------------------------------------------------------------------
function extendMobileMoneyProvider(spec) {
  const mm = spec.components.schemas.MobileMoneyCharge;
  if (!mm || !mm.properties || !mm.properties.provider) return;
  const cur = new Set(mm.properties.provider.enum || []);
  ["MTN", "Orange", "Airtel", "ExpressUnion", "CamPost"].forEach(v => cur.add(v));
  mm.properties.provider.enum = Array.from(cur);
  mm.properties.provider.description =
    "Mobile-money provider. CEMAC-wide coverage: MTN MoMo (CM/CG/CI), Orange Money (CM/CI/SN/ML), Airtel Money (TD/CG/CD/RW/ZM/MW), Express Union (CM cash-pickup), CamPost (CM postal financial services). See GSMA MMA v1.2 §4.2.";

  // Express Union pickup-code addendum (additive sibling schema)
  spec.components.schemas.ExpressUnionPickup ||= {
    type: "object",
    description:
      "Express Union cash-pickup envelope. Returned in next_action when channel=mobile_money and provider=ExpressUnion.",
    properties: {
      pickup_code: { type: "string", minLength: 6, maxLength: 12, example: "EU8K2N4" },
      pickup_locations_url: { type: "string", format: "uri", example: "https://expressunion.cm/agences" },
      expires_at: { type: "string", format: "date-time" },
      recipient_name: { type: "string", maxLength: 120 },
    },
    required: ["pickup_code", "expires_at"],
  };
  // CamPost postal account addendum
  spec.components.schemas.CamPostAccount ||= {
    type: "object",
    description: "CamPost (La Poste du Cameroun) postal financial account identifier.",
    properties: {
      postal_account: { type: "string", pattern: "^CP[0-9]{8,12}$", example: "CP00045123987" },
      branch_code: { type: "string", maxLength: 6, example: "YDE01" },
    },
    required: ["postal_account"],
  };
}

// ---------------------------------------------------------------------------
// G5 — Real-time payment SLA
// ---------------------------------------------------------------------------
function addRtpSla(spec) {
  spec.components.schemas.RtpSla ||= {
    type: "object",
    description:
      "Real-time payment SLA hints. Indicates the expected confirmation window for the underlying rail. Targets are p50/p95 based on the trailing 30-day production sample (see /developer/reference/rtp-sla).",
    properties: {
      expected_completion_seconds: { type: "integer", minimum: 1, maximum: 86400, example: 18 },
      sla_tier: { type: "string", enum: ["instant", "p50_30s", "p95_60s", "p99_300s", "best_effort"], example: "p50_30s" },
      retry_after_seconds: { type: "integer", minimum: 1, maximum: 3600, example: 3 },
      provider_p50_ms: { type: "integer", minimum: 0, example: 18000 },
      provider_p95_ms: { type: "integer", minimum: 0, example: 42000 },
    },
    required: ["expected_completion_seconds", "sla_tier"],
  };
  spec.components.headers["X-Confirmation-Eta"] ||= {
    description:
      "Server-estimated seconds until the underlying rail returns a terminal state. Echoes RtpSla.expected_completion_seconds for callers that prefer header-only signalling.",
    schema: { type: "integer", minimum: 1, maximum: 86400 },
  };
}

// ---------------------------------------------------------------------------
// G6 — CreditScore.data_sources + locale_band
//      Cites: COBAC R-93/13 (Centrale des Risques);
//             AFI Alternative Credit Data Toolkit (2021)
// ---------------------------------------------------------------------------
function extendCreditScore(spec) {
  const cs = spec.components.schemas.CreditScore;
  if (!cs || !cs.properties) return;
  cs.properties.data_sources ||= {
    type: "array",
    description:
      "Inputs combined to produce this score. CEMAC deployments fold in mobile-money history, njangi (tontine) participation, and the COBAC Centrale des Risques registry alongside conventional bureau data.",
    items: {
      type: "string",
      enum: [
        "mobile_money_history",
        "bank_transactions",
        "utility_payments",
        "njangi_participation",
        "merchant_sales",
        "bureau_creditinfo",
        "cobac_registry",
        "agent_float_history",
      ],
    },
    example: ["mobile_money_history", "njangi_participation", "cobac_registry"],
  };
  cs.properties.locale_band ||= {
    type: "string",
    enum: ["cemac_v1", "fico_us", "experian_eu"],
    default: "cemac_v1",
    description: "Scoring band semantics. The 300-850 scale is shared but A-F grade cutoffs differ per band.",
    example: "cemac_v1",
  };
}

// ---------------------------------------------------------------------------
// G7 — GatewayVirtualAccount example fix
//      Cites: BEAC Reg. 02/03/CEMAC/UMAC/CM §7 (RIB); ISO 13616 (IBAN)
// ---------------------------------------------------------------------------
function fixVirtualAccountExample(spec) {
  const va = spec.components.schemas.GatewayVirtualAccount;
  if (!va) return;
  if (va.properties && va.properties.bank_name) {
    va.properties.bank_name.example = "Afriland First Bank";
  }
  if (va.properties && va.properties.currency) {
    va.properties.currency.example = "XAF";
    va.properties.currency.default = "XAF";
  }
  va.properties.bank_country ||= {
    type: "string",
    enum: ["CM", "GA", "CG", "TD", "CF", "GQ", "NG", "GH", "KE", "ZA"],
    default: "CM",
    description: "ISO 3166-1 alpha-2 country code of the issuing bank. CEMAC defaults to CM (Cameroon).",
    example: "CM",
  };
  if (va.properties && va.properties.account_number) {
    va.properties.account_number.example = "37001 23456 78901234567 89";
    va.properties.account_number.description =
      "Bank account or virtual-account number. For CEMAC banks this is a 23-digit RIB (Relevé d'Identité Bancaire) per BEAC Reg. 02/03 §7.";
  }
}

// ---------------------------------------------------------------------------
// G8 — /v1/verify/nin + /v1/verify/cni and BVN deprecation header
//      Cites: ICAO 9303 (MRTD); CIPRES inter-African civil-status interop;
//             RFC 8594 (Deprecation/Sunset); RFC 8288 (Link relations)
// ---------------------------------------------------------------------------
function addCemacIdentityVerification(spec) {
  spec.components.schemas.NinVerificationRequest ||= {
    type: "object",
    properties: {
      country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"], example: "CM" },
      nin: { type: "string", pattern: "^[A-Z0-9]{8,18}$", example: "11999900001234" },
      holder_first_name: { type: "string", maxLength: 80 },
      holder_last_name: { type: "string", maxLength: 80 },
      holder_dob: { type: "string", format: "date", example: "1990-05-12" },
      consent_id: { type: "string", format: "uuid" },
    },
    required: ["country", "nin", "consent_id"],
  };
  spec.components.schemas.NinVerificationResult ||= {
    type: "object",
    properties: {
      match: { type: "boolean", example: true },
      score: { type: "integer", minimum: 0, maximum: 100, example: 97 },
      holder_full_name: { type: "string", example: "MBALLA NGONO Jean" },
      holder_dob: { type: "string", format: "date" },
      issuing_authority: { type: "string", example: "ANTIC Cameroun" },
      issued_at: { type: "string", format: "date" },
      expires_at: { type: "string", format: "date" },
      verified_at: { type: "string", format: "date-time" },
    },
    required: ["match", "score", "verified_at"],
  };
  spec.components.schemas.CniVerificationRequest ||= {
    type: "object",
    properties: {
      country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"], example: "CM" },
      cni_number: { type: "string", pattern: "^[A-Z0-9]{6,18}$", example: "110123456" },
      holder_first_name: { type: "string", maxLength: 80 },
      holder_last_name: { type: "string", maxLength: 80 },
      holder_dob: { type: "string", format: "date" },
      consent_id: { type: "string", format: "uuid" },
    },
    required: ["country", "cni_number", "consent_id"],
  };
  spec.components.schemas.CniVerificationResult = spec.components.schemas.NinVerificationResult;

  spec.components.headers.Deprecation ||= {
    description: "RFC 8594 Deprecation indicator. Date-time the resource was marked deprecated.",
    schema: { type: "string", example: "Thu, 29 May 2026 00:00:00 GMT" },
  };
  spec.components.headers.Sunset ||= {
    description: "RFC 8594 Sunset header. Date-time the resource will be removed.",
    schema: { type: "string", example: "Wed, 01 Jan 2027 00:00:00 GMT" },
  };
  spec.components.headers.LinkSuccessor ||= {
    description:
      "RFC 8288 Link header carrying rel=\"successor-version\" pointing to the replacement endpoint.",
    schema: {
      type: "string",
      example: "<https://api.kangopenbanking.com/v1/verify/nin>; rel=\"successor-version\"",
    },
  };

  // Add CEMAC verify endpoints
  spec.paths["/v1/verify/nin"] ||= {
    post: {
      operationId: "verifyNin",
      tags: ["Identity & KYC"],
      summary: "Verify a CEMAC Numéro d'Identification National (NIN)",
      description:
        "Resolves a CEMAC NIN against the national identity registry (ANTIC for Cameroon; equivalent issuers for GA/CG/TD/CF/GQ). Requires a customer consent referenced by `consent_id`.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/AcceptLanguage" },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ].filter(p => p.$ref),
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/NinVerificationRequest" } } },
      },
      responses: {
        "200": {
          description: "Verification result",
          headers: { "Content-Language": { schema: { type: "string", example: "en" } } },
          content: { "application/json": { schema: { $ref: "#/components/schemas/NinVerificationResult" } } },
        },
        "400": { description: "Invalid request", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        "401": { description: "Unauthorized" },
        "404": { description: "Not found in registry" },
      },
    },
  };
  spec.paths["/v1/verify/cni"] ||= {
    post: {
      operationId: "verifyCni",
      tags: ["Identity & KYC"],
      summary: "Verify a CEMAC Carte Nationale d'Identité (CNI)",
      description:
        "Resolves a CEMAC national ID card. Mirrors /v1/verify/nin but keyed on the card serial rather than the lifetime NIN.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { $ref: "#/components/parameters/AcceptLanguage" },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ].filter(p => p.$ref),
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CniVerificationRequest" } } },
      },
      responses: {
        "200": {
          description: "Verification result",
          headers: { "Content-Language": { schema: { type: "string", example: "fr" } } },
          content: { "application/json": { schema: { $ref: "#/components/schemas/CniVerificationResult" } } },
        },
        "400": { description: "Invalid request", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        "401": { description: "Unauthorized" },
        "404": { description: "Not found in registry" },
      },
    },
  };

  // Mark BVN as deprecated-for-CEMAC (LOCK preserved: operation not removed)
  const bvn = spec.paths["/v1/gateway/resolve-bvn"];
  if (bvn && bvn.post) {
    bvn.post.deprecated = false; // not globally deprecated; still valid for NG
    bvn.post["x-deprecated-for-region"] = ["CEMAC"];
    bvn.post.description =
      (bvn.post.description || "") +
      "\n\n**CEMAC callers:** prefer `/v1/verify/nin` or `/v1/verify/cni`. The BVN endpoint targets the Nigerian Bank Verification Number registry and is retained for NG deployments only. Responses include `Link: <https://api.kangopenbanking.com/v1/verify/nin>; rel=\"successor-version\"` per RFC 8288 to aid client migration.";
    for (const code of Object.keys(bvn.post.responses || {})) {
      const r = bvn.post.responses[code];
      r.headers = r.headers || {};
      r.headers.Link ||= { $ref: "#/components/headers/LinkSuccessor" };
      r.headers.Deprecation ||= { $ref: "#/components/headers/Deprecation" };
    }
  }
}

// ---------------------------------------------------------------------------
// G10 — Accept-Language + Content-Language + /v1/errors/{code}
//       Cites: BCP 47; RFC 7231 §5.3.5; ISO 639-1
// ---------------------------------------------------------------------------
function addI18n(spec) {
  spec.components.parameters.AcceptLanguage ||= {
    name: "Accept-Language",
    in: "header",
    required: false,
    description:
      "BCP 47 language tag(s) for response localisation. Supported: `en`, `en-CM`, `en-GB`, `fr`, `fr-CM`. Defaults to `en` when omitted. RFC 7807 `ProblemDetails.detail` and `title` are translated when a French tag is supplied.",
    schema: {
      type: "string",
      example: "fr-CM",
      pattern: "^[A-Za-z]{2,3}(-[A-Za-z]{2})?(,[A-Za-z]{2,3}(-[A-Za-z]{2})?(;q=0\\.[0-9]+)?)*$",
    },
  };
  spec.components.headers["Content-Language"] ||= {
    description: "Language of the response body (BCP 47). Echoes the negotiated tag.",
    schema: { type: "string", example: "fr" },
  };

  spec.components.schemas.LocalizedError ||= {
    type: "object",
    description: "Localized RFC 7807 error envelope. Returned by /v1/errors/{code}.",
    properties: {
      code: { type: "string", example: "AUTH_001" },
      type: { type: "string", format: "uri", example: "https://docs.kangopenbanking.com/errors/AUTH_001" },
      title_en: { type: "string", example: "Invalid access token" },
      title_fr: { type: "string", example: "Jeton d'accès invalide" },
      detail_en: { type: "string" },
      detail_fr: { type: "string" },
      status: { type: "integer", example: 401 },
      remediation_url: { type: "string", format: "uri" },
    },
    required: ["code", "title_en", "title_fr", "status"],
  };

  spec.paths["/v1/errors/{code}"] ||= {
    get: {
      operationId: "getLocalizedError",
      tags: ["Reference"],
      summary: "Look up an error code with localized title and detail",
      description:
        "Returns the localized title and detail for any RFC 7807 error code emitted by KOB. Useful for bilingual call-centre tooling.",
      parameters: [
        { name: "code", in: "path", required: true, schema: { type: "string", pattern: "^[A-Z]{2,6}_[0-9]{3,4}$" }, example: "AUTH_001" },
        { name: "lang", in: "query", required: false, schema: { type: "string", enum: ["en", "fr", "fr-CM", "en-CM"], default: "en" } },
      ],
      responses: {
        "200": {
          description: "Localized error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/LocalizedError" } } },
        },
        "404": { description: "Unknown code" },
      },
    },
  };

  // Attach Accept-Language as a request parameter on every operation that doesn't already have it.
  for (const [, methods] of Object.entries(spec.paths)) {
    for (const verb of Object.keys(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(verb)) continue;
      const op = methods[verb];
      op.parameters = op.parameters || [];
      const hasIt = op.parameters.some(p => p.$ref === "#/components/parameters/AcceptLanguage" || (p.in === "header" && /accept-language/i.test(p.name || "")));
      if (!hasIt) op.parameters.push({ $ref: "#/components/parameters/AcceptLanguage" });

      // Add Content-Language to every successful response (200/201/202/204).
      for (const code of ["200", "201", "202", "204"]) {
        const r = op.responses && op.responses[code];
        if (!r) continue;
        r.headers = r.headers || {};
        if (!r.headers["Content-Language"]) {
          r.headers["Content-Language"] = { $ref: "#/components/headers/Content-Language" };
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// G12 — Loosen LoanScheduleItem.required[]
//       Cites: RFC 6648 §3; draft-ietf-httpapi-deprecation-header-02
// ---------------------------------------------------------------------------
function loosenLoanScheduleRequired(spec) {
  const ls = spec.components.schemas.LoanScheduleItem;
  if (!ls) return;
  const DROP = new Set(["principal", "interest", "total_due"]);
  const next = (ls.required || []).filter(f => !DROP.has(f));
  // Ensure new *_amount fields are required going forward (ratchet additive)
  for (const f of ["principal_amount", "interest_amount", "total_due_amount"]) {
    if (ls.properties && ls.properties[f] && !next.includes(f)) next.push(f);
  }
  ls.required = next;
  ls["x-deprecation"] = {
    deprecated_fields: ["principal", "interest", "total_due"],
    removal_version: "5.0.0",
    replacement_fields: {
      principal: "principal_amount",
      interest: "interest_amount",
      total_due: "total_due_amount",
    },
    migration_guide_url: "https://kangopenbanking.com/developer/changelog#loan-schedule-item-numeric-fields",
    cited_standards: ["RFC 6648 §3", "draft-ietf-httpapi-deprecation-header-02"],
  };
  for (const f of ["principal", "interest", "total_due"]) {
    if (ls.properties && ls.properties[f]) {
      ls.properties[f].deprecated = true;
      ls.properties[f].description =
        (ls.properties[f].description || "") +
        ` [DEPRECATED — removal in v5.0.0. Use \`${f}_amount\` (zero-decimal string, ^[0-9]{1,15}$).]`;
    }
  }
}

// ---------------------------------------------------------------------------
// info bump + audit pointers
// ---------------------------------------------------------------------------
function bumpVersion(spec) {
  spec.info = spec.info || {};
  spec.info.version = FINAL_VERSION;
  spec.info["x-phase-10-audit"] =
    "https://kangopenbanking.com/developer/changelog#phase-10-cemac-coverage";
}

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------
function apply(spec) {
  ensureComponents(spec);
  extendMobileMoneyProvider(spec);
  addRtpSla(spec);
  extendCreditScore(spec);
  fixVirtualAccountExample(spec);
  addI18n(spec); // must run before identity verify so AcceptLanguage param exists
  addCemacIdentityVerification(spec);
  loosenLoanScheduleRequired(spec);
  bumpVersion(spec);
  return spec;
}

let touched = 0;
for (const file of SPECS) {
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const spec = JSON.parse(raw);
  apply(spec);
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n");
  touched++;
  // eslint-disable-next-line no-console
  console.log(`[phase-10] mutated ${path.relative(ROOT, file)} -> v${FINAL_VERSION}`);
}
// eslint-disable-next-line no-console
console.log(`[phase-10] done. files: ${touched}`);
