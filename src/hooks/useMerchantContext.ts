import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';

interface MerchantContext {
  merchantId: string | null;
  isOwner: boolean;
  isStaff: boolean;
  isLoading: boolean;
}

/**
 * Resolves the merchant context for the currently authenticated user.
 * Checks gateway_merchants (owner) first, then merchant_staff_roles (staff).
 */
export function useMerchantContext(): MerchantContext {
  const { user, loading: userLoading } = useAuthenticatedUser();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['merchant-context', user?.id],
    queryFn: async () => {
      if (!user) return { merchantId: null, isOwner: false, isStaff: false };

      // Check if user is a merchant owner
      const { data: ownerData } = await supabase
        .from('gateway_merchants')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (ownerData) {
        return { merchantId: ownerData.id, isOwner: true, isStaff: false };
      }

      // Check if user is staff
      const { data: staffData } = await supabase
        .from('merchant_staff_roles')
        .select('merchant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (staffData) {
        return { merchantId: staffData.merchant_id, isOwner: false, isStaff: true };
      }

      return { merchantId: null, isOwner: false, isStaff: false };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 min
  });

  return {
    merchantId: data?.merchantId ?? null,
    isOwner: data?.isOwner ?? false,
    isStaff: data?.isStaff ?? false,
    isLoading: userLoading || queryLoading,
  };
}
