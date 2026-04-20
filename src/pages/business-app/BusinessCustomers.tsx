import React, { useState } from 'react';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Phone, Mail, Search, ChevronRight, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { PageGuide } from '@/components/business-app/PageGuide';

interface CustomerSummary {
  name: string;
  email: string | null;
  phone: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string;
}

const formatXAF = (n: number) =>
  new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

const BusinessCustomers: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
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

  const filtered = customers?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

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

  const handleExport = () => {
    if (!filtered?.length) return;
    const csv = ['Name,Email,Phone,Orders,Total Spent,Last Order']
      .concat(filtered.map(c =>
        `"${c.name}","${c.email || ''}","${c.phone || ''}",${c.order_count},${c.total_spent},"${new Date(c.last_order_at).toLocaleDateString()}"`
      )).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Customers"
        summary="Browse the people who buy from you, see their lifetime spend, and export the list for marketing."
        steps={[
          { title: 'Search by name or contact', description: 'Use the search bar to locate a specific customer by name, email, or phone.' },
          { title: 'Open a profile', description: 'Tap any row to see total orders, total spend, and the most recent purchase date.' },
          { title: 'Export for outreach', description: 'Tap Export to download the list as CSV for newsletters or loyalty campaigns.' },
        ]}
      />
      <header className="mb-4 flex items-center justify-between pt-4 md:pt-0">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-xs text-muted-foreground font-medium">{filtered?.length ?? 0} customer{(filtered?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </header>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : !filtered?.length ? (
        <Card className="border border-border/40 shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">No customers yet. They'll appear here after their first order.</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <AnimatePresence>
          <div className="space-y-2">
            {filtered.map((c, i) => (
              <motion.div key={c.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button className="w-full rounded-2xl border border-border/40 bg-card p-3.5 flex items-center gap-3 text-left" onClick={() => setSelectedCustomer(c)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{c.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{c.order_count} order{c.order_count !== 1 ? 's' : ''} · {formatXAF(c.total_spent)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" strokeWidth={1.5} />
                </button>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Customer</TableHead>
                <TableHead className="text-xs font-semibold">Contact</TableHead>
                <TableHead className="text-xs font-semibold text-right">Orders</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Spent</TableHead>
                <TableHead className="text-xs font-semibold text-right">Last Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.name} className="cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {c.email && <p>{c.email}</p>}
                      {c.phone && <p>{c.phone}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{c.order_count}</TableCell>
                  <TableCell className="text-right text-sm font-bold">{formatXAF(c.total_spent)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{new Date(c.last_order_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn(isMobile ? 'max-h-[85vh] rounded-t-3xl' : 'w-[420px]')}>
          <SheetHeader>
            <SheetTitle>{selectedCustomer?.name}</SheetTitle>
          </SheetHeader>
          {selectedCustomer && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Orders</p>
                  <p className="text-lg font-bold">{selectedCustomer.order_count}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Spent</p>
                  <p className="text-lg font-bold">{formatXAF(selectedCustomer.total_spent)}</p>
                </div>
              </div>

              {(selectedCustomer.phone || selectedCustomer.email) && (
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.phone && (
                    <a href={`tel:${selectedCustomer.phone}`} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm hover:bg-muted/80 transition-colors">
                      <Phone className="h-4 w-4" /> {selectedCustomer.phone}
                    </a>
                  )}
                  {selectedCustomer.email && (
                    <a href={`mailto:${selectedCustomer.email}`} className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm hover:bg-muted/80 transition-colors">
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
