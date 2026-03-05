import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  required: boolean;
}

const questions: Question[] = [
  {
    id: "employment_status",
    text: "What is your current employment status?",
    required: true,
    options: [
      { value: "employed", label: "Employed (Full-time/Part-time)" },
      { value: "self_employed", label: "Self-Employed" },
      { value: "student", label: "Student" },
      { value: "retired", label: "Retired" },
      { value: "unemployed", label: "Unemployed" }
    ]
  },
  {
    id: "monthly_income_range",
    text: "What is your approximate monthly income?",
    required: true,
    options: [
      { value: "<100k", label: "Less than 100,000 XAF" },
      { value: "100k-250k", label: "100,000 - 250,000 XAF" },
      { value: "250k-500k", label: "250,000 - 500,000 XAF" },
      { value: "500k-1M", label: "500,000 XAF - 1M XAF" },
      { value: ">1M", label: "More than 1M XAF" }
    ]
  },
  {
    id: "has_existing_loans",
    text: "Do you currently have any loans?",
    required: true,
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" }
    ]
  },
  {
    id: "has_dependents",
    text: "Do you financially support any dependents (family members)?",
    required: true,
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" }
    ]
  },
  {
    id: "has_bank_account",
    text: "Do you have a bank account?",
    required: true,
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" }
    ]
  },
  {
    id: "uses_mobile_money",
    text: "Do you use mobile money services (MTN MoMo, Orange Money)?",
    required: true,
    options: [
      { value: "true", label: "Yes, regularly" },
      { value: "false", label: "No" }
    ]
  },
  {
    id: "average_monthly_savings_range",
    text: "How much do you save on average each month?",
    required: true,
    options: [
      { value: "none", label: "I don't save regularly" },
      { value: "<10k", label: "Less than 10,000 XAF" },
      { value: "10k-50k", label: "10,000 - 50,000 XAF" },
      { value: "50k-100k", label: "50,000 - 100,000 XAF" },
      { value: ">100k", label: "More than 100,000 XAF" }
    ]
  },
  {
    id: "has_previous_loans",
    text: "Have you ever taken a loan before?",
    required: true,
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" }
    ]
  },
  {
    id: "loan_payment_history",
    text: "How would you describe your loan repayment history?",
    required: false,
    options: [
      { value: "always_on_time", label: "Always paid on time" },
      { value: "mostly_on_time", label: "Mostly on time, few delays" },
      { value: "sometimes_late", label: "Sometimes late" },
      { value: "often_late", label: "Often late or missed payments" },
      { value: "no_history", label: "No loan history" }
    ]
  },
  {
    id: "primary_financial_goal",
    text: "What is your primary financial goal?",
    required: true,
    options: [
      { value: "save_emergency", label: "Build emergency savings" },
      { value: "buy_property", label: "Buy property or land" },
      { value: "education", label: "Education (self or family)" },
      { value: "business", label: "Start or grow a business" },
      { value: "debt_payoff", label: "Pay off existing debts" },
      { value: "improve_credit", label: "Improve my credit score" }
    ]
  }
];

export default function CrediQOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleNext = () => {
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      toast({
        title: "Answer required",
        description: "Please select an answer to continue",
        variant: "destructive"
      });
      return;
    }

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to continue",
          variant: "destructive"
        });
        navigate('/auth');
        return;
      }

      // Save profile
      const profile = {
        user_id: user.id,
        employment_status: answers.employment_status,
        monthly_income_range: answers.monthly_income_range,
        has_existing_loans: answers.has_existing_loans === 'true',
        has_dependents: answers.has_dependents === 'true',
        has_bank_account: answers.has_bank_account === 'true',
        uses_mobile_money: answers.uses_mobile_money === 'true',
        average_monthly_savings_range: answers.average_monthly_savings_range,
        has_previous_loans: answers.has_previous_loans === 'true',
        loan_payment_history: answers.loan_payment_history || 'no_history',
        primary_financial_goal: answers.primary_financial_goal,
        has_defaulted_loans: false,
        has_smartphone: true,
        uses_digital_payments: answers.uses_mobile_money === 'true'
      };

      const { error: profileError } = await supabase
        .from('crediq_user_profiles')
        .upsert(profile, { onConflict: 'user_id' });

      if (profileError) throw profileError;

      // Delete existing questionnaire responses before inserting new ones
      await supabase
        .from('crediq_questionnaire_responses')
        .delete()
        .eq('user_id', user.id);

      // Save questionnaire responses
      const responses = Object.entries(answers).map(([questionId, answerValue], index) => {
        const question = questions.find(q => q.id === questionId);
        const option = question?.options.find(o => o.value === answerValue);
        
        return {
          user_id: user.id,
          question_id: questionId,
          question_text: question?.text || '',
          answer_value: answerValue,
          answer_label: option?.label || answerValue,
          question_step: index + 1
        };
      });

      const { error: responsesError } = await supabase
        .from('crediq_questionnaire_responses')
        .insert(responses);

      if (responsesError) throw responsesError;

      // Generate baseline score
      const { data: scoreData, error: scoreError } = await supabase.functions.invoke(
        'crediq-generate-baseline-score',
        { body: { user_id: user.id } }
      );

      if (scoreError) throw scoreError;

      toast({
        title: "Success!",
        description: "Your CrediQ score has been generated"
      });

      navigate('/crediq/dashboard');
    } catch (error: any) {
      console.error('Error submitting questionnaire:', error);
      
      let errorMessage = "Failed to generate score. Please try again.";
      
      // Extract specific error messages
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 py-12">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Get Your CrediQ Score</h1>
            <p className="text-muted-foreground">
              Answer {questions.length} quick questions to receive your baseline credit score
            </p>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Question {currentStep + 1} of {questions.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <Card className="p-8">
            <h2 className="text-xl font-semibold mb-6">
              {currentQuestion.text}
            </h2>

            <RadioGroup
              value={answers[currentQuestion.id] || ""}
              onValueChange={(value) => 
                setAnswers({ ...answers, [currentQuestion.id]: value })
              }
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div key={option.value} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="cursor-pointer flex-1">
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0 || isSubmitting}
              >
                Back
              </Button>
              
              <Button
                onClick={handleNext}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Score...
                  </>
                ) : currentStep === questions.length - 1 ? (
                  'Generate My Score'
                ) : (
                  'Next'
                )}
              </Button>
            </div>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Your information is secure and encrypted. We never share your data without permission.
          </p>
        </div>
      </div>
    </>
  );
}
