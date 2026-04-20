import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Monitor, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const NOTICE_KEY = 'biz-travel-wide-screen-notice-dismissed';

/**
 * Wraps all /biz/travel/* sub-routes.
 *
 * Adds:
 *  - Consistent mobile padding (sub-pages were rendered edge-to-edge).
 *  - A dismissible advisory notice on small screens recommending a
 *    tablet/desktop for the richer Travel management workflows.
 */
export const BusinessTravelLayout: React.FC = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(NOTICE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch {}
    setDismissed(true);
  };

  // Only show notice on actual sub-pages (not the index /biz/travel)
  const isIndex = location.pathname.replace(/\/$/, '') === '/biz/travel';
  const showNotice = isMobile && !dismissed && !isIndex;

  return (
    <div className="px-4 pt-3 pb-24 md:px-0 md:pt-0 md:pb-0">
      {showNotice && (
        <div
          role="status"
          className="mb-4 flex items-start gap-3 rounded-2xl border border-border/50 bg-muted/40 p-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background border border-border/40">
            <Monitor className="h-4 w-4 text-foreground" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              Best on a wider screen
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Travel management uses tables and forms designed for tablet, laptop, or
              desktop. You can continue here, but for the smoothest experience switch
              to a larger device.
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss notice"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
};

export default BusinessTravelLayout;
