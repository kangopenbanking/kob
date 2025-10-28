import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateCardFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const CreateCardForm = ({ onSuccess, onCancel }: CreateCardFormProps) => {
  const [cardName, setCardName] = useState("");
  const [programId, setProgramId] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { data: programsData } = useQuery({
    queryKey: ['virtual-card-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_card_programs')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
  });

  const programs = programsData || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cardName.trim() || !programId) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('virtual-card-create', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          card_name: cardName,
          program_id: programId,
          spending_limits: {
            monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : undefined,
            daily_limit: dailyLimit ? parseFloat(dailyLimit) : undefined,
          },
        },
      });

      if (response.error) throw response.error;

      toast.success('Virtual card created successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating card:', error);
      toast.error(error.message || 'Failed to create virtual card');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="cardName">Card Name *</Label>
        <Input
          id="cardName"
          placeholder="e.g., Online Shopping Card"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          required
        />
        <p className="text-sm text-muted-foreground">
          Give your card a memorable name
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="program">Card Program *</Label>
        <Select value={programId} onValueChange={setProgramId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select a card program" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((program: any) => (
              <SelectItem key={program.id} value={program.id}>
                <div className="flex flex-col">
                  <span className="font-medium">{program.program_name}</span>
                  <span className="text-xs text-muted-foreground">
                    Max: ${program.max_balance} | Monthly: ${program.monthly_spend_limit}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dailyLimit">Daily Limit (USD)</Label>
          <Input
            id="dailyLimit"
            type="number"
            step="0.01"
            placeholder="e.g., 100"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthlyLimit">Monthly Limit (USD)</Label>
          <Input
            id="monthlyLimit"
            type="number"
            step="0.01"
            placeholder="e.g., 500"
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Important Information</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Your card will be issued in USD</li>
          <li>• Top up from your local currency wallet with automatic conversion</li>
          <li>• Use for online purchases worldwide</li>
          <li>• Card details will be available immediately after creation</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isCreating}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isCreating} className="flex-1">
          {isCreating ? 'Creating...' : 'Create Card'}
        </Button>
      </div>
    </form>
  );
};
