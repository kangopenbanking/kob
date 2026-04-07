import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Clock, LogIn, LogOut, DollarSign, ArrowDownCircle, ArrowUpCircle,
  Calculator, CheckCircle, AlertTriangle, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface ShiftManagerProps {
  merchantId: string;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-CM', { minimumFractionDigits: 0 }).format(n);

export const ShiftManager: React.FC<ShiftManagerProps> = ({ merchantId }) => {
  const queryClient = useQueryClient();
  const [openCashDialog, setOpenCashDialog] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [movementReason, setMovementReason] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [showMovementDialog, setShowMovementDialog] = useState(false);

  // Get current user
  const { data: user } = useQuery({
    queryKey: ['current-user-shift'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get active shift
  const { data: activeShift, isLoading } = useQuery({
    queryKey: ['pos-active-shift', merchantId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from('pos_shifts')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('cashier_id', user.id)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!merchantId && !!user?.id,
  });

  // Get cash movements for active shift
  const { data: cashMovements = [] } = useQuery({
    queryKey: ['pos-cash-movements', activeShift?.id],
    queryFn: async () => {
      if (!activeShift?.id) return [];
      const { data } = await (supabase as any)
        .from('pos_cash_movements')
        .select('*')
        .eq('shift_id', activeShift.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!activeShift?.id,
  });

  // Get shift history
  const { data: shiftHistory = [] } = useQuery({
    queryKey: ['pos-shift-history', merchantId, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await (supabase as any)
        .from('pos_shifts')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('cashier_id', user.id)
        .eq('status', 'closed')
        .order('ended_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!merchantId && !!user?.id,
  });

  // Clock In
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(cashAmount) || 0;
      const { data, error } = await (supabase as any)
        .from('pos_shifts')
        .insert({
          merchant_id: merchantId,
          cashier_id: user!.id,
          opening_cash: amount,
          status: 'open',
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-active-shift'] });
      setOpenCashDialog(false);
      setCashAmount('');
      toast.success('Shift started!');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err)),
  });

  // Add cash movement
  const addMovementMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(movementAmount) || 0;
      if (amount <= 0) throw new Error('Amount must be positive');
      const { error } = await (supabase as any)
        .from('pos_cash_movements')
        .insert({
          shift_id: activeShift!.id,
          merchant_id: merchantId,
          type: cashMovementType,
          amount,
          reason: movementReason || null,
          created_by: user!.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-cash-movements'] });
      setShowMovementDialog(false);
      setMovementAmount('');
      setMovementReason('');
      toast.success('Cash movement recorded');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err)),
  });

  // Close shift
  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      const closing = parseFloat(closingCash) || 0;
      // Calculate expected cash
      const cashIn = cashMovements.filter((m: any) => m.type === 'cash_in' || m.type === 'sale').reduce((s: number, m: any) => s + Number(m.amount), 0);
      const cashOut = cashMovements.filter((m: any) => m.type === 'cash_out' || m.type === 'refund').reduce((s: number, m: any) => s + Number(m.amount), 0);
      const expected = Number(activeShift!.opening_cash) + cashIn - cashOut;

      const { error } = await (supabase as any)
        .from('pos_shifts')
        .update({
          status: 'closed',
          ended_at: new Date().toISOString(),
          closing_cash: closing,
          expected_cash: expected,
          cash_difference: closing - expected,
          notes: closeNotes || null,
        })
        .eq('id', activeShift!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-active-shift'] });
      queryClient.invalidateQueries({ queryKey: ['pos-shift-history'] });
      setShowCloseDialog(false);
      setClosingCash('');
      setCloseNotes('');
      toast.success('Shift closed successfully');
    },
    onError: (err: any) => toast.error(extractEdgeFunctionError(err)),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  // No active shift — show clock in
  if (!activeShift) {
    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-foreground">Start Your Shift</h3>
            <p className="mb-4 text-sm text-muted-foreground">Clock in to begin processing transactions</p>
            <Button onClick={() => setOpenCashDialog(true)} className="gap-2">
              <Clock className="h-4 w-4" /> Clock In
            </Button>
          </CardContent>
        </Card>

        {/* Shift History */}
        {shiftHistory.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" /> Recent Shifts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {shiftHistory.slice(0, 5).map((shift: any) => (
                <div key={shift.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <div>
                    <p className="font-medium">{format(new Date(shift.started_at), 'dd MMM • HH:mm')} — {shift.ended_at ? format(new Date(shift.ended_at), 'HH:mm') : '—'}</p>
                    <p className="text-xs text-muted-foreground">{shift.total_transactions || 0} transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{fmt(shift.total_sales || 0)} XAF</p>
                    {shift.cash_difference !== null && (
                      <Badge variant={Number(shift.cash_difference) === 0 ? 'default' : 'destructive'} className="text-[10px]">
                        {Number(shift.cash_difference) >= 0 ? '+' : ''}{fmt(shift.cash_difference)}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Clock In Dialog */}
        <Dialog open={openCashDialog} onOpenChange={setOpenCashDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Opening Cash Amount</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Count the cash in the drawer and enter the amount below.</p>
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={cashAmount}
              onChange={e => setCashAmount(e.target.value)}
              className="text-lg font-bold"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCashDialog(false)}>Cancel</Button>
              <Button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
                Start Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Active shift dashboard
  const cashIn = cashMovements.filter((m: any) => m.type === 'cash_in' || m.type === 'sale').reduce((s: number, m: any) => s + Number(m.amount), 0);
  const cashOut = cashMovements.filter((m: any) => m.type === 'cash_out' || m.type === 'refund').reduce((s: number, m: any) => s + Number(m.amount), 0);
  const drawerBalance = Number(activeShift.opening_cash) + cashIn - cashOut;

  return (
    <div className="space-y-4">
      {/* Shift Status */}
      <Card className="border-0 shadow-sm">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 border-0">● Active</Badge>
                <span className="text-xs text-muted-foreground">Since {format(new Date(activeShift.started_at), 'HH:mm')}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmt(drawerBalance)} XAF</p>
              <p className="text-xs text-muted-foreground">Cash drawer balance</p>
            </div>
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setShowCloseDialog(true)}>
              <LogOut className="h-4 w-4" /> End Shift
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground">Opening</p>
            <p className="text-sm font-bold tabular-nums">{fmt(activeShift.opening_cash)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 text-center">
            <p className="text-xs text-emerald-600">Cash In</p>
            <p className="text-sm font-bold tabular-nums text-emerald-600">+{fmt(cashIn)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-3 text-center">
            <p className="text-xs text-destructive">Cash Out</p>
            <p className="text-sm font-bold tabular-nums text-destructive">-{fmt(cashOut)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="gap-2" onClick={() => { setCashMovementType('cash_in'); setShowMovementDialog(true); }}>
          <ArrowDownCircle className="h-4 w-4 text-emerald-600" /> Cash In
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => { setCashMovementType('cash_out'); setShowMovementDialog(true); }}>
          <ArrowUpCircle className="h-4 w-4 text-destructive" /> Cash Out
        </Button>
      </div>

      {/* Recent Movements */}
      {cashMovements.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cash Drawer Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {cashMovements.slice(0, 10).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {(m.type === 'cash_in' || m.type === 'sale') ? (
                    <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowUpCircle className="h-4 w-4 text-destructive" />
                  )}
                  <div>
                    <span className="font-medium capitalize">{m.type.replace('_', ' ')}</span>
                    {m.reason && <span className="ml-1 text-xs text-muted-foreground">— {m.reason}</span>}
                  </div>
                </div>
                <span className={`font-bold tabular-nums ${(m.type === 'cash_in' || m.type === 'sale') ? 'text-emerald-600' : 'text-destructive'}`}>
                  {(m.type === 'cash_in' || m.type === 'sale') ? '+' : '-'}{fmt(m.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cash Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {cashMovementType === 'cash_in' ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" /> : <ArrowUpCircle className="h-5 w-5 text-destructive" />}
              {cashMovementType === 'cash_in' ? 'Cash In' : 'Cash Out'}
            </DialogTitle>
          </DialogHeader>
          <Input type="number" min={0} placeholder="Amount" value={movementAmount} onChange={e => setMovementAmount(e.target.value)} className="text-lg font-bold" autoFocus />
          <Input placeholder="Reason (optional)" value={movementReason} onChange={e => setMovementReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMovementDialog(false)}>Cancel</Button>
            <Button onClick={() => addMovementMutation.mutate()} disabled={addMovementMutation.isPending}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> End of Day Reconciliation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="flex justify-between"><span>Expected drawer</span><span className="font-bold tabular-nums">{fmt(drawerBalance)} XAF</span></div>
            </div>
            <div>
              <label className="text-sm font-medium">Actual cash counted</label>
              <Input type="number" min={0} placeholder="0" value={closingCash} onChange={e => setClosingCash(e.target.value)} className="mt-1 text-lg font-bold" autoFocus />
            </div>
            {closingCash && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-lg p-3 text-sm ${parseFloat(closingCash) === drawerBalance ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                <div className="flex items-center gap-2">
                  {parseFloat(closingCash) === drawerBalance ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                  <span className="font-medium">
                    Difference: {parseFloat(closingCash) >= drawerBalance ? '+' : ''}{fmt(parseFloat(closingCash) - drawerBalance)} XAF
                  </span>
                </div>
              </motion.div>
            )}
            <Textarea placeholder="Shift notes (optional)" value={closeNotes} onChange={e => setCloseNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => closeShiftMutation.mutate()} disabled={closeShiftMutation.isPending || !closingCash}>
              Close Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
