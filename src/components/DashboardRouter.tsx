import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useMandatoryPin } from "@/hooks/useMandatoryPin";
interface UserRoleState {
  isLoading: boolean;
  isAdmin: boolean;
  isInstitution: boolean;
  institutionStatus?: string;
  institutionType?: string;
  isDeveloper: boolean;
}

export function DashboardRouter() {
  const navigate = useNavigate();
  const { isLoading: pinLoading, requiresPinSetup } = useMandatoryPin();
  const [roleState, setRoleState] = useState<UserRoleState>({
    isLoading: true,
    isAdmin: false,
    isInstitution: false,
    isDeveloper: false,
  });

  useEffect(() => {
    if (pinLoading) return;
    if (requiresPinSetup) {
      navigate("/setup-pin", { replace: true });
      return;
    }
    checkUserRoleAndRedirect();
  }, [pinLoading, requiresPinSetup]);

  const checkUserRoleAndRedirect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check admin role first
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (isAdmin) {
        navigate("/admin", { replace: true });
        return;
      }

      // Check for merchant role (owner)
      const { data: isMerchant } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'merchant' as any
      });

      if (isMerchant) {
        navigate("/merchant", { replace: true });
        return;
      }

      // Check for developer role (developer_orgs path — no institution row required)
      const { data: isDeveloper } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'developer' as any
      });

      if (isDeveloper) {
        navigate("/developer", { replace: true });
        return;
      }

      // Fallback: developer_orgs row even if role missing
      const { data: devOrg } = await supabase
        .from("developer_orgs")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (devOrg) {
        navigate("/developer", { replace: true });
        return;
      }

      // Check for merchant staff (not owner, but staff member)
      const { data: merchantStaff } = await supabase
        .from("merchant_staff_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (merchantStaff) {
        navigate("/merchant/travel-services", { replace: true });
        return;
      }

      // Check for institution owner
      const { data: institution } = await supabase
        .from("institutions")
        .select("status, institution_type")
        .eq("user_id", user.id)
        .maybeSingle();

      if (institution) {
        if (institution.status === 'approved') {
          if (institution.institution_type === 'developer') {
            navigate("/developer", { replace: true });
          } else {
            navigate("/fi-portal", { replace: true });
          }
          return;
        } else {
          navigate("/pending-approval", { replace: true });
          return;
        }
      }

      // Check for FI staff role
      const { data: isStaff } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'staff' as any
      });

      if (isStaff) {
        navigate("/fi-portal", { replace: true });
        return;
      }

      // Default to personal credit score dashboard
      navigate("/credit-score", { replace: true });
    } catch (error) {
      console.error("Error determining user role:", error);
      navigate("/credit-score", { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

// Helper hook to get dashboard path for navigation
export function useDashboardPath() {
  const [dashboardPath, setDashboardPath] = useState("/dashboard");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getDashboardPath = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setDashboardPath("/auth");
          return;
        }

        // Check admin role
        const { data: isAdmin } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        if (isAdmin) {
          setDashboardPath("/admin");
          return;
        }

        // Check merchant role (owner)
        const { data: isMerchant } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'merchant' as any
        });

        if (isMerchant) {
          setDashboardPath("/merchant");
          return;
        }

        // Check developer role
        const { data: isDeveloper } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'developer' as any
        });

        if (isDeveloper) {
          setDashboardPath("/developer");
          return;
        }

        const { data: devOrg } = await supabase
          .from("developer_orgs")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (devOrg) {
          setDashboardPath("/developer");
          return;
        }

        // Check for merchant staff
        const { data: merchantStaff } = await supabase
          .from("merchant_staff_roles")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (merchantStaff) {
          setDashboardPath("/merchant/travel-services");
          return;
        }

        // Check institution owner
        const { data: institution } = await supabase
          .from("institutions")
          .select("status, institution_type")
          .eq("user_id", user.id)
          .maybeSingle();

        if (institution?.status === 'approved') {
          if (institution.institution_type === 'developer') {
            setDashboardPath("/developer");
          } else {
            setDashboardPath("/fi-portal");
          }
          return;
        }

        if (institution) {
          setDashboardPath("/pending-approval");
          return;
        }

        // Check for FI staff
        const { data: isStaff } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'staff' as any
        });

        if (isStaff) {
          setDashboardPath("/fi-portal");
          return;
        }

        setDashboardPath("/credit-score");
      } catch (error) {
        console.error("Error getting dashboard path:", error);
        setDashboardPath("/credit-score");
      } finally {
        setIsLoading(false);
      }
    };

    getDashboardPath();
  }, []);

  return { dashboardPath, isLoading };
}
