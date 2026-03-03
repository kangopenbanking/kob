import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Shield, Zap, BarChart3, CheckCircle2, CreditCard, Smartphone, PiggyBank, Home, MapPin, Users, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import crediqCard from "@/assets/crediq-card.jpg";
import crediqPhone from "@/assets/crediq-phone.webp";
import crediqPerson from "@/assets/crediq-person.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function CreditScoring() {
  const navigate = useNavigate();

  const creditFactors = [
    {
      icon: CreditCard,
      title: "Payment History",
      weight: "35%",
      description: "On-time bill payments, loan repayments, and mobile money consistency directly impact your score.",
      impact: "highest",
    },
    {
      icon: BarChart3,
      title: "Credit Utilization",
      weight: "30%",
      description: "How much of your available credit you use. Keeping usage below 30% signals responsible borrowing.",
      impact: "high",
    },
    {
      icon: TrendingUp,
      title: "Account Age & History",
      weight: "15%",
      description: "The longer your credit accounts have been open, the more data lenders have to evaluate risk.",
      impact: "medium",
    },
    {
      icon: Users,
      title: "Credit Mix",
      weight: "10%",
      description: "A healthy mix of credit types—savings, loans, njangi contributions—shows financial maturity.",
      impact: "medium",
    },
    {
      icon: Zap,
      title: "New Credit Inquiries",
      weight: "10%",
      description: "Frequent applications for new credit can temporarily lower your score. Space out applications.",
      impact: "low",
    },
  ];

  const ecosystemFeatures = [
    {
      icon: PiggyBank,
      title: "Personal Savings",
      points: "+15–30 pts",
      description: "Consistent savings deposits demonstrate financial discipline and boost your score.",
      color: "hsl(var(--primary))",
    },
    {
      icon: Users,
      title: "Njangi Contributions",
      points: "+10–25 pts",
      description: "Active participation in group savings circles shows community trust and reliability.",
      color: "hsl(var(--accent))",
    },
    {
      icon: Home,
      title: "Rent Reporting",
      points: "+20–50 pts",
      description: "Report on-time rent payments to build credit from your largest monthly expense.",
      color: "hsl(var(--primary))",
    },
    {
      icon: MapPin,
      title: "PostiQ Address Verification",
      points: "+10–20 pts",
      description: "Verified residential address through PostiQ adds a trust signal to your credit profile.",
      color: "hsl(var(--accent))",
    },
    {
      icon: Smartphone,
      title: "Mobile Money Activity",
      points: "+5–15 pts",
      description: "Regular mobile money usage patterns demonstrate financial engagement and stability.",
      color: "hsl(var(--primary))",
    },
    {
      icon: Shield,
      title: "KYC Verification",
      points: "+10–15 pts",
      description: "Completing identity verification establishes the foundation for a trusted credit profile.",
      color: "hsl(var(--accent))",
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: "Instant Decisions",
      description: "Get credit scores in under 2 seconds via API integration",
    },
    {
      icon: Shield,
      title: "COBAC Compliant",
      description: "Fully compliant with Central African banking regulations",
    },
    {
      icon: BarChart3,
      title: "Explainable AI",
      description: "Transparent factor analysis behind every score",
    },
    {
      icon: TrendingUp,
      title: "Predictive Analytics",
      description: "30-day default probability predictions for lenders",
    },
  ];

  return (
    <>
      <SEO
        title="Credit Scoring API for Cameroon | Alternative Credit Data"
        description="Real-time credit scoring API using banking data, mobile money, and alternative data. COBAC compliant credit assessment for Cameroon lenders."
        keywords="credit scoring API Cameroon, alternative credit data, COBAC compliant scoring, lending API, credit risk assessment, fintech credit scoring"
        canonical="https://kangopenbanking.com/solutions/credit-scoring"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Solutions", url: "/solutions" },
          { name: "Credit Scoring", url: "/solutions/credit-scoring" },
        ]}
      />

      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={crediqPerson} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/60" />
          </div>
          <div className="container mx-auto max-w-6xl px-4 py-24 md:py-36 relative">
            <div className="max-w-2xl">
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
                <Badge className="mb-4 text-sm">CrediQ Credit Engine</Badge>
              </motion.div>
              <motion.h1
                className="text-4xl md:text-6xl font-bold mb-6 leading-tight"
                initial="hidden" animate="visible" variants={fadeUp} custom={1}
              >
                Know Your Credit.{" "}
                <span className="text-primary">Own Your Future.</span>
              </motion.h1>
              <motion.p
                className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed"
                initial="hidden" animate="visible" variants={fadeUp} custom={2}
              >
                AI-powered credit scoring using banking data, mobile money transactions, savings behavior, 
                and alternative data sources — built for Cameroon and Central Africa.
              </motion.p>
              <motion.div className="flex gap-4 flex-wrap" initial="hidden" animate="visible" variants={fadeUp} custom={3}>
                <Button size="lg" onClick={() => navigate("/crediq")}>
                  Check Your Score
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/developer/api-explorer")}>
                  API Documentation
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Score Range Visual */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3">Credit Score Ranges</h2>
              <p className="text-muted-foreground">Understand where you stand on the 300–850 scale</p>
            </div>
            <div className="relative">
              <div className="h-4 rounded-full overflow-hidden flex">
                <div className="flex-1 bg-destructive/80" />
                <div className="flex-1 bg-yellow-500/80" />
                <div className="flex-1 bg-blue-500/80" />
                <div className="flex-1 bg-green-500/80" />
                <div className="flex-1 bg-primary/80" />
              </div>
              <div className="flex justify-between mt-3 text-sm">
                <div className="text-center">
                  <div className="font-bold text-destructive">300–579</div>
                  <div className="text-muted-foreground text-xs">Poor</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-yellow-500">580–669</div>
                  <div className="text-muted-foreground text-xs">Fair</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-500">670–739</div>
                  <div className="text-muted-foreground text-xs">Good</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-500">740–799</div>
                  <div className="text-muted-foreground text-xs">Very Good</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-primary">800–850</div>
                  <div className="text-muted-foreground text-xs">Excellent</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* What Impacts Your Score */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <div>
                <Badge variant="outline" className="mb-4">Score Factors</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  What Impacts Your Credit Score?
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Your CrediQ score is calculated from five major categories, each weighted 
                  differently. Understanding these factors helps you take control of your 
                  financial health.
                </p>
              </div>
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <img src={crediqCard} alt="Credit card for financial health" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Star className="h-4 w-4 text-primary fill-primary" />
                    <span>Build credit with every financial action</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {creditFactors.map((factor, i) => (
                <motion.div
                  key={factor.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-5">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <factor.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h3 className="text-lg font-semibold">{factor.title}</h3>
                            <Badge variant={factor.impact === "highest" ? "default" : factor.impact === "high" ? "secondary" : "outline"}>
                              {factor.weight} weight
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{factor.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Ecosystem Features That Build Credit */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
              <div className="relative rounded-2xl overflow-hidden aspect-[3/4] max-h-[480px]">
                <img src={crediqPhone} alt="Person checking credit score on phone" className="w-full h-full object-cover" />
              </div>
              <div>
                <Badge variant="outline" className="mb-4">Credit Building</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Every Action Builds Your Score
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-6">
                  The KOB ecosystem rewards responsible financial behavior. From savings deposits 
                  to rent reporting, each activity contributes points to your CrediQ credit score.
                </p>
                <Button onClick={() => navigate("/crediq")} size="lg">
                  Start Building Credit
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ecosystemFeatures.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                          <feature.icon className="h-5 w-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="font-bold">{feature.points}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* For Lenders - API Benefits */}
        <section className="py-20 px-4 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <Badge variant="outline" className="mb-4">For Lenders & Fintechs</Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Integrate Credit Scoring in Minutes</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                A single API call returns a comprehensive credit assessment with explainable factors
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {benefits.map((benefit, i) => (
                <motion.div
                  key={benefit.title}
                  initial="hidden" whileInView="visible" viewport={{ once: true }}
                  variants={fadeUp} custom={i}
                >
                  <Card className="h-full text-center p-6">
                    <benefit.icon className="h-10 w-10 text-primary mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card className="p-6 bg-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-destructive" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm text-muted-foreground ml-2 font-mono">credit-score.js</span>
              </div>
              <pre className="text-sm overflow-x-auto font-mono">
                <code>{`// Get credit score with user consent
const score = await kob.creditScore.calculate({
  userId: 'user-123',
  consentId: 'consent-abc',
  includeFactors: true
});

console.log(score.value);             // 742
console.log(score.category);          // 'very_good'
console.log(score.defaultProbability); // 0.03 (3%)
console.log(score.factors);           // Array of contributing factors`}</code>
              </pre>
            </Card>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Who Uses the Credit Scoring API</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Building2, label: "Digital Lenders", desc: "Automate loan approval with AI-powered risk assessment and real-time decisioning" },
                { icon: Users, label: "Microfinance Institutions", desc: "Reach unbanked customers with alternative credit data from mobile money and savings" },
                { icon: CreditCard, label: "BNPL Platforms", desc: "Offer buy-now-pay-later with instant credit checks and 30-day default predictions" },
              ].map((uc, i) => {
                const Icon = uc.icon;
                return (
                  <motion.div key={uc.label} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
                    <Card className="p-6 text-center h-full">
                      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{uc.label}</h3>
                      <p className="text-sm text-muted-foreground">{uc.desc}</p>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 bg-primary/5">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-6">Start Scoring Credit Today</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Get API access and start making better lending decisions
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button size="lg" onClick={() => navigate("/contact")}>
                Request Demo
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/crediq")}>
                Try CrediQ Free
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const Building2 = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
  </svg>
);
