/**
 * ScreenshotGuard — list of route patterns that contain financial information
 * and must be hardened against casual screenshot capture.
 *
 * NOTE FOR FUTURE EDITORS:
 * Web/PWA platforms cannot *actually* block OS-level screenshots — only
 * native iOS/Android apps can (FLAG_SECURE / isCaptured). This list drives
 * a layered DETERRENT only:
 *   - diagonal forensic watermark (holder name + last-4 of user id + ts)
 *   - PrintScreen / capture-shortcut interception (clipboard + warning)
 *   - blur-on-blur / blur-on-visibility-hide
 *   - disabled right-click / long-press / copy / drag on the subtree
 *
 * Patterns are matched with React Router's `matchPath`. Use trailing `/*`
 * for sub-trees and leave exact paths bare.
 */
export const FINANCIAL_ROUTE_PATTERNS: string[] = [
  // ---- Consumer PWA (/app) ------------------------------------------
  "/app/home",
  "/app/activity",
  "/app/linked-accounts",
  "/app/bank",
  "/app/transfer",
  "/app/cash-out",
  "/app/cards",
  "/app/cards/*",
  "/app/bills",
  "/app/invoices",
  "/app/pay-links",
  "/app/split-bills",
  "/app/recurring",
  "/app/piggybank",
  "/app/njangi",
  "/app/savings-vault",
  "/app/credit-score",
  "/app/remittances",
  "/app/remittances/*",
  "/app/send-abroad",
  "/app/fund-wallet",

  // ---- Banking PWA (/bank/:institutionId) ---------------------------
  "/bank/:institutionId/home",
  "/bank/:institutionId/payments",
  "/bank/:institutionId/payments/*",
  "/bank/:institutionId/cards",
  "/bank/:institutionId/history",
  "/bank/:institutionId/fund",
  "/bank/:institutionId/more/savings",
  "/bank/:institutionId/more/savings/*",
  "/bank/:institutionId/more/loans",
  "/bank/:institutionId/more/credit",
  "/bank/:institutionId/more/remittances",
];
