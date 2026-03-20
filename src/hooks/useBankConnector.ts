import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBankConnector() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["bank-connector-bank-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Try institution owner path
      const { data: institution } = await supabase
        .from("institutions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      let institutionId = institution?.id;

      // Try staff assignment path
      if (!institutionId) {
        const { data: staff } = await supabase
          .from("staff_assignments")
          .select("institution_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();
        institutionId = staff?.institution_id;
      }

      if (!institutionId) return { bankId: null, bankName: null };

      const { data: bank } = await supabase
        .from("banks")
        .select("id, name")
        .eq("institution_id", institutionId)
        .eq("status", "active")
        .maybeSingle();

      return {
        bankId: bank?.id ?? null,
        bankName: bank?.name ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    bankId: data?.bankId ?? null,
    bankName: data?.bankName ?? null,
    loading: isLoading,
    error: error as Error | null,
  };
}
