import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Wallet, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const MerchantWalletOversight: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  // Fetch pending payout requests
  const { data: payoutRequests, isLoading: payoutsLoading } = useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_payouts')
        .select(`
          *,
          merchant:gateway_merchants(id, business_name, user_id)
        `)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch merchant wallet balances
  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: ['admin-merchant-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_merchant_wallets')
        .select(`
          *,
          merchant:gateway_merchants(id, business_name)
        `)
        .order('ledger_balance', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Approve payout mutation
  const approvePayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const payout = payoutRequests?.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      // Move funds from pending to available for withdrawal
      const { data: wallet } = await supabase
        .from('gateway_merchant_wallets')
        .select('*')
        .eq('merchant_id', payout.merchant_id)
        .eq('currency', payout.currency)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      // Update wallet: deduct from pending, no change to available (funds will be sent out)
      const { error: walletError } = await supabase
        .from('gateway_merchant_wallets')
        .update({
          pending_balance: wallet.pending_balance - payout.amount,
          ledger_balance: wallet.ledger_balance - payout.amount,
        })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      // Update payout status to processing (ready for provider execution)
      const updatedMetadata = typeof payout.metadata === 'object' && payout.metadata !== null
        ? { ...(payout.metadata as Record<string, any>) }
        : {};
        
      updatedMetadata.approved_at = new Date().toISOString();
      updatedMetadata.approved_by = (await supabase.auth.getUser()).data.user?.id;

      const { error: payoutError } = await supabase
        .from('gateway_payouts')
        .update({
          status: 'processing',
          metadata: updatedMetadata,
        })
        .eq('id', payoutId);

      if (payoutError) throw payoutError;
    },
    onSuccess: () => {
      toast.success('Payout approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-merchant-wallets'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve payout');
    },
  });

  // Reject payout mutation
  const rejectPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const payout = payoutRequests?.find(p => p.id === payoutId);
      if (!payout) throw new Error('Payout not found');

      // Return funds from pending to available
      const { data: wallet } = await supabase
        .from('gateway_merchant_wallets')
        .select('*')
        .eq('merchant_id', payout.merchant_id)
        .eq('currency', payout.currency)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const { error: walletError } = await supabase
        .from('gateway_merchant_wallets')
        .update({
          available_balance: wallet.available_balance + payout.amount,
          pending_balance: wallet.pending_balance - payout.amount,
        })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      // Update payout status
      const updatedMetadata = typeof payout.metadata === 'object' && payout.metadata !== null
        ? { ...(payout.metadata as Record<string, any>) }
        : {};
        
      updatedMetadata.rejected_at = new Date().toISOString();
      updatedMetadata.rejected_by = (await supabase.auth.getUser()).data.user?.id;

      const { error: payoutError } = await supabase
        .from('gateway_payouts')
        .update({
          status: 'rejected',
          metadata: updatedMetadata,
        })
        .eq('id', payoutId);

      if (payoutError) throw payoutError;
    },
    onSuccess: () => {
      toast.success('Payout rejected');
      queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-merchant-wallets'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject payout');
    },
  });

  const formatXAF = (amount: number) => {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Wallet} title="Merchant Wallet Oversight" description="Manage merchant balances and payout requests" />

      {/* Pending Payout Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Payout Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !payoutRequests || payoutRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutRequests.map((payout: any) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {payout.merchant?.business_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{formatXAF(payout.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{payout.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(payout.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approvePayout.mutate(payout.id)}
                        disabled={approvePayout.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectPayout.mutate(payout.id)}
                        disabled={rejectPayout.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Merchant Wallet Balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Merchant Wallet Balances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {walletsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !wallets || wallets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No wallets found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Total Ledger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((wallet: any) => (
                  <TableRow key={wallet.id}>
                    <TableCell className="font-medium">
                      {wallet.merchant?.business_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{wallet.currency}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatXAF(wallet.available_balance)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                      {formatXAF(wallet.pending_balance)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatXAF(wallet.ledger_balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantWalletOversight;
