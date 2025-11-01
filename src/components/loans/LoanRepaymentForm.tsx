import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  payment_method: z.string().min(1, "Payment method is required"),
  notes: z.string().optional(),
});

interface LoanRepaymentFormProps {
  loan: any;
  onBack: () => void;
}

export default function LoanRepaymentForm({ loan, onBack }: LoanRepaymentFormProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      payment_method: "",
      notes: "",
    },
  });

  const repayMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase.functions.invoke('loan-repay', {
        body: {
          loan_account_id: loan.id,
          amount: parseFloat(values.amount),
          payment_method: values.payment_method,
          notes: values.notes,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Payment processed successfully");
      queryClient.invalidateQueries({ queryKey: ['loan-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['loan-schedules', loan.id] });
      queryClient.invalidateQueries({ queryKey: ['loan-payments', loan.id] });
      onBack();
    },
    onError: (error: any) => {
      console.error('Loan repayment error:', error);
      
      let errorMessage = "Failed to process payment";
      
      // Extract specific error messages
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast.error(errorMessage);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const amount = parseFloat(values.amount);
    if (amount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (amount > Number(loan.outstanding_balance)) {
      toast.error("Amount cannot exceed outstanding balance");
      return;
    }
    repayMutation.mutate(values);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Loan
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Make Loan Payment</CardTitle>
          <CardDescription>
            Pay towards your {loan.loan_products?.product_name} loan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Loan Account</span>
              <span className="font-medium">{loan.loan_account_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className="font-bold text-lg">
                {Number(loan.outstanding_balance).toLocaleString()} XAF
              </span>
            </div>
            {loan.next_payment_amount && (
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Next Payment Due</span>
                <span className="font-medium">
                  {Number(loan.next_payment_amount).toLocaleString()} XAF
                </span>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount (XAF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        <SelectItem value="card">Card Payment</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="direct_debit">Direct Debit</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about this payment..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={repayMutation.isPending}
                >
                  {repayMutation.isPending ? "Processing..." : "Make Payment"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
