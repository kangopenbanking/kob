import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const invoke = async (action: string, body: Record<string, any> = {}) => {
  const { data, error } = await supabase.functions.invoke('api-bills-v2', {
    body: { action, ...body },
  });
  if (error) {
    // Parse error body from edge function
    let msg = error.message || 'Request failed';
    try {
      const ctx = typeof error.context?.body === 'string'
        ? JSON.parse(error.context.body)
        : error.context?.body;
      if (ctx?.error) msg = ctx.error;
    } catch {}
    throw new Error(msg);
  }
  return data;
};

export function useBillCategories() {
  return useQuery({
    queryKey: ['bill-categories'],
    queryFn: () => invoke('get_categories'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBillProviders(categoryId?: string, q?: string) {
  return useQuery({
    queryKey: ['bill-providers', categoryId, q],
    queryFn: () => invoke('get_providers', { category_id: categoryId, q }),
    enabled: !!categoryId || !!q,
  });
}

export function useBillProvider(providerId?: string) {
  return useQuery({
    queryKey: ['bill-provider', providerId],
    queryFn: () => invoke('get_provider', { provider_id: providerId }),
    enabled: !!providerId,
  });
}

export function useBillLocations(providerId?: string) {
  return useQuery({
    queryKey: ['bill-locations', providerId],
    queryFn: () => invoke('get_locations', { provider_id: providerId }),
    enabled: !!providerId,
  });
}

export function useBillProducts(providerId?: string, locationId?: string) {
  return useQuery({
    queryKey: ['bill-products', providerId, locationId],
    queryFn: () => invoke('get_products', { provider_id: providerId, location_id: locationId }),
    enabled: !!providerId,
  });
}

export function useBillProduct(productId?: string) {
  return useQuery({
    queryKey: ['bill-product', productId],
    queryFn: () => invoke('get_product', { product_id: productId }),
    enabled: !!productId,
  });
}

export function useCreateBillIntent() {
  return useMutation({
    mutationFn: (body: {
      provider_id: string;
      location_id?: string;
      product_id: string;
      amount?: number;
      payer_details: Record<string, string>;
      idempotency_key?: string;
    }) => invoke('create_intent', body),
  });
}

export function usePayBillIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (intentId: string) => invoke('pay_intent', { intent_id: intentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill-payments'] });
      qc.invalidateQueries({ queryKey: ['customer-accounts'] });
      qc.invalidateQueries({ queryKey: ['account-balances'] });
      qc.invalidateQueries({ queryKey: ['customer-transactions'] });
      qc.invalidateQueries({ queryKey: ['spending-summary'] });
    },
  });
}

export function useBillPayments(limit = 20) {
  return useQuery({
    queryKey: ['bill-payments', limit],
    queryFn: () => invoke('get_payments', { limit }),
  });
}

export function useBillPayment(paymentId?: string) {
  return useQuery({
    queryKey: ['bill-payment', paymentId],
    queryFn: () => invoke('get_payment', { payment_id: paymentId }),
    enabled: !!paymentId,
  });
}
