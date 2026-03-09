import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFeeEstimate } from "@/hooks/useFeeEstimate";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, Percent, Calculator } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function MerchantFees() {
  const [estimatorChannel, setEstimatorChannel] = useState("mobile_money");
  const [estimatorAmount, setEstimatorAmount] = useState("10000");
  
  const { data: merchant } = useQuery({
    queryKey: ["merchant-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("gateway_merchants")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: feeStats, isLoading } = useQuery({
    queryKey: ["merchant-fee-stats", merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return null;
      
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const ytdStart = new Date(now.getFullYear(), 0, 1);

      // Fetch fees via gateway_charges
      const { data: charges, error } = await supabase
        .from("gateway_charges")
        .select("amount, fee_amount, channel, created_at")
        .eq("merchant_id", merchant.id)
        .eq("status", "successful");
      
      if (error) throw error;

      const thisMonthFees = charges?.filter(c => new Date(c.created_at) >= thisMonthStart)
        .reduce((sum, c) => sum + (Number(c.fee_amount) || 0), 0) || 0;
      
      const lastMonthFees = charges?.filter(c => 
        new Date(c.created_at) >= lastMonthStart && new Date(c.created_at) <= lastMonthEnd)
        .reduce((sum, c) => sum + (Number(c.fee_amount) || 0), 0) || 0;
      
      const ytdFees = charges?.filter(c => new Date(c.created_at) >= ytdStart)
        .reduce((sum, c) => sum + (Number(c.fee_amount) || 0), 0) || 0;

      const totalRevenue = charges?.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) || 0;
      const feeToRevenueRatio = totalRevenue > 0 ? (ytdFees / totalRevenue) * 100 : 0;
      
      const avgFeePerTx = charges?.length ? ytdFees / charges.length : 0;

      // Fee breakdown by channel
      const channelBreakdown = charges?.reduce((acc: Record<string, number>, c) => {
        const channel = c.channel || "unknown";
        const fee = Number(c.fee_amount) || 0;
        acc[channel] = (acc[channel] || 0) + fee;
        return acc;
      }, {});

      const feeByChannel = Object.entries(channelBreakdown || {}).map(([name, value]) => ({
        name,
        value,
      }));

      return {
        thisMonthFees,
        lastMonthFees,
        ytdFees,
        feeToRevenueRatio,
        avgFeePerTx,
        feeByChannel,
        transactionHistory: charges?.slice(-20).map(c => ({
          date: new Date(c.created_at).toLocaleDateString(),
          channel: c.channel,
          amount: Number(c.amount),
          fee: Number(c.fee_amount),
        })) || [],
      };
    },
    enabled: !!merchant?.id,
  });

  const { fee: estimatedFee } = useFeeEstimate({
    channel: estimatorChannel,
    amount: Number(estimatorAmount) || 0,
    scope: "merchant",
    merchantId: merchant?.id,
    enabled: !!merchant?.id && !!estimatorAmount,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Fee Transparency</h1>
          <p className="text-muted-foreground">Understand your transaction fees</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fee Transparency</h1>
        <p className="text-muted-foreground">Understand your transaction fees and costs</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeStats?.thisMonthFees?.toLocaleString() || 0} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeStats?.lastMonthFees?.toLocaleString() || 0} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Fee/Revenue Ratio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeStats?.feeToRevenueRatio?.toFixed(2) || 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Avg Fee/Tx
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(feeStats?.avgFeePerTx || 0)} XAF</div>
          </CardContent>
        </Card>
      </div>

      {/* Fee Estimator Widget */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Estimator</CardTitle>
          <CardDescription>Calculate fees for your transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="channel">Payment Method</Label>
              <Select value={estimatorChannel} onValueChange={setEstimatorChannel}>
                <SelectTrigger id="channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="card">Card Payment</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (XAF)</Label>
              <Input
                id="amount"
                type="number"
                value={estimatorAmount}
                onChange={(e) => setEstimatorAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fixed Fee</span>
              <span className="font-medium">{estimatedFee.fixedFee} XAF</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Percentage Fee ({(estimatedFee.feePercent * 100).toFixed(2)}%)</span>
              <span className="font-medium">{(estimatedFee.totalFee - estimatedFee.fixedFee).toFixed(0)} XAF</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span>Total Fee</span>
              <span>{estimatedFee.totalFee} XAF</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">You Receive</span>
              <span className="font-medium text-primary">{estimatedFee.netAmount.toLocaleString()} XAF</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Breakdown Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fees by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={feeStats?.feeByChannel || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(feeStats?.feeByChannel || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transaction Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={feeStats?.transactionHistory || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="fee" fill="#8884d8" name="Fee (XAF)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
