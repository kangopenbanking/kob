import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, ShoppingBag, Zap, Smartphone, Search, Gift, Receipt, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerTransactions, useDeleteTransaction } from '@/hooks/useCustomerData';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const filters = ['All', 'Income', 'Expenses', 'Transfers'];

const txIconMap: Record<string, { icon: React.ElementType; color: string; iconColor: string }> = {
  transfer: { icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  payment: { icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  deposit: { icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]', iconColor: 'text-[hsl(150,40%,35%)]' },
  bill_payment: { icon: Zap, color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  airtime: { icon: Smartphone, color: 'bg-[hsl(340,60%,92%)]', iconColor: 'text-[hsl(340,50%,40%)]' },
  reward: { icon: Gift, color: 'bg-[hsl(45,70%,90%)]', iconColor: 'text-[hsl(45,60%,35%)]' },
  default: { icon: Receipt, color: 'bg-muted', iconColor: 'text-muted-foreground' },
};

function getDateGroup(dateStr: string | null): string {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d, yyyy');
}

function getTxCategory(tx: any): string {
  if (tx.credit_debit_indicator === 'Credit') return 'Income';
  if (tx.transaction_type === 'transfer') return 'Transfers';
  return 'Expenses';
}

const CustomerActivity: React.FC = () => {
  const { user } = useCustomerAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; info: string } | null>(null);

  const { data: transactions = [], isLoading } = useCustomerTransactions(user?.id, undefined, 50);
  const deleteMutation = useDeleteTransaction();

  const filtered = transactions.filter((tx: any) => {
    const cat = getTxCategory(tx);
    if (activeFilter !== 'All' && cat !== activeFilter) return false;
    if (search && !(tx.transaction_information || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, any[]>>((acc, tx: any) => {
    const group = getDateGroup(tx.booking_datetime);
    (acc[group] = acc[group] || []).push(tx);
    return acc;
  }, {});

  const handleDelete = (tx: any) => {
    setDeleteTarget({ id: tx.id, info: tx.transaction_information || tx.transaction_type || 'Transaction' });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Transaction record removed from your history');
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error('Could not remove transaction. Please try again.');
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <h1 className="text-xl font-bold text-foreground">Activity</h1>

      <div className="flex items-center gap-2 rounded-2xl bg-muted p-3">
        <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions..." className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground" />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-colors ${activeFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <p className="text-sm font-semibold text-muted-foreground">No transactions found</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{date}</p>
            <div className="space-y-2">
              {txs.map((tx: any, i: number) => {
                const isCredit = tx.credit_debit_indicator === 'Credit';
                const amount = tx.amount || 0;
                const txType = tx.transaction_type?.toLowerCase() || 'default';
                const iconInfo = txIconMap[txType] || txIconMap.default;
                const TxIcon = iconInfo.icon;
                const time = tx.booking_datetime ? format(new Date(tx.booking_datetime), 'h:mm a') : '';
                return (
                  <motion.div key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${iconInfo.color}`}>
                      <TxIcon className={`h-5 w-5 ${iconInfo.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.transaction_information || tx.transaction_type}</p>
                      <p className="text-[11px] text-muted-foreground">{tx.transaction_type} · {time}</p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${isCredit ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                      {isCredit ? '+' : '-'}{Math.abs(amount).toLocaleString()} <span className="text-[10px] font-medium text-muted-foreground">{tx.currency}</span>
                    </p>
                    <button
                      onClick={() => handleDelete(tx)}
                      className="shrink-0 p-1.5 rounded-xl hover:bg-destructive/10 active:scale-95 opacity-50 hover:opacity-100 transition-opacity"
                      aria-label="Delete transaction"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" strokeWidth={1.5} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.info}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CustomerActivity;
