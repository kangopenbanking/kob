import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { DollarSign, TrendingUp } from "lucide-react";

const TIERS = {
  free: { name: "Free", limit: 100, costPerQuery: 0, color: "bg-gray-100 dark:bg-gray-900" },
  standard: { name: "Standard", limit: 5000, costPerQuery: 50, color: "bg-blue-100 dark:bg-blue-900" },
  premium: { name: "Premium", limit: 50000, costPerQuery: 35, color: "bg-purple-100 dark:bg-purple-900" },
  enterprise: { name: "Enterprise", limit: Infinity, costPerQuery: 25, color: "bg-green-100 dark:bg-green-900" }
};

export function PricingCalculator() {
  const [tier, setTier] = useState<keyof typeof TIERS>("standard");
  const [monthlyQueries, setMonthlyQueries] = useState(1000);

  const selectedTier = TIERS[tier];
  const monthlyCost = monthlyQueries * selectedTier.costPerQuery;
  const dailyAverage = Math.ceil(monthlyQueries / 30);
  const withinLimit = dailyAverage <= selectedTier.limit;

  return (
    <Card className={selectedTier.color}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Cost Calculator
        </CardTitle>
        <CardDescription>Estimate your monthly API costs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Pricing Tier</Label>
            <Select value={tier} onValueChange={(value) => setTier(value as keyof typeof TIERS)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIERS).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.name} - {value.costPerQuery} XAF/query
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monthly Queries</Label>
            <Input
              type="number"
              value={monthlyQueries}
              onChange={(e) => setMonthlyQueries(Number(e.target.value))}
              min={0}
              step={100}
            />
          </div>
        </div>

        <div className="p-6 bg-background rounded-lg border-2 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Cost per Query:</span>
            <span className="text-2xl font-bold">{selectedTier.costPerQuery} XAF</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Monthly Cost:</span>
            <span className="text-3xl font-bold text-primary">
              {monthlyCost.toLocaleString()} XAF
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Daily Average:</span>
            <div className="flex items-center gap-2">
              <span>{dailyAverage} queries/day</span>
              {withinLimit ? (
                <Badge variant="default" className="bg-green-600">Within Limit</Badge>
              ) : (
                <Badge variant="destructive">Exceeds Daily Limit</Badge>
              )}
            </div>
          </div>

          {!withinLimit && selectedTier.limit !== Infinity && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Your daily average exceeds the {selectedTier.name} tier limit of {selectedTier.limit} queries/day. 
              Consider upgrading to a higher tier.
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          * Calculations are estimates. Actual costs may vary based on usage patterns. 
          Billing is processed monthly based on actual query count.
        </div>
      </CardContent>
    </Card>
  );
}
