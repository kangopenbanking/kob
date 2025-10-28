import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BusinessTransactionLimitsProps {
  accountId: string;
  currentLimits: any;
  onUpdate: (limits: any) => void;
}

export const BusinessTransactionLimits = ({ accountId, currentLimits, onUpdate }: BusinessTransactionLimitsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState({
    daily_limit: currentLimits?.daily_limit || "",
    monthly_limit: currentLimits?.monthly_limit || "",
    per_transaction_limit: currentLimits?.per_transaction_limit || "",
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const limitsData = {
        daily_limit: parseFloat(limits.daily_limit) || 0,
        monthly_limit: parseFloat(limits.monthly_limit) || 0,
        per_transaction_limit: parseFloat(limits.per_transaction_limit) || 0,
      };

      const { error } = await supabase
        .from("accounts")
        .update({ transaction_limits: limitsData })
        .eq("id", accountId);

      if (error) throw error;

      toast({ title: "Transaction limits updated successfully" });
      onUpdate(limitsData);
    } catch (error: any) {
      toast({
        title: "Error updating limits",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Limits</CardTitle>
        <CardDescription>
          Set spending limits for your business account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Transaction limits help protect your account from unauthorized large transactions.
            Contact support for limits above 10,000,000 XAF.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="daily_limit">Daily Transaction Limit (XAF)</Label>
            <Input
              id="daily_limit"
              type="number"
              value={limits.daily_limit}
              onChange={(e) => setLimits({ ...limits, daily_limit: e.target.value })}
              placeholder="5000000"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum total amount for all transactions in a day
            </p>
          </div>

          <div>
            <Label htmlFor="monthly_limit">Monthly Transaction Limit (XAF)</Label>
            <Input
              id="monthly_limit"
              type="number"
              value={limits.monthly_limit}
              onChange={(e) => setLimits({ ...limits, monthly_limit: e.target.value })}
              placeholder="50000000"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum total amount for all transactions in a month
            </p>
          </div>

          <div>
            <Label htmlFor="per_transaction_limit">Per Transaction Limit (XAF)</Label>
            <Input
              id="per_transaction_limit"
              type="number"
              value={limits.per_transaction_limit}
              onChange={(e) => setLimits({ ...limits, per_transaction_limit: e.target.value })}
              placeholder="1000000"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Maximum amount for a single transaction
            </p>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">Current Limits Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Daily</p>
                <p className="font-bold">
                  {limits.daily_limit ? `${parseFloat(limits.daily_limit).toLocaleString()} XAF` : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly</p>
                <p className="font-bold">
                  {limits.monthly_limit ? `${parseFloat(limits.monthly_limit).toLocaleString()} XAF` : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Per Transaction</p>
                <p className="font-bold">
                  {limits.per_transaction_limit ? `${parseFloat(limits.per_transaction_limit).toLocaleString()} XAF` : "Not set"}
                </p>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Saving..." : "Save Limits"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
