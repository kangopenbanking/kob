import React, { useState } from 'react';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PageGuide } from '@/components/business-app/PageGuide';

const BusinessCoupons: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['biz-coupons', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase.from('pos_coupons').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pos_coupons').insert({
        merchant_id: merchantId!, code: code.toUpperCase().trim(), type,
        value: parseFloat(value), min_order_amount: minOrder ? parseFloat(minOrder) : 0,
        max_uses: maxUses ? parseInt(maxUses) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biz-coupons'] });
      toast.success(`Coupon "${code.toUpperCase().trim()}" created and ready for customers to use`);
      setShowCreate(false); setCode(''); setValue(''); setMinOrder(''); setMaxUses('');
    },
    onError: (e: any) => toast.error(extractEdgeFunctionError(e, 'Could not create coupon. The code may already exist.')),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pos_coupons').update({ is_active: !is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['biz-coupons'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_coupons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['biz-coupons'] }); toast.success('Coupon removed. It can no longer be used by customers.'); },
  });

  const formatXAF = (n: number) =>
    new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      <PageGuide
        title="Coupons"
        summary="Create discount codes to drive sales and reward returning customers."
        steps={[
          { title: 'Create a coupon', description: 'Tap New, then choose a percentage or fixed-amount discount and a code customers will type.' },
          { title: 'Set rules', description: 'Optionally limit by minimum order value or total uses to control your campaign.' },
          { title: 'Activate and share', description: 'Toggle a coupon on or off any time, and share the code through your usual channels.' },
        ]}
      />
      <header className="mb-4 flex items-center justify-between pt-4 md:pt-0">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Coupons</h1>
          <p className="text-xs text-muted-foreground font-medium">{coupons?.length ?? 0} coupon{(coupons?.length ?? 0) !== 1 ? 's' : ''}</p>
        </div>
        <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : !coupons?.length ? (
        <Card className="border border-border/40 shadow-none">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Ticket className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">No coupons yet. Create one to offer discounts.</p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <AnimatePresence>
          <div className="space-y-2">
            {coupons.map((c: any, i: number) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="rounded-2xl border border-border/40 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-bold text-foreground">{c.code}</p>
                        <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.type === 'percentage' ? `${c.value}% off` : `${formatXAF(c.value)} off`}
                        {c.min_order_amount > 0 && ` · Min ${formatXAF(c.min_order_amount)}`}
                        {c.max_uses && ` · ${c.current_uses || 0}/${c.max_uses} used`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleMutation.mutate({ id: c.id, is_active: c.is_active })}>
                        {c.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Code</TableHead>
                <TableHead className="text-xs font-semibold">Discount</TableHead>
                <TableHead className="text-xs font-semibold">Min Order</TableHead>
                <TableHead className="text-xs font-semibold text-center">Usage</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm font-bold">{c.code}</TableCell>
                  <TableCell className="text-sm">{c.type === 'percentage' ? `${c.value}%` : formatXAF(c.value)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.min_order_amount > 0 ? formatXAF(c.min_order_amount) : '—'}</TableCell>
                  <TableCell className="text-center text-sm">{c.max_uses ? `${c.current_uses || 0}/${c.max_uses}` : '∞'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">{c.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleMutation.mutate({ id: c.id, is_active: c.is_active })}>
                        {c.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>New Coupon</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Input placeholder="Coupon Code (e.g. SAVE10)" value={code} onChange={e => setCode(e.target.value)} className="font-mono uppercase rounded-xl" />
            <Select value={type} onValueChange={(v: 'percentage' | 'fixed') => setType(v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount (XAF)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder={type === 'percentage' ? 'Discount %' : 'Amount (XAF)'} type="number" value={value} onChange={e => setValue(e.target.value)} className="rounded-xl" />
            <Input placeholder="Min order amount (optional)" type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} className="rounded-xl" />
            <Input placeholder="Max uses (optional)" type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="rounded-xl" />
          </div>
          <DialogFooter>
            <Button className="w-full rounded-xl" onClick={() => createMutation.mutate()} disabled={!code || !value || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Coupon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessCoupons;
