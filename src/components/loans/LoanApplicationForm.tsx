import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Calculator } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
  requested_amount: z.string().min(1, "Amount is required"),
  tenure_months: z.string().min(1, "Tenure is required"),
  purpose: z.string().min(10, "Purpose must be at least 10 characters"),
  repayment_frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly"]),
  employment_status: z.string().min(1, "Employment status is required"),
  employer_name: z.string().optional(),
  monthly_income: z.string().optional(),
  guarantor_name: z.string().optional(),
  guarantor_phone: z.string().optional(),
});

interface LoanApplicationFormProps {
  product: any;
  onBack: () => void;
}

export default function LoanApplicationForm({ product, onBack }: LoanApplicationFormProps) {
  const [loanCalculation, setLoanCalculation] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requested_amount: "",
      tenure_months: "",
      purpose: "",
      repayment_frequency: "monthly",
      employment_status: "",
      employer_name: "",
      monthly_income: "",
      guarantor_name: "",
      guarantor_phone: "",
    },
  });

  const calculateLoan = async () => {
    const amount = form.getValues("requested_amount");
    const tenure = form.getValues("tenure_months");
    const frequency = form.getValues("repayment_frequency");

    if (!amount || !tenure) {
      toast.error("Please enter amount and tenure");
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('loan-calculate', {
        body: {
          principal: parseFloat(amount),
          interest_rate: product.interest_rate,
          tenure_months: parseInt(tenure),
          repayment_frequency: frequency,
        },
      });

      if (error) throw error;
      setLoanCalculation(data);
      toast.success("Loan terms calculated");
    } catch (error: any) {
      toast.error("Failed to calculate loan terms");
      console.error(error);
    } finally {
      setIsCalculating(false);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { data, error } = await supabase.functions.invoke('loan-ops', {
        body: {
          loan_product_id: product.id,
          requested_amount: parseFloat(values.requested_amount),
          tenure_months: parseInt(values.tenure_months),
          purpose: values.purpose,
          repayment_frequency: values.repayment_frequency,
          employment_details: {
            status: values.employment_status,
            employer_name: values.employer_name,
            monthly_income: values.monthly_income ? parseFloat(values.monthly_income) : null,
          },
          guarantors: values.guarantor_name ? [{
            name: values.guarantor_name,
            phone: values.guarantor_phone,
          }] : [],
          submit: true,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      return data;
    },
    onSuccess: () => {
      toast.success("Loan application submitted successfully");
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] });
      onBack();
    },
    onError: (error: any) => {
      console.error('Loan application error:', error);
      
      let errorMessage = "Failed to submit application";
      
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
    if (!loanCalculation) {
      toast.error("Please calculate loan terms first");
      return;
    }
    applyMutation.mutate(values);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Products
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Apply for {product.product_name}</CardTitle>
          <CardDescription>{product.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="requested_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Amount (XAF)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={`${product.min_amount} - ${product.max_amount}`}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Min: {Number(product.min_amount).toLocaleString()} | 
                        Max: {Number(product.max_amount).toLocaleString()}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tenure_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenure (Months)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder={`${product.min_tenure_months} - ${product.max_tenure_months}`}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Min: {product.min_tenure_months} | Max: {product.max_tenure_months}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="repayment_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repayment Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="outline"
                onClick={calculateLoan}
                disabled={isCalculating}
                className="w-full"
              >
                <Calculator className="mr-2 h-4 w-4" />
                {isCalculating ? "Calculating..." : "Calculate Loan Terms"}
              </Button>

              {loanCalculation && (
                <Alert>
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>EMI/Installment:</span>
                        <span className="font-bold">{loanCalculation.emi.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing Fee:</span>
                        <span>{loanCalculation.processing_fee.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Interest:</span>
                        <span>{loanCalculation.total_interest.toLocaleString()} XAF</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Total Payable:</span>
                        <span className="font-bold">{loanCalculation.total_payable.toLocaleString()} XAF</span>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purpose of Loan</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe why you need this loan..."
                        className="min-h-20"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Employment Details</h3>
                
                <FormField
                  control={form.control}
                  name="employment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="employed">Employed</SelectItem>
                          <SelectItem value="self_employed">Self Employed</SelectItem>
                          <SelectItem value="business_owner">Business Owner</SelectItem>
                          <SelectItem value="unemployed">Unemployed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="employer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employer/Business Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Company name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="monthly_income"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Income (XAF)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Your monthly income" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {product.requires_guarantor && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold">Guarantor Details</h3>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="guarantor_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="guarantor_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guarantor Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+237 6XX XXX XXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={applyMutation.isPending || !loanCalculation}
                >
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
