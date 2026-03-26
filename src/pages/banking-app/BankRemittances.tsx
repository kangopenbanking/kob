import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Globe, ChevronRight, Clock, CheckCircle2, XCircle, Banknote, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  created: { label: 'Created', color: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  received: { label: 'Received', color: 'bg-blue-100 text-blue-700' },
  credited: { label: 'Credited', color: 'bg-green-100 text-green-700' },
  settled: { label: 'Settled', color: 'bg-green-50 text-green-600' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
  reversed: { label: 'Reversed', color: 'bg-red-50 text-red-600' },
};

const BankRemittances: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  const { data: institution } = useQuery({
    queryKey: ['bank-inst-name', institutionId],
    queryFn: async () => {
      const { data } = await supabase.from('institutions').select('institution_name').eq('id', institutionId!).single();
      return data;
    },
    enabled: !!institutionId,
  });

  const { data: remittances = [], isLoading } = useQuery({
    queryKey: ['bank-remittances', institutionId],
    queryFn: async () => {
      // Get accounts linked to this institution to find user's remittances
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from('remittances')
        .select('*, remittance_partners(name)')
        .eq('direction', 'inbound')
        .eq('receiver_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!institutionId,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['bank-remittance-detail', selectedId],
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

  return (
    <div className="flex flex-col gap-5 p-5 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Remittances</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{institution?.institution_name || 'Your institution'}</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/bank/${institutionId}/payments/send-abroad`)} className="gap-1.5">
          <Send className="h-3.5 w-3.5" /> Send Abroad
        </Button>
      </div>

      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Banknote className="h-5 w-5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Total Received</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{totalReceived.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">XAF</span></p>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {['all', 'pending', 'received', 'credited', 'failed'].map((f) => (
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
          <p className="text-sm text-muted-foreground">No remittances found</p>
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
                    <p className="text-xs text-muted-foreground">{r.sender_country || '—'} · {(r as any).remittance_partners?.name || ''}</p>
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
                    ['Amount', `${(detail.remittance.amount_out || 0).toLocaleString()} ${detail.remittance.currency_out}`],
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

export default BankRemittances;
