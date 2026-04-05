/**
 * HealthBanner — Shows API health status for all three apps
 * 
 * Full-screen overlay when unhealthy (503)
 * Dismissible amber banner when degraded
 */

import React, { useState, useEffect } from 'react';
import { checkHealth, type HealthStatus } from '@/lib/kob-api-client';
import { AlertTriangle, X, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const HealthBanner: React.FC = () => {
  const [status, setStatus] = useState<HealthStatus>('healthy');
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const result = await checkHealth();
        if (mounted) setStatus(result);
      } catch {
        if (mounted) setStatus('unhealthy');
      }
    };

    check();

    // Re-check every 60 seconds
    const interval = setInterval(check, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const result = await checkHealth();
      setStatus(result);
      if (result === 'healthy') setDismissed(false);
    } catch {
      setStatus('unhealthy');
    } finally {
      setChecking(false);
    }
  };

  // Unhealthy — full-screen maintenance overlay
  if (status === 'unhealthy') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-md text-center px-6">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2 border-destructive/30 bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={1.5} />
          </div>
          <h1 className="mb-2 text-xl font-bold text-foreground">Service Temporarily Unavailable</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            We are performing scheduled maintenance. Services will be restored shortly.
          </p>
          <Button variant="outline" onClick={handleRetry} disabled={checking}>
            {checking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
            )}
            Check Again
          </Button>
        </div>
      </div>
    );
  }

  // Degraded — dismissible amber banner
  if (status === 'degraded' && !dismissed) {
    return (
      <div className="relative flex items-center justify-between gap-3 border-b border-[hsl(40,80%,60%)]/30 bg-[hsl(40,80%,95%)] px-4 py-2.5 dark:bg-[hsl(40,40%,15%)]">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[hsl(40,80%,40%)]" strokeWidth={1.5} />
          <p className="text-xs font-medium text-[hsl(40,60%,25%)] dark:text-[hsl(40,60%,70%)]">
            Some services are experiencing degraded performance. We are working on it.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 hover:bg-[hsl(40,50%,85%)] transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="h-3.5 w-3.5 text-[hsl(40,60%,35%)]" strokeWidth={1.5} />
        </button>
      </div>
    );
  }

  return null;
};
