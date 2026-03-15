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
import { User, Settings, Shield, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

interface UserProfileMenuProps {
  variant?: "admin" | "dashboard" | "developer" | "institution" | "merchant";
}

export function UserProfileMenu({ variant = "dashboard" }: UserProfileMenuProps) {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [initials, setInitials] = useState("U");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);
      setUserEmail(user.email || "");
      const email = user.email || "";
      setInitials(email.substring(0, 2).toUpperCase());

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.full_name) {
        const parts = profile.full_name.split(" ");
        setInitials(
          parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase()
        );
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
      }
    };
    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
        fetchUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const roleLabel: Record<string, string> = {
    admin: "Super Admin",
    institution_owner: "Institution Owner",
    institution_staff: "Staff",
    developer: "Developer",
    personal: "Personal",
  };

  const displayRole = roleLabel[userRole] || userRole || "User";

  const profilePath = variant === "admin" ? "/admin/users" : "/profile";
  const securityPath = variant === "admin" ? "/admin/security" : "/security";
  const settingsPath = variant === "institution" ? "/fi-portal/settings" : "/profile";

  const dashboardPathMap: Record<string, string> = {
    admin: "/admin",
    institution: "/fi-portal",
    developer: "/developer",
    dashboard: "/dashboard",
  };
  const myDashboardPath = dashboardPathMap[variant] || "/dashboard";

  // Don't render anything if not authenticated
  if (!isAuthenticated) return null;

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
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1.5">
            <p className="text-sm font-medium leading-none truncate">{userEmail}</p>
            <p className="text-xs text-muted-foreground">{displayRole}</p>
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
        <DropdownMenuItem onClick={() => navigate(myDashboardPath)}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          My Dashboard
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
