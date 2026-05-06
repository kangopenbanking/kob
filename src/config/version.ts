/**
 * Single source of truth for the displayed API/portal version.
 *
 * To bump the version after a spec release, change ONLY this constant.
 * Every developer-portal surface (footer, hero, SDK section, changelog,
 * sandbox overview, status badge link) reads from here.
 *
 * The CI gate `scripts/check-openapi-version.mjs` enforces parity between
 * this value, `public/openapi.json` info.version, and `public/changelog.json`
 * apiVersion.
 */
export const KOB_API_VERSION = "4.31.0";
export const KOB_API_VERSION_LABEL = `v${KOB_API_VERSION}`;

/** Public status page URL — referenced by the developer portal status badge. */
export const KOB_STATUS_PAGE_URL = "https://status.kangopenbanking.com";
