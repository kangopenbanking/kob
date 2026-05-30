/**
 * ScreenshotGuard — list of route patterns that contain financial
 * information and must be hardened against capture.
 *
 * COMPREHENSIVE COVERAGE: every authenticated route in the Consumer and
 * Banking PWAs that renders balances, account numbers, transfer flows,
 * statements, card details, savings, loans, credit, or remittances.
 *
 * Patterns are matched with React Router's `matchPath` (end=false), so
 * trailing `/*` is implicit — listing the parent route also protects
 * sub-routes unless `STRICT_PATTERNS` is enabled.
 */
export const FINANCIAL_ROUTE_PATTERNS: string[] = [
  // =============================================================
  // Consumer PWA (/app)
  // =============================================================
  // Dashboard & money movement
  "/app/home",
  "/app/activity",
  "/app/transfer",
  "/app/request",
  "/app/scan",
  "/app/cash-out",
  "/app/send-abroad",
  "/app/fund-wallet",
  "/app/pay-by-bank",
  "/app/pay-by-bank/*",

  // Accounts & cards
  "/app/bank",
  "/app/linked-accounts",
  "/app/linked-accounts/*",
  "/app/cards",
  "/app/cards/*",

  // Statements, bills & invoices
  "/app/bills",
  "/app/invoices",
  "/app/invoices/*",
  "/app/pay-links",
  "/app/pay-links/*",
  "/app/split-bills",
  "/app/split-bills/*",
  "/app/recurring",
  "/app/recurring/*",

  // Savings, goals, lending
  "/app/piggybank",
  "/app/piggybank/*",
  "/app/njangi",
  "/app/njangi/*",
  "/app/savings-vault",
  "/app/savings-vault/*",
  "/app/loans",
  "/app/loans/*",
  "/app/credit-score",
  "/app/credit-score/*",
  "/app/rent-reporting",
  "/app/rent-reporting/*",

  // International / remittances / marketplace payouts
  "/app/remittances",
  "/app/remittances/*",
  "/app/travel",
  "/app/travel/*",

  // Approvals / Open Banking consents that reveal account data
  "/app/approvals",
  "/app/approvals/*",
  "/app/consents",
  "/app/consents/*",

  // =============================================================
  // Banking PWA (/bank/:institutionId)
  // =============================================================
  "/bank/:institutionId/home",
  "/bank/:institutionId/payments",
  "/bank/:institutionId/payments/*",
  "/bank/:institutionId/cards",
  "/bank/:institutionId/cards/*",
  "/bank/:institutionId/history",
  "/bank/:institutionId/fund",
  "/bank/:institutionId/more/savings",
  "/bank/:institutionId/more/savings/*",
  "/bank/:institutionId/more/loans",
  "/bank/:institutionId/more/loans/*",
  "/bank/:institutionId/more/credit",
  "/bank/:institutionId/more/credit/*",
  "/bank/:institutionId/more/remittances",
  "/bank/:institutionId/more/remittances/*",
  "/bank/:institutionId/more/disputes",
];

/**
 * Routes that explicitly OPT OUT of the screenshot guard even when their
 * parent path matches one of the patterns above. Useful for help pages,
 * support chats, and onboarding screens that legitimately need to be
 * shareable as a screenshot (e.g. by a support agent).
 */
export const SCREENSHOT_GUARD_OPT_OUT: string[] = [
  "/app/more/help",
  "/app/more/help/*",
  "/app/more/support",
  "/app/more/support/*",
  "/bank/:institutionId/more/help",
  "/bank/:institutionId/more/help/*",
  "/bank/:institutionId/more/support",
  "/bank/:institutionId/more/support/*",
];

/**
 * Maps a pathname to the analytics/app context. Used by the capture-event
 * reporter to tag records correctly in the audit log.
 */
export function appContextForPath(pathname: string): "consumer" | "banking" {
  return pathname.startsWith("/bank/") ? "banking" : "consumer";
}
