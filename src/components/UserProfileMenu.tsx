import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  User, Settings, Shield, LogOut, LayoutDashboard,
  Building2, Code2, Store, ShieldCheck, Wallet,
} from "lucide-react";
import { toast } from "sonner";

interface UserProfileMenuProps {
  variant?: "admin" | "dashboard" | "developer" | "institution" | "merchant";
}

export type DashKey = "admin" | "merchant" | "developer" | "institution" | "personal";

interface DashOption {
  key: DashKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DASH_META: Record<DashKey, DashOption> = {
  admin:       { key: "admin",       label: "Admin Console",        path: "/admin",       icon: ShieldCheck },
  merchant:    { key: "merchant",    label: "Business (Merchant)",  path: "/merchant",    icon: Store },
  developer:   { key: "developer",   label: "Developer Portal",     path: "/developer",   icon: Code2 },
  institution: { key: "institution", label: "Institution / FI",     path: "/fi-portal",   icon: Building2 },
  personal:    { key: "personal",    label: "Personal",             path: "/dashboard",   icon: Wallet },
};

// Map profiles.account_type (registration choice) to a DashKey
function accountTypeToDash(t?: string | null): DashKey | null {
  if (!t) return null;
  const v = t.toLowerCase();
  if (v === "personal") return "personal";
  if (v === "merchant" || v === "business") return "merchant";
  if (v === "developer") return "developer";
  if (v === "institution" || v === "bank" || v === "fi") return "institution";
  if (v === "admin") return "admin";
  return null;
}

export interface ProfileMenuInputs {
  accountType?: string | null;
  roles?: string[];
  hasDeveloperOrg?: boolean;
  hasMerchant?: boolean;
  institution?: { status?: string | null; institution_type?: string | null } | null;
}

export function computeAvailableDashboards(input: ProfileMenuInputs): DashKey[] {
  const roleSet = new Set(input.roles ?? []);
  const dashes = new Set<DashKey>();
  if (roleSet.has("admin")) dashes.add("admin");
  if (roleSet.has("merchant") || input.hasMerchant) dashes.add("merchant");
  if (roleSet.has("developer") || input.hasDeveloperOrg) dashes.add("developer");
  if (roleSet.has("institution") || input.institution?.status) {
    if (input.institution?.institution_type === "developer") dashes.add("developer");
    else dashes.add("institution");
  }
  dashes.add("personal");
  return Array.from(dashes);
}

export function computeDefaultDashboard(input: ProfileMenuInputs): DashKey {
  const fromAccount = accountTypeToDash(input.accountType);
  if (fromAccount) return fromAccount;
  const roleSet = new Set(input.roles ?? []);
  if (roleSet.has("admin")) return "admin";
  if (roleSet.has("merchant") || input.hasMerchant) return "merchant";
  if (roleSet.has("developer") || input.hasDeveloperOrg) return "developer";
  if (input.institution?.status) return "institution";
  return "personal";
}

export function orderDashboards(available: DashKey[], def: DashKey | null): DashKey[] {
  const order: DashKey[] = ["admin", "merchant", "developer", "institution", "personal"];
  const set = new Set(available);
  const sorted = order.filter((k) => set.has(k));
  if (def && sorted.includes(def)) {
    return [def, ...sorted.filter((k) => k !== def)];
  }
  return sorted;
}

export function UserProfileMenu({ variant = "dashboard" }: UserProfileMenuProps) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [initials, setInitials] = useState("U");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [available, setAvailable] = useState<DashKey[]>([]);
  const [defaultDash, setDefaultDash] = useState<DashKey | null>(null);
  const [primaryRoleLabel, setPrimaryRoleLabel] = useState<string>("User");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAuthenticated(false); return; }
      setIsAuthenticated(true);
      setUserEmail(user.email || "");
      setInitials((user.email || "U").substring(0, 2).toUpperCase());

      const [{ data: profile }, { data: roles }, { data: devOrg }, { data: inst }, { data: merch }] = await Promise.all([
        supabase.from("profiles").select("full_name, account_type").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("developer_orgs").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
        supabase.from("institutions").select("status, institution_type").eq("user_id", user.id).maybeSingle(),
        supabase.from("gateway_merchants").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
      ]);

      if (profile?.full_name) {
        const parts = profile.full_name.split(" ");
        setInitials(
          parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase()
        );
      }

      const roles = (rolesData ?? []).map((r: any) => r.role as string);
      const dashes = computeAvailableDashboards({
        accountType: profile?.account_type,
        roles,
        hasDeveloperOrg: !!devOrg?.id,
        hasMerchant: !!merch?.id,
        institution: inst as any,
      });
      const def = computeDefaultDashboard({
        accountType: profile?.account_type,
        roles,
        hasDeveloperOrg: !!devOrg?.id,
        hasMerchant: !!merch?.id,
        institution: inst as any,
      });

      setAvailable(dashes);
      setDefaultDash(def);
      setPrimaryRoleLabel(DASH_META[def].label);
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setIsAuthenticated(false);
      else { setIsAuthenticated(true); fetchUser(); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("You've been signed out. See you next time!");
    navigate("/");
  };

  const profilePath = variant === "admin" ? "/admin/users" : "/profile";
  const securityPath = variant === "admin" ? "/admin/security" : "/security";
  const settingsPath = variant === "institution" ? "/fi-portal/settings" : "/profile";

  if (!isAuthenticated) return null;

  // Order: default first, then the rest in canonical order
  const ordered: DashKey[] = (() => {
    const order: DashKey[] = ["admin", "merchant", "developer", "institution", "personal"];
    const set = new Set(available);
    const sorted = order.filter((k) => set.has(k));
    if (defaultDash && sorted.includes(defaultDash)) {
      return [defaultDash, ...sorted.filter((k) => k !== defaultDash)];
    }
    return sorted;
  })();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9 border-2 border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1.5">
            <p className="text-sm font-medium leading-none truncate">{userEmail}</p>
            <p className="text-xs text-muted-foreground">{primaryRoleLabel}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate(profilePath)}>
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(settingsPath)}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(securityPath)}>
          <Shield className="mr-2 h-4 w-4" />
          Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your dashboards
        </DropdownMenuLabel>
        {ordered.map((k) => {
          const meta = DASH_META[k];
          const Icon = meta.icon;
          const isDefault = k === defaultDash;
          return (
            <DropdownMenuItem key={k} onClick={() => navigate(meta.path)}>
              <Icon className="mr-2 h-4 w-4" />
              <span className="flex-1">{meta.label}</span>
              {isDefault && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                  Default
                </Badge>
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Backwards-compat helper for callers that imported the old prop helper.
export const __legacyMyDashboardPath = (variant: UserProfileMenuProps["variant"]) => {
  switch (variant) {
    case "admin": return "/admin";
    case "institution": return "/fi-portal";
    case "developer": return "/developer";
    case "merchant": return "/merchant";
    default: return "/dashboard";
  }
};
