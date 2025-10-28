import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Lock, 
  Unlock, 
  ArrowUpCircle, 
  Eye, 
  EyeOff,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VirtualCardDisplayProps {
  card: any;
  onTopUp: () => void;
  onViewTransactions: () => void;
  onRefresh: () => void;
}

export const VirtualCardDisplay = ({ 
  card, 
  onTopUp, 
  onViewTransactions,
  onRefresh 
}: VirtualCardDisplayProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleToggleStatus = async () => {
    setIsUpdatingStatus(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const newStatus = card.status === 'active' ? 'inactive' : 'active';

      const response = await supabase.functions.invoke('virtual-card-update-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          card_id: card.id,
          status: newStatus,
        },
      });

      if (response.error) throw response.error;

      toast.success(
        newStatus === 'active' 
          ? 'Card activated successfully' 
          : 'Card frozen successfully'
      );
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update card status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'inactive':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'blocked':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      <CardHeader className="relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">{card.card_name}</h3>
          </div>
          <Badge className={getStatusColor(card.status)} variant="secondary">
            {card.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Card Number</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="font-mono text-lg">
            {showDetails ? (
              <span>**** **** **** {card.last4}</span>
            ) : (
              <span>**** **** **** ****</span>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <span className="text-xs text-muted-foreground">Expiry</span>
              <div className="font-mono">
                {showDetails 
                  ? `${String(card.exp_month).padStart(2, '0')}/${String(card.exp_year).slice(-2)}`
                  : '**/**'
                }
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Brand</span>
              <div className="font-semibold">{card.brand}</div>
            </div>
          </div>
        </div>

        <div className="bg-primary/5 rounded-lg p-4">
          <span className="text-sm text-muted-foreground">Available Balance</span>
          <div className="text-2xl font-bold text-primary">
            ${parseFloat(card.balance_usd || 0).toFixed(2)}
          </div>
        </div>
      </CardContent>

      <CardFooter className="relative flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 w-full">
          <Button 
            onClick={onTopUp}
            variant="default"
            disabled={card.status !== 'active'}
          >
            <ArrowUpCircle className="mr-2 h-4 w-4" />
            Top Up
          </Button>
          <Button 
            onClick={onViewTransactions}
            variant="outline"
          >
            <Settings className="mr-2 h-4 w-4" />
            Transactions
          </Button>
        </div>
        <Button
          onClick={handleToggleStatus}
          variant="outline"
          className="w-full"
          disabled={isUpdatingStatus || card.status === 'cancelled'}
        >
          {card.status === 'active' ? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Freeze Card
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-4 w-4" />
              Activate Card
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
