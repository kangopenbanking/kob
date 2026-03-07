import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Smartphone, Wallet, CreditCard, Globe, Plus, ShieldCheck, ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const MAX_LINKED_ACCOUNTS = 3;

const typeConfig: Record<string, { icon: typeof Building2; label: string; color: string; iconColor: string }> = {
  bank_account: { icon: Building2, label: 'Bank Account', color: 'bg-[hsl(210,80%,93%)]', iconColor: 'text-[hsl(210,60%,45%)]' },
  bank_iban: { icon: Globe, label: 'IBAN', color: 'bg-[hsl(270,50%,92%)]', iconColor: 'text-[hsl(270,50%,45%)]' },
  momo_mtn: { icon: Smartphone, label: 'MTN MoMo', color: 'bg-[hsl(50,80%,90%)]', iconColor: 'text-[hsl(50,60%,35%)]' },
  momo_orange: { icon: Smartphone, label: 'Orange Money', color: 'bg-[hsl(25,80%,92%)]', iconColor: 'text-[hsl(25,60%,40%)]' },
  paypal: { icon: Wallet, label: 'PayPal', color: 'bg-[hsl(210,70%,90%)]', iconColor: 'text-[hsl(210,70%,50%)]' },
  bank_card: { icon: CreditCard, label: 'Bank Card', color: 'bg-[hsl(225,70%,92%)]', iconColor: 'text-[hsl(225,60%,50%)]' },
};

const getConfig = (type: string) => typeConfig[type] || typeConfig.bank_account;

export default function LinkedAccountsWidget() {
  const { data: linkedAccounts = [], isLoading } = useQuery({
    queryKey: ['personal-linked-accounts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('customer_linked_accounts')
        .select('id, account_type, account_name, provider_name, last4, is_primary, status, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['personal-linked-requests'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from('linked_account_change_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    },
  });

  const count = linkedAccounts.length;
  const atLimit = count >= MAX_LINKED_ACCOUNTS;
  const pendingCount = pendingRequests.length;

  return (
    <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(210,80%,60%)]" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary" />
              Linked Accounts
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {count}/{MAX_LINKED_ACCOUNTS} accounts · Max 3 allowed
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] ${atLimit ? 'border-destructive/30 text-destructive' : 'border-primary/30 text-primary'}`}
          >
            {atLimit ? 'Limit Reached' : `${MAX_LINKED_ACCOUNTS - count} slot${MAX_LINKED_ACCOUNTS - count !== 1 ? 's' : ''} left`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">No accounts linked</p>
            <p className="text-[11px] text-muted-foreground max-w-[200px]">
              Link a bank, mobile money, or card to unlock full features
            </p>
            <Button asChild size="sm" className="rounded-full mt-1 gap-1.5">
              <Link to="/app/linked-accounts">
                <Plus className="h-3.5 w-3.5" /> Link Account
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {linkedAccounts.map((acc: any) => {
                const config = getConfig(acc.account_type);
                const Icon = config.icon;
                return (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.color}`}>
                      <Icon className={`h-4 w-4 ${config.iconColor}`} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {acc.account_name || config.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {acc.provider_name} •••• {acc.last4}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {acc.is_primary && (
                        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary px-1.5 py-0">
                          Primary
                        </Badge>
                      )}
                      <ShieldCheck className="h-3.5 w-3.5 text-[hsl(150,50%,40%)]" strokeWidth={1.5} />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pending requests banner */}
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-[hsl(40,90%,92%)] p-3">
                <Clock className="h-4 w-4 text-[hsl(40,80%,40%)] shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] text-[hsl(40,80%,30%)]">
                  {pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting admin approval
                </p>
              </div>
            )}

            {/* Admin approval info */}
            <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5} />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Removing an account and re-adding requires admin approval to prevent fraud.
              </p>
            </div>
          </>
        )}

        {/* Manage link */}
        <Button asChild variant="outline" size="sm" className="w-full rounded-xl gap-1.5 text-xs">
          <Link to="/app/linked-accounts">
            Manage Linked Accounts <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
