import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTenant } from './TenantProvider';
import type { WalkthroughConfig } from './TenantProvider';
import { Building2 } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
  /** Optional branding overrides — if not provided, falls back to useTenant() */
  name?: string;
  logoUrl?: string | null;
  tagline?: string | null;
  walkthroughConfig?: WalkthroughConfig;
  isLoading?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  duration = 2000,
  name: propName,
  logoUrl: propLogoUrl,
  tagline: propTagline,
  walkthroughConfig: propWConfig,
  isLoading: propIsLoading,
}) => {
  // Fall back to Banking App tenant context if no props provided
  const tenant = useTenant();

  const name = propName ?? tenant.name;
  const logoUrl = propLogoUrl !== undefined ? propLogoUrl : tenant.logoUrl;
  const tagline = propTagline !== undefined ? propTagline : tenant.tagline;
  const wConfig = propWConfig ?? tenant.walkthroughConfig ?? {};
  const isLoading = propIsLoading ?? tenant.isLoading;

  useEffect(() => {
    const timer = setTimeout(onComplete, duration);
    return () => clearTimeout(timer);
  }, [onComplete, duration]);

  const bgStyle: React.CSSProperties = {};
  if (wConfig.accent_color) bgStyle.backgroundColor = wConfig.accent_color;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
      style={bgStyle}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
        className="flex flex-col items-center gap-6"
      >
        {(wConfig.logo_url || logoUrl) ? (
          <img
            src={wConfig.logo_url || logoUrl!}
            alt={name}
            className="h-20 w-20 rounded-2xl object-contain bg-primary-foreground p-2"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground">
            <Building2 className="h-10 w-10 text-primary" strokeWidth={1.5} />
          </div>
        )}

        <motion.h1
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-semibold tracking-tight text-primary-foreground"
        >
          {isLoading ? '' : name}
        </motion.h1>

        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-primary-foreground/70"
        >
          {isLoading ? '' : tagline}
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-12"
      >
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-primary-foreground/50"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};
