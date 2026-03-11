import React, { useState } from 'react';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, Mail, ShoppingBag, Search, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

interface CustomerSummary {
  name: string;
  email: string | null;
  phone: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string;
}

const BusinessCustomers: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const { data: customers, isLoading } = useQuery({
    queryKey: ['biz-customers', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('pos_orders')
        .select('customer_name, customer_email, customer_phone, total, created_at')
        .eq('merchant_id', merchantId)
        .not('customer_name', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Aggregate by customer name
      const map = new Map<string, CustomerSummary>();
      for (const o of data || []) {
        const key = (o.customer_name || '').trim().toLowerCase();
        if (!key) continue;
        const existing = map.get(key);
        if (existing) {
          existing.order_count += 1;
          existing.total_spent += o.total || 0;
          if (o.created_at > existing.last_order_at) existing.last_order_at = o.created_at;
          if (!existing.email && o.customer_email) existing.email = o.customer_email;
          if (!existing.phone && o.customer_phone) existing.phone = o.customer_phone;
        } else {
          map.set(key, {
            name: o.customer_name!,
            email: o.customer_email || null,
            phone: o.customer_phone || null,
            order_count: 1,
            total_spent: o.total || 0,
            last_order_at: o.created_at,
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.total_spent - a.total_spent);
    },
    enabled: !!merchantId,
  });

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  // Customer order history
  const { data: customerOrders } = useQuery({
    queryKey: ['biz-customer-orders', merchantId, selectedCustomer?.name],
    queryFn: async () => {
      if (!merchantId || !selectedCustomer) return [];
      const { data } = await supabase
        .from('pos_orders')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('customer_name', selectedCustomer.name)
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!merchantId && !!selectedCustomer,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <header className="mb-4 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">{filtered?.length ?? 0} customer{(filtered?.length ?? 0) !== 1 ? 's' : ''}</p>
      </header>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : !filtered?.length ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">No customers yet. They'll appear here after their first order.</p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <motion.div
                key={c.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="border-0 shadow-sm cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{c.name}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{c.order_count} order{c.order_count !== 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>{formatXAF(c.total_spent)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>{selectedCustomer?.name}</SheetTitle>
          </SheetHeader>
          {selectedCustomer && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-0 bg-muted/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Orders</p>
                    <p className="text-lg font-bold">{selectedCustomer.order_count}</p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-muted/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">Total Spent</p>
                    <p className="text-lg font-bold">{formatXAF(selectedCustomer.total_spent)}</p>
                  </CardContent>
                </Card>
              </div>

              {(selectedCustomer.phone || selectedCustomer.email) && (
                <div className="flex gap-3">
                  {selectedCustomer.phone && (
                    <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm">
                      <Phone className="h-4 w-4" /> {selectedCustomer.phone}
                    </a>
                  )}
                  {selectedCustomer.email && (
                    <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm">
                      <Mail className="h-4 w-4" /> Email
                    </a>
                  )}
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-bold">Recent Orders</h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {customerOrders?.map((o: any) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                      <div>
                        <p className="text-sm font-medium">{o.order_number || `#${o.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatXAF(o.total || 0)}</p>
                        <Badge variant="secondary" className="text-[10px]">{o.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default BusinessCustomers;
