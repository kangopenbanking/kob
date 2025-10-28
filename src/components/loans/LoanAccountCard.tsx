import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, DollarSign, TrendingDown, Clock } from "lucide-react";
import LoanRepaymentForm from "./LoanRepaymentForm";
import RepaymentSchedule from "./RepaymentSchedule";

interface LoanAccountCardProps {
  loan: any;
}

export default function LoanAccountCard({ loan }: LoanAccountCardProps) {
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);

  const { data: schedules } = useQuery({
    queryKey: ['loan-schedules', loan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_repayment_schedules')
        .select('*')
        .eq('loan_account_id', loan.id)
        .order('installment_number');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ['loan-payments', loan.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('loan_account_id', loan.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const repaymentProgress = ((Number(loan.amount_repaid) / Number(loan.total_payable)) * 100);
  const nextPayment = schedules?.find(s => s.status === 'pending');

  if (showRepaymentForm) {
    return (
      <LoanRepaymentForm 
        loan={loan} 
        onBack={() => setShowRepaymentForm(false)} 
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{loan.loan_products?.product_name}</CardTitle>
            <CardDescription>Account #{loan.loan_account_number}</CardDescription>
          </div>
          <Badge variant={loan.status === 'active' ? 'default' : 'secondary'}>
            {loan.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Loan Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Principal</p>
            <p className="text-lg font-bold">{Number(loan.principal_amount).toLocaleString()} XAF</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Payable</p>
            <p className="text-lg font-bold">{Number(loan.total_payable).toLocaleString()} XAF</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Amount Paid</p>
            <p className="text-lg font-bold text-green-600">
              {Number(loan.amount_repaid).toLocaleString()} XAF
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-lg font-bold text-orange-600">
              {Number(loan.outstanding_balance).toLocaleString()} XAF
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Repayment Progress</span>
            <span className="font-medium">{repaymentProgress.toFixed(1)}%</span>
          </div>
          <Progress value={repaymentProgress} className="h-2" />
        </div>

        {/* Next Payment */}
        {nextPayment && (
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next Payment</span>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold">
                  {Number(nextPayment.total_due).toLocaleString()} XAF
                </p>
                <p className="text-sm text-muted-foreground">
                  Due: {new Date(nextPayment.due_date).toLocaleDateString()}
                </p>
              </div>
              <Button onClick={() => setShowRepaymentForm(true)}>
                Make Payment
              </Button>
            </div>
          </div>
        )}

        {/* Tabs for Schedule and History */}
        <Tabs defaultValue="schedule" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">Repayment Schedule</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <RepaymentSchedule schedules={schedules || []} />
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-2">
              {payments && payments.length > 0 ? (
                payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{Number(payment.amount).toLocaleString()} XAF</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString()} • {payment.payment_method}
                      </p>
                    </div>
                    <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                      {payment.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">No payment history yet</p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Loan Details */}
        <div className="grid gap-2 text-sm border-t pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Interest Rate</span>
            <span className="font-medium">{loan.interest_rate}% p.a.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tenure</span>
            <span className="font-medium">{loan.tenure_months} months</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Repayment Frequency</span>
            <span className="font-medium capitalize">{loan.repayment_frequency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Disbursed On</span>
            <span className="font-medium">
              {loan.disbursed_at ? new Date(loan.disbursed_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
