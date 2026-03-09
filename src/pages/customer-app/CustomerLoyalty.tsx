import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Gift, TrendingUp, Award, Star, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export function CustomerLoyalty() {
  const { user } = useCustomerAuth();
  const navigate = useNavigate();

  const { data: rewards } = useQuery({
    queryKey: ['customer-rewards', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_rewards')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: recentTransactions } = useQuery({
    queryKey: ['reward-transactions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_reward_transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <Card className="p-12 text-center max-w-md mx-auto mt-20">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to view your rewards</p>
          <Button onClick={() => navigate('/app/auth')}>Sign In</Button>
        </Card>
      </div>
    );
  }

  const totalPoints = rewards?.total_earned || 0;
  const availablePoints = rewards?.current_balance || 0;
  const redeemedPoints = rewards?.total_redeemed || 0;
  const nextTier = 1000;
  const progressToNextTier = Math.min((totalPoints / nextTier) * 100, 100);

  const tiers = [
    { name: 'Bronze', min: 0, color: 'text-amber-700', icon: Award },
    { name: 'Silver', min: 1000, color: 'text-gray-400', icon: Star },
    { name: 'Gold', min: 5000, color: 'text-yellow-500', icon: Sparkles },
  ];

  const currentTier = tiers.reduce((acc, tier) => (totalPoints >= tier.min ? tier : acc), tiers[0]);
  const TierIcon = currentTier.icon;

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Rewards</h1>
          <p className="text-muted-foreground">Earn points on every purchase</p>
        </div>

        {/* Points Balance */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TierIcon className={`h-6 w-6 ${currentTier.color}`} />
              <span className="font-semibold">{currentTier.name} Member</span>
            </div>
            <Gift className="h-6 w-6 text-muted-foreground" />
          </div>
          
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold">{availablePoints.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Available Points</p>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress to {tiers[1].name}</span>
              <span className="font-medium">{totalPoints} / {nextTier}</span>
            </div>
            <Progress value={progressToNextTier} className="h-2" />
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Earned</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Gift className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{redeemedPoints.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Redeemed</p>
              </div>
            </div>
          </Card>
        </div>

        {/* How to Earn */}
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">How to Earn Points</h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold">1%</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Cashback on Purchases</p>
                <p className="text-sm text-muted-foreground">
                  Earn 1% cashback on transfers of 10,000 XAF or more
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Gift className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Referral Bonus</p>
                <p className="text-sm text-muted-foreground">
                  Get 500 XAF for each friend you refer
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Star className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Bonus Points</p>
                <p className="text-sm text-muted-foreground">
                  Special offers and promotions
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <h2 className="font-semibold">Recent Activity</h2>
          {recentTransactions && recentTransactions.length > 0 ? (
            <div className="space-y-2">
              {recentTransactions.map((txn: any) => (
                <Card key={txn.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{txn.transaction_type.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(txn.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${txn.points_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {txn.points_change > 0 ? '+' : ''}{txn.points_change}
                      </p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No activity yet</p>
              <Button className="mt-4" onClick={() => navigate('/app/marketplace')}>
                Start Earning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
