import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Palette, Key, MapPin, Users, ScanLine, BarChart3, Clock,
  ChevronRight, Crown, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const enterpriseFeatures = [
  {
    icon: Palette,
    label: 'Custom Branding',
    subtitle: 'White-label your app with custom colors, logos & domain',
    path: '/biz/storefront',
    available: true,
  },
  {
    icon: Key,
    label: 'API Key Management',
    subtitle: 'Create, rotate & manage API credentials',
    path: '/biz/api-keys',
    available: true,
  },
  {
    icon: MapPin,
    label: 'Multi-Location',
    subtitle: 'Manage inventory & staff across locations',
    path: '/biz/inventory',
    available: true,
  },
  {
    icon: Users,
    label: 'Subaccounts',
    subtitle: 'Create & manage merchant subaccounts',
    path: '/biz/subaccounts',
    available: true,
  },
  {
    icon: ScanLine,
    label: 'Barcode Scanner',
    subtitle: 'Camera-based SKU & barcode scanning for POS',
    path: '/biz/till',
    available: true,
  },
  {
    icon: Clock,
    label: 'Shift Management',
    subtitle: 'Staff shifts, cash drawer tracking & end-of-day',
    path: '/biz/till',
    available: true,
  },
  {
    icon: BarChart3,
    label: 'Advanced Analytics',
    subtitle: 'Detailed reports, exports & custom dashboards',
    path: '/biz/analytics',
    available: true,
  },
];

export default function BusinessEnterprise() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { merchantId } = useMerchantContext();

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <header className="pt-4 md:pt-0 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Enterprise</h1>
          <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600">
            <Crown className="h-3 w-3" /> PRO
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-medium mt-0.5">Advanced tools for growing businesses</p>
      </header>

      {/* Hero Banner */}
      <div className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Enterprise Package</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Unlock advanced features including custom branding, multi-location management,
              API integrations, shift tracking, and more. Perfect for scaling businesses.
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className={cn('gap-3', isMobile ? 'space-y-2' : 'grid grid-cols-2 gap-3')}>
        {enterpriseFeatures.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.button
              key={feature.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                'w-full rounded-2xl border border-border/40 bg-card p-4 flex items-center gap-3.5 text-left transition-colors',
                feature.available ? 'hover:bg-muted/40 active:bg-muted/60' : 'opacity-60 cursor-not-allowed'
              )}
              onClick={() => feature.available && navigate(feature.path)}
              disabled={!feature.available}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <Icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-foreground">{feature.label}</p>
                  {!feature.available && <Lock className="h-3 w-3 text-muted-foreground" />}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{feature.subtitle}</p>
              </div>
              {feature.available && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" strokeWidth={2} />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
