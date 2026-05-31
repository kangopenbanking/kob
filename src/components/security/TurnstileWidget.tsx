import { forwardRef } from 'react';

/**
 * TurnstileWidget — invisible/managed Cloudflare Turnstile mount point.
 *
 * Pair with `useTurnstile()`:
 *
 *   const { containerRef, getToken, enabled } = useTurnstile({ action: 'developer_register' });
 *   ...
 *   <TurnstileWidget containerRef={containerRef} enabled={enabled} />
 *
 * Renders nothing visible when the site key is not configured.
 */
export interface TurnstileWidgetProps {
  containerRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
  className?: string;
}

export const TurnstileWidget = forwardRef<HTMLDivElement, TurnstileWidgetProps>(
  ({ containerRef, enabled, className }, _ref) => {
    if (!enabled) return null;
    return (
      <div
        ref={containerRef}
        className={className ?? 'cf-turnstile-mount min-h-[1px]'}
        data-testid="turnstile-widget"
      />
    );
  },
);

TurnstileWidget.displayName = 'TurnstileWidget';
