import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, FileText, Package, ShoppingBag, Wallet, Monitor, ScanLine,
  Users, BarChart3, Store, Settings, Shield, Truck, Tag, Star,
  LogOut, Crown, MessageCircle, Receipt, Banknote, Repeat, Link2,
  Key, Webhook, AlertCircle, Bell, Layers, Palette, MapPin, FileCheck,
  Briefcase, ListChecks, FileBarChart, ShieldCheck, History, Globe, QrCode,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import kangLogo from '@/assets/kang-logo.png';

const basePath = '/biz';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: Home, path: `${basePath}/home` },
      { label: 'Analytics', icon: BarChart3, path: `${basePath}/analytics` },
      { label: 'Advanced Analytics', icon: FileBarChart, path: `${basePath}/advanced-analytics` },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Orders', icon: FileText, path: `${basePath}/orders` },
      { label: 'Products', icon: Package, path: `${basePath}/products` },
      { label: 'Inventory', icon: ShoppingBag, path: `${basePath}/inventory` },
      { label: 'Customers', icon: Users, path: `${basePath}/customers` },
      { label: 'Refunds', icon: Receipt, path: `${basePath}/refunds` },
      { label: 'Disputes', icon: AlertCircle, path: `${basePath}/disputes` },
    ],
  },
  {
    title: 'Payments',
    items: [
      { label: 'Wallet', icon: Wallet, path: `${basePath}/wallet` },
      { label: 'Receive', icon: ScanLine, path: `${basePath}/receive` },
      { label: 'My QR Code', icon: QrCode, path: `${basePath}/qr-code` },
      { label: 'POS Till', icon: Monitor, path: `${basePath}/till` },
      { label: 'Transactions', icon: History, path: `${basePath}/transactions` },
      { label: 'Payment Links', icon: Link2, path: `${basePath}/payment-links` },
      { label: 'Fees', icon: Banknote, path: `${basePath}/fees` },
    ],
  },
  {
    title: 'Payouts & Settlement',
    items: [
      { label: 'Payouts', icon: Banknote, path: `${basePath}/payouts` },
      { label: 'Settlements', icon: FileBarChart, path: `${basePath}/settlements` },
      { label: 'Settlement Accounts', icon: Briefcase, path: `${basePath}/settlement-accounts` },
      { label: 'Subaccounts', icon: Layers, path: `${basePath}/subaccounts` },
      { label: 'Escrow', icon: Shield, path: `${basePath}/escrow` },
      { label: 'Fund Wallet', icon: Wallet, path: `${basePath}/fund-wallet` },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Storefront', icon: Store, path: `${basePath}/storefront` },
      { label: 'Coupons', icon: Tag, path: `${basePath}/coupons` },
      { label: 'Reviews', icon: Star, path: `${basePath}/reviews` },
      { label: 'Branding', icon: Palette, path: `${basePath}/branding` },
      { label: 'White-Label', icon: Globe, path: `${basePath}/white-label` },
    ],
  },
  {
    title: 'Subscriptions',
    items: [
      { label: 'Subscriptions', icon: Repeat, path: `${basePath}/subscriptions` },
      { label: 'Plans', icon: ListChecks, path: `${basePath}/plans` },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Staff', icon: Users, path: `${basePath}/staff` },
      { label: 'Locations', icon: MapPin, path: `${basePath}/locations` },
      { label: 'Travel', icon: Truck, path: `${basePath}/travel` },
      { label: 'Bulk Operations', icon: Layers, path: `${basePath}/bulk-operations` },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'API Keys', icon: Key, path: `${basePath}/api-keys` },
      { label: 'Webhooks', icon: Webhook, path: `${basePath}/webhooks` },
      { label: 'Webhook Logs', icon: History, path: `${basePath}/webhook-logs` },
      { label: 'Woo Sync', icon: Repeat, path: `${basePath}/woo-sync` },
    ],
  },
  {
    title: 'Trust & Compliance',
    items: [
      { label: 'Trust Score', icon: ShieldCheck, path: `${basePath}/trust-score` },
      { label: 'Compliance', icon: Shield, path: `${basePath}/compliance` },
      { label: 'KYB', icon: FileCheck, path: `${basePath}/kyb` },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Support Chat', icon: MessageCircle, path: `${basePath}/support` },
      { label: 'Notifications', icon: Bell, path: `${basePath}/notifications` },
      { label: 'Notification History', icon: History, path: `${basePath}/notification-history` },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', icon: Settings, path: `${basePath}/settings` },
      { label: 'Profile', icon: Users, path: `${basePath}/profile` },
      { label: 'Enterprise', icon: Crown, path: `${basePath}/enterprise` },
    ],
  },
];

export const BusinessDesktopSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/biz/auth', { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/40 [&_[data-sidebar=sidebar]]:bg-primary [&_[data-sidebar=sidebar]]:text-primary-foreground">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <img src={kangLogo} alt="Kang Business" className="h-6 w-6 rounded-lg object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">Kang Business</p>
              <p className="text-[10px] text-white/60">Merchant Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        className={cn(
                          'rounded-xl transition-all',
                          active
                            ? 'bg-white/20 text-white font-medium'
                            : 'text-white/70 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2 : 1.6} />
                        {!collapsed && <span>{item.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-xl text-white/70 hover:bg-red-500/20 hover:text-red-200"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.6} />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
