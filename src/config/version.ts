/**
 * Single source of truth for the displayed API/portal version.
 *
 * To bump the version after a spec release, change ONLY this constant.
 * Every developer-portal surface (footer, hero, SDK section, changelog,
 * sandbox overview, status badge link) reads from here.
 *
 * The CI gates `scripts/check-openapi-version.mjs` and
 * `scripts/check-version-sync.mjs` enforce parity between this value,
 * `public/openapi.json` info.version, and `public/changelog.json` apiVersion.
export const KOB_API_VERSION = "4.44.0";
export const KOB_API_VERSION_LABEL = `v${KOB_API_VERSION}`;
/** Postman collection version — kept in lockstep with the API spec. */
export const KOB_POSTMAN_VERSION = "4.44.0";
/** ISO date of the current spec release. */
export const KOB_SPEC_DATE = "2026-05-29";

/** Canonical SDK versions surfaced on the developer portal. */
export const KOB_SDK_VERSIONS = {
  node: "1.6.1",
  python: "1.6.1",
  php: "1.6.1",
  go: "1.6.1",
  java: KOB_API_VERSION,
  ruby: "community",
} as const;

/** Public status page URL — referenced by the developer portal status badge. */
export const KOB_STATUS_PAGE_URL = "https://status.kangopenbanking.com";
