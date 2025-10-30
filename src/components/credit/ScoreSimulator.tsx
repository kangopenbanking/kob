import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ScoreSimulatorProps {
  currentScore: number;
}

const ScoreSimulator = ({ currentScore }: ScoreSimulatorProps) => {
  const [simulationType, setSimulationType] = useState('loan_payoff');
  const [amount, setAmount] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSimulate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setSimulating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('credit-score-simulate', {
        body: {
          simulation_type: simulationType,
          amount: parseFloat(amount),
        },
      });

      if (error) throw error;

      setResult(data);
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: 'Simulation failed',
        description: 'Failed to simulate credit score impact',
        variant: 'destructive',
      });
    } finally {
      setSimulating(false);
    }
  };

  const getScenarioLabel = (type: string) => {
    switch (type) {
      case 'loan_payoff': return 'Pay Off Loan';
      case 'savings_deposit': return 'Make Savings Deposit';
      case 'new_account': return 'Open New Account';
      case 'payment_skip': return 'Skip Payment';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-primary" />
          <CardTitle>Score Simulator</CardTitle>
        </div>
        <CardDescription>
          See how different actions could impact your credit score
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scenario">Scenario</Label>
          <Select value={simulationType} onValueChange={setSimulationType}>
            <SelectTrigger id="scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loan_payoff">Pay Off Loan</SelectItem>
              <SelectItem value="savings_deposit">Make Savings Deposit</SelectItem>
              <SelectItem value="new_account">Open New Account</SelectItem>
              <SelectItem value="payment_skip">Skip Payment (Warning)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {simulationType !== 'new_account' && (
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (XAF)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}

        <Button 
          onClick={handleSimulate} 
          disabled={simulating}
          className="w-full"
        >
          {simulating ? 'Simulating...' : 'Calculate Impact'}
        </Button>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Current Score</span>
              <span className="font-semibold">{result.current_score}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Predicted Score</span>
              <span className="font-semibold">{result.predicted_score}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm font-medium">Impact</span>
              <div className={`flex items-center gap-1 font-bold ${
                result.score_change > 0 ? 'text-green-600' : 
                result.score_change < 0 ? 'text-red-600' : 
                'text-muted-foreground'
              }`}>
                {result.score_change > 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : result.score_change < 0 ? (
                  <TrendingDown className="w-4 h-4" />
                ) : null}
                <span>
                  {result.score_change > 0 ? '+' : ''}{result.score_change} points
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScoreSimulator;
