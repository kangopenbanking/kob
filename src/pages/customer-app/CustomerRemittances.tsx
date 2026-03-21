import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, Globe, ChevronRight, Clock, CheckCircle2, XCircle, Banknote, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  created: { label: 'Created', color: 'bg-muted text-muted-foreground', icon: Clock },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  received: { label: 'Received', color: 'bg-blue-100 text-blue-700', icon: ArrowDownLeft },
  credited: { label: 'Credited', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  settled: { label: 'Settled', color: 'bg-green-50 text-green-600', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  reversed: { label: 'Reversed', color: 'bg-red-50 text-red-600', icon: XCircle },
};

const FILTERS = ['all', 'pending', 'received', 'credited', 'settled', 'failed'] as const;

const CustomerRemittances: React.FC = () => {
  const { user } = useCustomerAuth();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: remittances = [], isLoading } = useQuery({
    queryKey: ['customer-inbound-remittances', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('remittances')
        .select('*, remittance_partners(name)')
        .eq('direction', 'inbound')
        .eq('receiver_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['customer-remittance-detail', selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const [remRes, evtRes] = await Promise.all([
        supabase.from('remittances').select('*, remittance_partners(name)').eq('id', selectedId).single(),
        supabase.from('remittance_events').select('*').eq('remittance_id', selectedId).order('created_at', { ascending: true }),
      ]);
      return { remittance: remRes.data, events: evtRes.data || [] };
    },
    enabled: !!selectedId,
  });

  const filtered = filter === 'all' ? remittances : remittances.filter((r: any) => r.status === filter);

  const totalReceived = remittances.filter((r: any) => ['credited', 'settled'].includes(r.status))
    .reduce((s: number, r: any) => s + (r.amount_out || 0), 0);
  const pendingCount = remittances.filter((r: any) => ['pending', 'received'].includes(r.status)).length;

  return (
    <div className="flex flex-col gap-5 p-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Remittances Received</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track money sent to you from abroad</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-green-500/10 to-green-600/5 p-4">
          <Banknote className="h-5 w-5 text-green-600 mb-1" />
          <p className="text-[11px] text-muted-foreground font-medium">Total Received</p>
          <p className="text-lg font-bold text-foreground">{totalReceived.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">XAF</span></p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4">
          <Clock className="h-5 w-5 text-amber-600 mb-1" />
          <p className="text-[11px] text-muted-foreground font-medium">Pending</p>
          <p className="text-lg font-bold text-foreground">{pendingCount}</p>
        </motion.div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Globe className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No inbound remittances found</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2">
            {filtered.map((r: any, i: number) => {
              const st = STATUS_MAP[r.status] || STATUS_MAP.created;
              return (
                <motion.button key={r.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedId(r.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3.5 text-left">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <ArrowDownLeft className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.sender_name || 'Sender'}</p>
                    <p className="text-xs text-muted-foreground">{r.sender_country || '—'} · {(r as any).remittance_partners?.name || 'Partner'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">+{(r.amount_out || 0).toLocaleString()}</p>
                    <Badge className={`text-[10px] ${st.color} border-0`}>{st.label}</Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-md max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-primary" /> Remittance Details
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : detail?.remittance ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['Sender', detail.remittance.sender_name],
                    ['Country', detail.remittance.sender_country],
                    ['Amount Received', `${(detail.remittance.amount_out || 0).toLocaleString()} ${detail.remittance.currency_out}`],
                    ['Status', detail.remittance.status],
                    ['Destination', (detail.remittance.destination_type || '').replace(/_/g, ' ')],
                    ['Date', detail.remittance.created_at ? format(new Date(detail.remittance.created_at), 'MMM d, yyyy HH:mm') : '—'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <p className="text-[11px] text-muted-foreground">{label}</p>
                      <p className="font-medium capitalize">{val || '—'}</p>
                    </div>
                  ))}
                </div>

                {detail.events.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Timeline</p>
                    <div className="space-y-3">
                      {detail.events.map((evt: any, idx: number) => (
                        <div key={evt.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`h-2.5 w-2.5 rounded-full ${idx === detail.events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                            {idx < detail.events.length - 1 && <div className="w-px flex-1 bg-border" />}
                          </div>
                          <div className="pb-3">
                            <p className="text-sm font-medium capitalize">{(evt.event_type || '').replace(/_/g, ' ')}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(evt.created_at), 'MMM d, yyyy HH:mm')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerRemittances;
