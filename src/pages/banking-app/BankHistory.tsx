import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Download, ArrowDownLeft, Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useBankTransactions } from '@/hooks/useBankingData';
import { supabase } from '@/integrations/supabase/client';
import { StatementDownloadDialog } from '@/components/statements/StatementDownloadDialog';

const BankHistory: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'Credit' | 'Debit'>('all');
  const { data: transactions, isLoading } = useBankTransactions(50);

  const filtered = (transactions || []).filter((tx) => {
    const info = tx.transaction_information || tx.transaction_type || '';
    const matchSearch = info.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || tx.credit_debit_indicator === filter;
    return matchSearch && matchFilter;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Group by date
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, tx) => {
    const label = formatDate(tx.created_at);
    if (!acc[label]) acc[label] = [];
    acc[label].push(tx);
    return acc;
  }, {});

  return (
    <div className="flex flex-col px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">History</h1>
        <StatementDownloadDialog
          source="banking"
          institutionId={institutionId}
          getPreviewData={async ({ from, to }) => {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) return null;
            const [{ data: profile }, { data: accts }, { data: inst }] = await Promise.all([
              supabase.from('profiles').select('full_name, email, phone_number, address, city, country_code').eq('id', u.id).maybeSingle(),
              supabase.from('accounts')
                .select('id, account_id, account_holder_name, currency, identification_value')
                .eq('user_id', u.id)
                .eq('institution_id', institutionId!)
                .eq('is_active', true)
                .limit(1),
              institutionId
                ? supabase.from('institutions').select('institution_name, address, country').eq('id', institutionId).maybeSingle()
                : Promise.resolve({ data: null }),
            ]);
            const acct = (accts || [])[0] || ({} as any);
            let txCount = 0;
            if (acct.id) {
              const { count } = await supabase.from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('account_id', acct.id)
                .gte('created_at', from)
                .lte('created_at', to);
              txCount = count || 0;
            }
            const bankName = (inst as any)?.institution_name || 'Your Bank';
            return {
              customer: {
                full_name: profile?.full_name || u.email || 'Account holder',
                address_lines: [profile?.address, profile?.city, profile?.country_code, profile?.phone_number].filter(Boolean) as string[],
              },
              account: {
                holder_name: acct.account_holder_name || profile?.full_name,
                account_no: acct.account_id || acct.identification_value || '—',
                currency: acct.currency || 'XAF',
              },
              bank: {
                name: bankName,
                address_lines: [(inst as any)?.address, (inst as any)?.country].filter(Boolean) as string[],
              },
              tx_count: txCount,
              preview_serial: `BANK-PREVIEW-${from.slice(0, 10).replace(/-/g, '')}-${to.slice(0, 10).replace(/-/g, '')}`,
            };
          }}
          trigger={
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl font-semibold">
              <Download className="h-4 w-4" strokeWidth={2} />
              Statement
            </Button>
          }
        />

      </div>


      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-2xl border-2 py-6 pl-11 text-base font-medium"
        />
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        {([{ key: 'all', label: 'All' }, { key: 'Credit', label: 'Income' }, { key: 'Debit', label: 'Expense' }] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition-colors ${
              filter === f.key
                ? f.key === 'Credit' ? 'bg-[hsl(var(--bank-mint))] text-[hsl(var(--bank-mint-fg))]'
                  : f.key === 'Debit' ? 'bg-[hsl(var(--bank-coral))] text-white'
                  : 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No transactions found</p>
      ) : (
        <div className="flex flex-col gap-5">
          {Object.entries(grouped).map(([dateLabel, txs]) => (
            <div key={dateLabel}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{dateLabel}</p>
              <div className="flex flex-col gap-1">
                {txs.map((tx, i) => {
                  const isCredit = tx.credit_debit_indicator === 'Credit';
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between rounded-2xl px-3 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          isCredit ? 'bg-[hsl(var(--bank-mint))]/15' : 'bg-[hsl(var(--bank-coral))]/15'
                        }`}>
                          {isCredit ? (
                            <ArrowDownLeft className="h-5 w-5 text-[hsl(var(--bank-teal))]" strokeWidth={1.5} />
                          ) : (
                            <Send className="h-5 w-5 text-[hsl(var(--bank-coral))]" strokeWidth={1.5} />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {tx.transaction_information || tx.transaction_type}
                          </p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {tx.transaction_type}
                          </p>
                        </div>
                      </div>
                      <span className={`text-base font-bold ${
                        isCredit ? 'text-[hsl(var(--bank-teal))]' : 'text-foreground'
                      }`}>
                        {isCredit ? '+' : '-'}{Math.abs(tx.amount || 0).toLocaleString()} {tx.currency}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BankHistory;
