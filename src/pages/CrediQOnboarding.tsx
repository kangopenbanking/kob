import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Info,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Shield,
  Briefcase,
  Wallet,
  Landmark,
  Smartphone,
  PiggyBank,
  Receipt,
  History,
  Target,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  required: boolean;
  icon: React.ElementType;
  infoTitle: string;
  infoDescription: string;
}

const questions: Question[] = [
  {
    id: "employment_status",
    text: "What is your current employment status?",
    required: true,
    icon: Briefcase,
    infoTitle: "Why we ask about employment",
    infoDescription:
      "Your employment status helps us understand your income stability and financial capacity. Lenders consider this a key factor in creditworthiness. This information is kept private and only used to calculate your CrediQ score.",
    options: [
      { value: "employed", label: "Employed (Full-time/Part-time)" },
      { value: "self_employed", label: "Self-Employed" },
      { value: "student", label: "Student" },
      { value: "retired", label: "Retired" },
      { value: "unemployed", label: "Unemployed" },
    ],
  },
  {
    id: "monthly_income_range",
    text: "What is your approximate monthly income?",
    required: true,
    icon: Wallet,
    infoTitle: "Why we ask about income",
    infoDescription:
      "Income level is a primary factor in determining your ability to repay loans. We use ranges to protect your privacy while still generating an accurate score. Higher income relative to expenses generally indicates stronger creditworthiness.",
    options: [
      { value: "<100k", label: "Less than 100,000 XAF" },
      { value: "100k-250k", label: "100,000 - 250,000 XAF" },
      { value: "250k-500k", label: "250,000 - 500,000 XAF" },
      { value: "500k-1M", label: "500,000 XAF - 1M XAF" },
      { value: ">1M", label: "More than 1M XAF" },
    ],
  },
  {
    id: "has_existing_loans",
    text: "Do you currently have any loans?",
    required: true,
    icon: Receipt,
    infoTitle: "Why we ask about existing loans",
    infoDescription:
      "Knowing about your current debt helps us calculate your debt-to-income ratio, a critical metric in credit scoring worldwide. Having loans isn't necessarily negative — managing them well can actually boost your score.",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "has_dependents",
    text: "Do you financially support any dependents (family members)?",
    required: true,
    icon: Target,
    infoTitle: "Why we ask about dependents",
    infoDescription:
      "Financial dependents affect your disposable income and capacity to take on new financial obligations. This helps us build a more accurate picture of your financial situation and responsibilities.",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "has_bank_account",
    text: "Do you have a bank account?",
    required: true,
    icon: Landmark,
    infoTitle: "Why we ask about bank accounts",
    infoDescription:
      "Having a formal bank account demonstrates financial inclusion and is a positive signal for creditworthiness. It shows you have access to formal financial services and a track record with financial institutions.",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "uses_mobile_money",
    text: "Do you use mobile money services (MTN MoMo, Orange Money)?",
    required: true,
    icon: Smartphone,
    infoTitle: "Why we ask about mobile money",
    infoDescription:
      "Mobile money usage is a strong indicator of financial activity in Cameroon. Regular mobile money transactions demonstrate consistent financial behavior and can significantly enhance your alternative credit score.",
    options: [
      { value: "true", label: "Yes, regularly" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "average_monthly_savings_range",
    text: "How much do you save on average each month?",
    required: true,
    icon: PiggyBank,
    infoTitle: "Why we ask about savings",
    infoDescription:
      "Regular savings demonstrate financial discipline and the ability to manage money responsibly. Even small, consistent savings can positively impact your credit score by showing financial planning ability.",
    options: [
      { value: "none", label: "I don't save regularly" },
      { value: "<10k", label: "Less than 10,000 XAF" },
      { value: "10k-50k", label: "10,000 - 50,000 XAF" },
      { value: "50k-100k", label: "50,000 - 100,000 XAF" },
      { value: ">100k", label: "More than 100,000 XAF" },
    ],
  },
  {
    id: "has_previous_loans",
    text: "Have you ever taken a loan before?",
    required: true,
    icon: History,
    infoTitle: "Why we ask about loan history",
    infoDescription:
      "Previous borrowing experience, even informal loans, shows you understand financial obligations. Having loan history isn't required, but successful past borrowing can strengthen your credit profile.",
    options: [
      { value: "true", label: "Yes" },
      { value: "false", label: "No" },
    ],
  },
  {
    id: "loan_payment_history",
    text: "How would you describe your loan repayment history?",
    required: false,
    icon: History,
    infoTitle: "Why we ask about repayment history",
    infoDescription:
      "Payment history is the single most important factor in credit scoring globally. Consistent on-time payments are the strongest positive signal, while missed payments can indicate higher risk. This question is optional.",
    options: [
      { value: "always_on_time", label: "Always paid on time" },
      { value: "mostly_on_time", label: "Mostly on time, few delays" },
      { value: "sometimes_late", label: "Sometimes late" },
      { value: "often_late", label: "Often late or missed payments" },
      { value: "no_history", label: "No loan history" },
    ],
  },
  {
    id: "primary_financial_goal",
    text: "What is your primary financial goal?",
    required: true,
    icon: Target,
    infoTitle: "Why we ask about financial goals",
    infoDescription:
      "Understanding your financial goals helps us personalize your CrediQ experience and provide tailored recommendations to improve your score. Goal-oriented financial behavior is also a positive creditworthiness signal.",
    options: [
      { value: "save_emergency", label: "Build emergency savings" },
      { value: "buy_property", label: "Buy property or land" },
      { value: "education", label: "Education (self or family)" },
      { value: "business", label: "Start or grow a business" },
      { value: "debt_payoff", label: "Pay off existing debts" },
      { value: "improve_credit", label: "Improve my credit score" },
    ],
  },
];

export default function CrediQOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [direction, setDirection] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;
  const Icon = currentQuestion.icon;

  const handleNext = () => {
    if (currentQuestion.required && !answers[currentQuestion.id]) {
      toast({
        title: "Answer required",
        description: "Please select an answer to continue",
        variant: "destructive",
      });
      return;
    }

    if (currentStep < questions.length - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to continue",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      const profile = {
        user_id: user.id,
        employment_status: answers.employment_status,
        monthly_income_range: answers.monthly_income_range,
        has_existing_loans: answers.has_existing_loans === "true",
        has_dependents: answers.has_dependents === "true",
        has_bank_account: answers.has_bank_account === "true",
        uses_mobile_money: answers.uses_mobile_money === "true",
        average_monthly_savings_range: answers.average_monthly_savings_range,
        has_previous_loans: answers.has_previous_loans === "true",
        loan_payment_history: answers.loan_payment_history || "no_history",
        primary_financial_goal: answers.primary_financial_goal,
        has_defaulted_loans: false,
        has_smartphone: true,
        uses_digital_payments: answers.uses_mobile_money === "true",
      };

      const { error: profileError } = await supabase
        .from("crediq_user_profiles")
        .upsert(profile, { onConflict: "user_id" });

      if (profileError) throw profileError;

      await supabase
        .from("crediq_questionnaire_responses")
        .delete()
        .eq("user_id", user.id);

      const responses = Object.entries(answers).map(
        ([questionId, answerValue], index) => {
          const question = questions.find((q) => q.id === questionId);
          const option = question?.options.find(
            (o) => o.value === answerValue
          );

          return {
            user_id: user.id,
            question_id: questionId,
            question_text: question?.text || "",
            answer_value: answerValue,
            answer_label: option?.label || answerValue,
            question_step: index + 1,
          };
        }
      );

      const { error: responsesError } = await supabase
        .from("crediq_questionnaire_responses")
        .insert(responses);

      if (responsesError) throw responsesError;

      const { error: scoreError } = await supabase.functions.invoke(
        "crediq-generate-baseline-score",
        { body: { user_id: user.id } }
      );

      if (scoreError) throw scoreError;

      toast({
        title: "Success!",
        description: "Your CrediQ score has been generated",
      });

      navigate("/crediq/dashboard");
    } catch (error: any) {
      console.error("Error submitting questionnaire:", error);

      let errorMessage = "Failed to generate score. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        errorMessage = error.error;
      }

      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 md:py-16">
        <div className="container max-w-xl mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              CrediQ Score Builder
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
              Build Your Credit Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              {questions.length} quick questions · 2 min · 100% private
            </p>
          </motion.div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {currentStep + 1}
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  of {questions.length}
                </span>
              </div>
              <span className="text-xs font-semibold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            {/* Step dots */}
            <div className="flex justify-between mt-2 px-0.5">
              {questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 w-1 rounded-full transition-colors",
                    i <= currentStep ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Question Card */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
              >
                <div className="rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
                  {/* Question header */}
                  <div className="flex items-start gap-3 mb-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg font-semibold leading-snug">
                          {currentQuestion.text}
                        </h2>
                        <button
                          onClick={() => setShowInfo(true)}
                          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-muted hover:bg-muted-foreground/10 transition-colors"
                          aria-label="Why we ask this"
                        >
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      {!currentQuestion.required && (
                        <span className="text-[11px] text-muted-foreground font-medium mt-1 inline-block">
                          Optional
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Options */}
                  <RadioGroup
                    value={answers[currentQuestion.id] || ""}
                    onValueChange={(value) =>
                      setAnswers({ ...answers, [currentQuestion.id]: value })
                    }
                    className="space-y-2"
                  >
                    {currentQuestion.options.map((option, idx) => {
                      const isSelected =
                        answers[currentQuestion.id] === option.value;
                      return (
                        <motion.div
                          key={option.value}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                        >
                          <label
                            htmlFor={`${currentQuestion.id}-${option.value}`}
                            className={cn(
                              "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                                : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                            )}
                          >
                            <RadioGroupItem
                              value={option.value}
                              id={`${currentQuestion.id}-${option.value}`}
                              className="shrink-0"
                            />
                            <Label
                              htmlFor={`${currentQuestion.id}-${option.value}`}
                              className="cursor-pointer flex-1 text-sm font-medium"
                            >
                              {option.label}
                            </Label>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="h-2 w-2 rounded-full bg-primary shrink-0"
                              />
                            )}
                          </label>
                        </motion.div>
                      );
                    })}
                  </RadioGroup>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-8 pt-6 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBack}
                      disabled={currentStep === 0 || isSubmitting}
                      className="gap-1.5 text-muted-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>

                    <Button
                      onClick={handleNext}
                      disabled={isSubmitting}
                      size="sm"
                      className="gap-1.5 min-w-[140px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating…
                        </>
                      ) : currentStep === questions.length - 1 ? (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate My Score
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Security footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Encrypted & private. We never share your data.</span>
          </motion.div>
        </div>
      </div>

      {/* Info Popup Overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowInfo(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl bg-card border shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-semibold text-base">
                    {currentQuestion.infoTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setShowInfo(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {currentQuestion.infoDescription}
              </p>

              <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  Your data is protected with bank-grade encryption and is never
                  sold to third parties.
                </span>
              </div>

              <Button
                onClick={() => setShowInfo(false)}
                className="w-full mt-4"
                size="sm"
              >
                Got it
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
