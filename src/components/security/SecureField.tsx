/**
 * SecureField — per-component allowlist wrapper for sensitive content
 * (balances, full account numbers, IBAN/RIB, statement amounts).
 *
 * Wrapping a component in <SecureField> applies a defence-in-depth layer
 * even when the page-level ScreenshotGuard is active:
 *   - Marks the subtree with `data-secure-field` so screen-recording
 *     overlays and content-blockers can target it.
 *   - Disables text selection, copy, drag, right-click, and long-press.
 *   - Applies a CSS class that *visually* dims and slightly blurs the
 *     subtree when the document is hidden / blurred (works in tandem
 *     with the page-level mask but also on pages without ScreenshotGuard).
 *   - Optional `mask` prop renders a masked placeholder until the user
 *     opts in (see <BalanceReveal/> for the tap-to-reveal pattern).
 */
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SecureFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional masked placeholder shown until `revealed` is true. */
  mask?: ReactNode;
  /** When false and `mask` is provided, the masked placeholder renders instead of `children`. */
  revealed?: boolean;
  /** Override the field name reported in analytics/audit metadata. */
  field?: string;
  children: ReactNode;
}

export const SecureField = forwardRef<HTMLDivElement, SecureFieldProps>(function SecureField(
  { className, children, mask, revealed = true, field, onContextMenu, onCopy, onDragStart, ...rest },
  ref,
) {
  const showMask = mask !== undefined && !revealed;

  return (
    <div
      {...rest}
      ref={ref}
      data-secure-field={field ?? "true"}
      data-revealed={revealed ? "1" : "0"}
      className={cn(
        // Disable selection, callout, drag.
        "select-none [-webkit-touch-callout:none] [-webkit-user-drag:none]",
        // Dim when document is hidden (works with the ScreenshotGuard CSS).
        "[html[data-kob-secure-hide='1']_&]:blur-md",
        className,
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      onCopy={(e) => {
        e.preventDefault();
        try { e.clipboardData?.setData("text/plain", ""); } catch { /* noop */ }
        onCopy?.(e);
      }}
      onDragStart={(e) => {
        e.preventDefault();
        onDragStart?.(e);
      }}
    >
      {showMask ? mask : children}
    </div>
  );
});
