import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fans out Supabase Realtime updates for a single merchant across the entire
 * Merchant + Business PWA surface. Mounted ONCE at each layout root so every
 * page (Orders, Products, Wallet, Staff, Payouts, Disputes, Storefront,
 * Coupons, Inventory) receives live updates without each page wiring its
 * own channel.
 *
 * Strategy: invalidate React Query caches by key prefix. Pages that use any
 * of the listed query keys will refetch automatically when the underlying
 * row changes. Toast feedback is intentionally NOT raised here — page-level
 * UX (BusinessHome, BusinessReceive) already handles user-facing alerts to
 * avoid duplicate notifications across the layout.
 *
 * RLS-protected: the realtime stream is scoped server-side by
 * `merchant_id=eq.${merchantId}`, so no row leaks to other tenants.
 */
export function useMerchantRealtime(merchantId: string | null | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!merchantId) return;

    const invalidate = (...keys: string[]) => {
      keys.forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k, merchantId] }),
      );
      // Also invalidate non-suffixed forms used on /merchant pages
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    };

    const filter = `merchant_id=eq.${merchantId}`;

    const channel = supabase
      .channel(`merchant-realtime-${merchantId}`)
      // ── Orders & POS payments ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_orders', filter },
        () => invalidate('biz-orders', 'merchant-orders', 'pos-orders'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_order_payments', filter },
        () => invalidate('biz-orders', 'merchant-orders', 'merchant-charges', 'merchant-wallets'))
      // ── Charges / refunds / disputes ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_charges', filter },
        () => invalidate('merchant-charges', 'biz-charges', 'merchant-transactions'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_refunds', filter },
        () => invalidate('merchant-refunds', 'biz-refunds'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_disputes', filter },
        () => invalidate('merchant-disputes', 'biz-disputes'))
      // ── Wallet & payouts ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_merchant_wallets', filter },
        () => invalidate('merchant-wallets', 'biz-wallet'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gateway_payouts', filter },
        () => invalidate('merchant-payouts', 'biz-payouts'))
      // ── Catalog / inventory / pricing ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_products', filter },
        () => invalidate('biz-products', 'merchant-products'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_inventory_items', filter },
        () => invalidate('biz-inventory', 'merchant-inventory'))
      // ── Storefront / coupons / reviews ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_store_profiles', filter },
        () => invalidate('biz-storefront', 'merchant-storefront'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_coupons', filter },
        () => invalidate('biz-coupons', 'merchant-coupons'))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pos_reviews', filter },
        () => invalidate('biz-reviews', 'merchant-reviews'))
      // ── Staff ──
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'merchant_staff_roles', filter },
        () => invalidate('biz-staff', 'merchant-staff'))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [merchantId, queryClient]);
}
