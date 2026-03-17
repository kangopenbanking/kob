import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, FileText, Package, ShoppingBag, Wallet, Monitor, ScanLine,
  Users, BarChart3, Store, Settings, Shield, Truck, Tag, Star,
  ChevronRight, LogOut, Building2, Crown,
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
    ],
  },
  {
    title: 'Commerce',
    items: [
      { label: 'Orders', icon: FileText, path: `${basePath}/orders` },
      { label: 'Products', icon: Package, path: `${basePath}/products` },
      { label: 'Inventory', icon: ShoppingBag, path: `${basePath}/inventory` },
      { label: 'Customers', icon: Users, path: `${basePath}/customers` },
    ],
  },
  {
    title: 'Payments',
    items: [
      { label: 'Wallet', icon: Wallet, path: `${basePath}/wallet` },
      { label: 'Receive', icon: ScanLine, path: `${basePath}/receive` },
      { label: 'POS Till', icon: Monitor, path: `${basePath}/till` },
      { label: 'Refunds', icon: FileText, path: `${basePath}/refunds` },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Storefront', icon: Store, path: `${basePath}/storefront` },
      { label: 'Coupons', icon: Tag, path: `${basePath}/coupons` },
      { label: 'Reviews', icon: Star, path: `${basePath}/reviews` },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Staff', icon: Users, path: `${basePath}/staff` },
      { label: 'Travel', icon: Truck, path: `${basePath}/travel` },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', icon: Settings, path: `${basePath}/settings` },
      { label: 'Compliance', icon: Shield, path: `${basePath}/compliance` },
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
    <Sidebar collapsible="icon" className="border-r border-border/40">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <img src={kangLogo} alt="Kang Business" className="h-6 w-6 rounded-lg object-contain" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">Kang Business</p>
              <p className="text-[10px] text-muted-foreground">Merchant Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
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
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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
              className="rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
