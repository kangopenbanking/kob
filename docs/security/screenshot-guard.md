# ScreenshotGuard

ScreenshotGuard is the standard-tier deterrent layer that renders on
financial pages of the Consumer (`/app`) and Banking (`/bank/:institutionId`)
PWAs. Web/PWA platforms cannot block OS-level screenshots — only native
iOS/Android apps can (via `FLAG_SECURE`/`isCaptured`). This component
makes leaked screenshots traceable and discourages casual capture.

## What it does

- **Forensic watermark** — a diagonally-tiled SVG overlay stamped with
  the account holder's display name, the last 4 characters of their
  user id, and a UTC timestamp. Rendered at very low opacity so the UI
  stays readable while any screenshot remains traceable to the
  capturing account.
- **Capture shortcut interception** — PrintScreen, Cmd/Ctrl+Shift+3/4/5,
  Cmd/Ctrl+Shift+S, Cmd/Ctrl+P, Cmd/Ctrl+S, right-click, copy and drag
  are blocked on protected routes. The clipboard is wiped and a warning
  toast is shown.
- **Visibility blur** — the document is blurred the moment the tab loses
  focus or visibility (defeats iOS app-switcher previews and most
  screen-recording flows that briefly background the tab).
- **Native shell hardening** — when running inside the Capacitor shell,
  `SecureView.enable()` toggles `FLAG_SECURE` on Android and the iOS
  capture-blur overlay.
- **Audit logging** — every protected route mount emits a `guard:render`
  event into `security_capture_events`, alongside the existing
  `key:*` / `contextmenu` / `copy` / `visibility:hidden` / `blur` /
  `native:*` events. Admins can inspect these in
  `/admin/screenshot-guard` and `/admin/capture-events`.

## Route rules

The full allow / opt-out lists live in
[`src/components/security/screenshot-guard-config.ts`](../../src/components/security/screenshot-guard-config.ts).

### Protected (guard ON)
- Consumer: `/app/activity`, `/app/transfer`, `/app/request`,
  `/app/scan`, `/app/cash-out`, `/app/send-abroad`, `/app/fund-wallet`,
  `/app/pay-by-bank/**`, `/app/bank`, `/app/linked-accounts/**`,
  `/app/cards/**`, `/app/bills`, `/app/invoices/**`,
  `/app/pay-links/**`, `/app/split-bills/**`, `/app/recurring/**`,
  `/app/piggybank/**`, `/app/njangi/**`, `/app/savings-vault/**`,
  `/app/loans/**`, `/app/credit-score/**`, `/app/rent-reporting/**`,
  `/app/remittances/**`, `/app/travel/**`, `/app/approvals/**`,
  `/app/consents/**`.
- Banking: `/bank/:institutionId/{home,payments/**,cards/**,history,fund,more/{savings,loans,credit,remittances,disputes}/**}`.

### Excluded (guard OFF)
- `/app/home` — the home dashboard is intentionally excluded so the
  watermark does not appear on the most-viewed screen. All sub-pages
  with transactional detail remain protected.
- `SCREENSHOT_GUARD_OPT_OUT` — `/app/more/help/**`, `/app/more/support/**`
  and the banking equivalents. These pages legitimately need to be
  shareable as screenshots with support agents.

A regression test
[`src/components/security/__tests__/ScreenshotGuard.test.tsx`](../../src/components/security/__tests__/ScreenshotGuard.test.tsx)
asserts the guard is active on transfer / cards / savings / loans and
disabled on `/app/home`.

## Adjusting opacity (no redeploy)

Watermark opacity is stored in the public
`screenshot_guard_settings` table (singleton row, `id = 'global'`) and
served via the `screenshot-guard-settings` edge function. Admins can
change it live at **Admin → Payments & Settlements → ScreenshotGuard**
(`/admin/screenshot-guard`):

| Theme | Default | Recommended range |
| ----- | ------- | ----------------- |
| Light | `0.05`  | `0.03` – `0.10`   |
| Dark  | `0.03`  | `0.02` – `0.08`   |

New values are applied on the **next page mount** for every signed-in
session. There is no client cache TTL — values are fetched once per
session.

### Going below 0.03

Anything below `0.03` may become invisible on bright displays. Forensic
information is still embedded (zoom + contrast still recovers it), but
visual deterrence is effectively gone. Keep at or above `0.03` unless
you are deliberately running an invisible-watermark experiment.

## Audit log schema

`security_capture_events` columns used by ScreenshotGuard:

| Column        | Notes                                                  |
| ------------- | ------------------------------------------------------ |
| `kind`        | `guard:render`, `key:*`, `contextmenu`, `copy`, ...   |
| `pathname`    | The route the guard was active on                      |
| `app_context` | `consumer` or `banking`                                |
| `user_id`     | Resolved from the access token (NULL for anonymous)   |
| `trace_id`    | Per-request trace id supplied by the client            |
| `metadata`    | For `guard:render`, includes the rendered opacity      |

Admins can read all rows; users can read their own. Inserts are
rate-coalesced client-side (one POST per 1500 ms per `(kind, pathname)`)
so a busy session does not flood the table.
