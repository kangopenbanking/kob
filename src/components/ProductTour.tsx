import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Database,
  Zap,
  Smartphone,
  CreditCard,
  Shield,
  Building2,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  {
    icon: Database,
    title: "Account Information (AISP)",
    description: "Aggregate balances and transactions from 25+ banks with a single API call.",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    link: "/guides/aisp",
  },
  {
    icon: Zap,
    title: "Payment Initiation (PISP)",
    description: "Trigger instant bank-to-bank and mobile money payments with SCA authentication.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    link: "/guides/pisp",
  },
  {
    icon: Smartphone,
    title: "Mobile Money",
    description: "Connect MTN MoMo and Orange Money for collections, disbursements, and wallet-to-bank.",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    link: "/developer/api/mobile-money",
  },
  {
    icon: CreditCard,
    title: "Virtual Cards",
    description: "Issue Visa/Mastercard virtual cards funded from local XAF accounts for global payments.",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    link: "/virtual-cards",
  },
  {
    icon: Shield,
    title: "CrediQ Credit Scoring",
    description: "AI-powered alternative credit scoring using transaction data and behavioral analytics.",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-900/20",
    link: "/crediq",
  },
  {
    icon: Building2,
    title: "Banking Operations",
    description: "Reconciliation, SWIFT messaging, ISO 20022, and regulatory compliance reporting.",
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-900/20",
    link: "/banking-ops",
  },
];

export const ProductTour = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  if (!isOpen) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5 }}
        className="fixed bottom-6 right-6 z-50 print:hidden"
      >
        <Button
          size="lg"
          onClick={() => setIsOpen(true)}
          className="rounded-full shadow-xl px-6 gap-2"
        >
          <Play className="h-4 w-4" /> Take a Tour
        </Button>
      </motion.div>
    );
  }

  const step = steps[current];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm print:hidden"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg mx-4"
        >
          <Card className="p-0 overflow-hidden shadow-2xl">
            {/* Progress */}
            <div className="flex gap-1 p-3 bg-muted/50">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= current ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <div className="p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={`inline-flex p-4 rounded-2xl ${step.bg} mb-6`}>
                    <step.icon className={`h-10 w-10 ${step.color}`} />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Step {current + 1} of {steps.length}
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  <Link to={step.link} className="inline-block mt-3 text-sm text-primary font-medium hover:underline">
                    Learn more →
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4 mr-1" /> Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrent((p) => Math.max(0, p - 1))}
                  disabled={current === 0}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {current < steps.length - 1 ? (
                  <Button size="sm" onClick={() => setCurrent((p) => p + 1)}>
                    Next <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setIsOpen(false)}>
                    Finish
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
