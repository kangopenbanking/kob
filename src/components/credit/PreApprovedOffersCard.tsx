import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AlertTriangle, Building2, CheckCircle, Percent, Clock, Banknote, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PreApprovedOffersCardProps {
  creditScore: number;
}

interface Offer {
  id: string;
  institution_id: string;
  product_name: string;
  description: string | null;
  min_credit_score: number;
  max_credit_score: number;
  min_amount: number;
  max_amount: number;
  interest_rate_annual: number;
  max_tenure_months: number;
  currency: string;
  requires_existing_account: boolean;
  has_existing_account?: boolean;
  institution_name?: string;
  bank_id?: string | null;
  bank_name?: string | null;
  apply_path?: string | null;
}

export default function PreApprovedOffersCard({ creditScore }: PreApprovedOffersCardProps) {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [requestedAmount, setRequestedAmount] = useState<number>(0);
  const [requestedTenure, setRequestedTenure] = useState<number>(12);
  const queryClient = useQueryClient();

  const { data: offers, isLoading } = useQuery({
    queryKey: ['preapproved-offers', creditScore],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: { action: 'preapproved-offers', credit_score: creditScore }
      });
      if (error) throw error;
      return (data?.offers || []) as Offer[];
    },
    enabled: creditScore > 0,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOffer) throw new Error('No offer selected');
      const { data, error } = await supabase.functions.invoke('credit-ops', {
        body: {
          action: 'apply-preapproved',
          offer_id: selectedOffer.id,
          requested_amount: requestedAmount,
          requested_tenure_months: requestedTenure,
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Application submitted successfully', {
        description: `Reference: ${data?.application_id?.slice(0, 8)}...`
      });
      setSelectedOffer(null);
      queryClient.invalidateQueries({ queryKey: ['credit-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['preapproved-applications'] });
    },
    onError: (err: any) => {
      toast.error('Application failed', { description: err.message });
    }
  });

  const openApplyDialog = (offer: Offer) => {
    setSelectedOffer(offer);
    setRequestedAmount(offer.min_amount);
    setRequestedTenure(Math.min(12, offer.max_tenure_months));
  };

  const monthlyPayment = selectedOffer
    ? (() => {
        const r = selectedOffer.interest_rate_annual / 100 / 12;
        if (r === 0) return requestedAmount / requestedTenure;
        return (requestedAmount * r * Math.pow(1 + r, requestedTenure)) / (Math.pow(1 + r, requestedTenure) - 1);
      })()
    : 0;

  if (isLoading) return null;
  if (!offers || offers.length === 0) return null;

  return (
    <>
      <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <Banknote className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            </div>
            <div>
              <CardTitle className="text-lg">Pre-Approved Loans</CardTitle>
              <CardDescription className="text-xs">Based on your CrediQ score of {creditScore}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="rounded-xl border border-border/60 p-4 space-y-3 bg-background/80"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{offer.product_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{offer.institution_name || 'Financial Institution'}</p>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700 dark:bg-emerald-900/50 text-[10px]">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Eligible
                </Badge>
              </div>

              {offer.description && (
                <p className="text-xs text-muted-foreground">{offer.description}</p>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground">Up to</p>
                  <p className="text-sm font-bold">{(offer.max_amount / 1000000).toFixed(1)}M</p>
                  <p className="text-[10px] text-muted-foreground">{offer.currency}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <Percent className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-sm font-bold">{offer.interest_rate_annual}%</p>
                  <p className="text-[10px] text-muted-foreground">p.a.</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                  <p className="text-sm font-bold">{offer.max_tenure_months}</p>
                  <p className="text-[10px] text-muted-foreground">months</p>
                </div>
              </div>

              <Button
                size="sm"
                className="w-full rounded-full"
                onClick={() => openApplyDialog(offer)}
              >
                {offer.requires_existing_account ? 'Open Account & Apply' : 'Apply Now'}
                {offer.requires_existing_account && <ExternalLink className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Apply Dialog */}
      <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Apply for {selectedOffer?.product_name}</DialogTitle>
            <DialogDescription>
              {selectedOffer?.institution_name || 'Financial Institution'}
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-5">
              {/* Hard Check Warning */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Hard Credit Check</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    This application will trigger a hard credit inquiry that may temporarily reduce your score by 2-10 points. The bank will perform additional checks before a final decision.
                  </p>
                </div>
              </div>

              {selectedOffer.requires_existing_account && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Building2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Account Required</p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                      You'll need to open an account with this bank. They will guide you through the process after application.
                    </p>
                  </div>
                </div>
              )}

              {/* Amount Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Loan Amount ({selectedOffer.currency})</Label>
                <Input
                  type="number"
                  value={requestedAmount}
                  onChange={e => setRequestedAmount(Math.min(Math.max(Number(e.target.value), selectedOffer.min_amount), selectedOffer.max_amount))}
                  min={selectedOffer.min_amount}
                  max={selectedOffer.max_amount}
                />
                <Slider
                  value={[requestedAmount]}
                  onValueChange={v => setRequestedAmount(v[0])}
                  min={selectedOffer.min_amount}
                  max={selectedOffer.max_amount}
                  step={50000}
                  className="mt-1"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{selectedOffer.min_amount.toLocaleString()}</span>
                  <span>{selectedOffer.max_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Tenure Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Repayment Period (months)</Label>
                <Slider
                  value={[requestedTenure]}
                  onValueChange={v => setRequestedTenure(v[0])}
                  min={3}
                  max={selectedOffer.max_tenure_months}
                  step={3}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">3 months</span>
                  <span className="font-bold">{requestedTenure} months</span>
                  <span className="text-muted-foreground">{selectedOffer.max_tenure_months} months</span>
                </div>
              </div>

              {/* Estimated Payment */}
              <div className="rounded-xl bg-muted/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">Estimated Monthly Payment</p>
                <p className="text-2xl font-bold mt-1">
                  {Math.round(monthlyPayment).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{selectedOffer.currency}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Total: {Math.round(monthlyPayment * requestedTenure).toLocaleString()} {selectedOffer.currency}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOffer(null)}>Cancel</Button>
            <Button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
