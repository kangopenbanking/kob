import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { 
  Shield, TrendingUp, Bell, Target, Award, Users, 
  CheckCircle, Zap, Lock, BarChart3, Smartphone, Mail, FileText
} from "lucide-react";

export default function CrediQInfo() {
  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center space-y-6 mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Cameroon Credit Standard (CCS)</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold">
                Everything You Need to Know About{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                  CrediQ
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground">
                Your financial identity in Cameroon. Free, secure, and always up-to-date.
              </p>
            </div>

            {/* What is CrediQ */}
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4">What is CrediQ?</h2>
              <p className="text-muted-foreground mb-4">
                CrediQ is Cameroon's first real-time credit scoring system built on Kang Open Banking infrastructure. 
                Unlike traditional credit bureaus that update quarterly, your CrediQ score updates automatically with 
                every financial activity—loan payments, savings deposits, mobile money transactions, and more.
              </p>
              <p className="text-muted-foreground">
                Your score ranges from <strong>300 (poor) to 850 (excellent)</strong> and directly impacts your ability 
                to access loans, get better interest rates, and unlock financial opportunities across Cameroon.
              </p>
            </Card>

            {/* How It Works */}
            <h2 className="text-3xl font-bold mb-8 text-center">How CrediQ Works</h2>
            
            <div className="space-y-6 mb-16">
              <div className="flex gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-xl mb-2">Answer 10 Simple Questions</h3>
                  <p className="text-muted-foreground">
                    Tell us about your employment, income, savings habits, and financial goals. 
                    This takes just 3-5 minutes and gives us your baseline financial profile.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-xl mb-2">Receive Your Baseline Score</h3>
                  <p className="text-muted-foreground">
                    Instantly get your CrediQ score (300-850 scale). If you're new to KOB, you'll receive a 
                    baseline score (capped at 650) that improves as you use our services.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-xl mb-2">Automatic Real-Time Updates</h3>
                  <p className="text-muted-foreground">
                    Your score updates automatically when you:
                  </p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>• Make loan payments (biggest impact)</li>
                    <li>• Deposit into savings accounts</li>
                    <li>• Complete KYC verification (+50 points)</li>
                    <li>• Use mobile money responsibly</li>
                    <li>• Pay bills on time</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-xl mb-2">Get Personalized Recommendations</h3>
                  <p className="text-muted-foreground">
                    Receive AI-powered tips via email and dashboard notifications. We'll tell you exactly 
                    what actions will improve your score the most.
                  </p>
                </div>
              </div>
            </div>

            {/* Score Factors */}
            <h2 className="text-3xl font-bold mb-8 text-center">What Affects Your Score?</h2>
            
            <div className="grid md:grid-cols-2 gap-6 mb-16">
              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-green-100">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Payment History (30%)</h3>
                    <p className="text-sm text-muted-foreground">
                      On-time loan payments are the #1 factor. Every payment made on schedule boosts your score.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-blue-100">
                    <BarChart3 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Debt Management (25%)</h3>
                    <p className="text-sm text-muted-foreground">
                      How much you owe compared to your savings and income. Lower debt = higher score.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-purple-100">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Credit History Length (12%)</h3>
                    <p className="text-sm text-muted-foreground">
                      Longer relationships with lenders show stability. Time builds trust.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-orange-100">
                    <Target className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Account Mix (8%)</h3>
                    <p className="text-sm text-muted-foreground">
                      Having both loans and savings accounts demonstrates financial responsibility.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-yellow-100">
                    <Zap className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Recent Activity (8%)</h3>
                    <p className="text-sm text-muted-foreground">
                      Too many new credit applications in a short time can lower your score.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-pink-100">
                    <CheckCircle className="h-6 w-6 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Other Factors (17%)</h3>
                    <p className="text-sm text-muted-foreground">
                      Savings behavior, mobile money usage, KYC completion, and transaction patterns.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Benefits */}
            <h2 className="text-3xl font-bold mb-8 text-center">Benefits of a Good Score</h2>
            
            <div className="grid md:grid-cols-3 gap-6 mb-16">
              <Card className="p-6 text-center hover:shadow-lg transition-all">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Lower Interest Rates</h3>
                <p className="text-sm text-muted-foreground">
                  Save thousands in interest with better loan terms
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-all">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Faster Approvals</h3>
                <p className="text-sm text-muted-foreground">
                  Get instant pre-approvals for loans and credit
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-all">
                <div className="h-16 w-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                  <Award className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Better Opportunities</h3>
                <p className="text-sm text-muted-foreground">
                  Access premium financial products reserved for good credit
                </p>
              </Card>
            </div>

            {/* Email Notifications */}
            <Card className="p-8 mb-16">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Stay Informed with Email Alerts</h2>
                  <p className="text-muted-foreground">
                    Never miss important credit updates with our automated notification system
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Bell className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Score Change Alerts</h4>
                    <p className="text-sm text-muted-foreground">
                      Get notified when your score changes by 10+ points
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Weekly Digest</h4>
                    <p className="text-sm text-muted-foreground">
                      Every Monday, receive a summary of your credit health
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Monthly Reports</h4>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive monthly analysis with 6-month trends
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                  <Award className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Goal Achievements</h4>
                    <p className="text-sm text-muted-foreground">
                      Celebrate milestones when you reach your targets
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* FAQ Section */}
            <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-4 mb-16">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Is CrediQ really free?</h3>
                <p className="text-muted-foreground">
                  Yes! CrediQ is 100% free forever. No hidden fees, no subscriptions, no credit card required. 
                  We believe everyone in Cameroon deserves access to their financial identity.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Does checking my score hurt my credit?</h3>
                <p className="text-muted-foreground">
                  No. Checking your own CrediQ score is a "soft inquiry" and has zero impact on your score. 
                  Only when lenders check your score (with your permission) does it count as a "hard inquiry."
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">How often does my score update?</h3>
                <p className="text-muted-foreground">
                  Your score updates automatically in real-time whenever you complete a financial activity on 
                  Kang Open Banking—loan payments, savings deposits, KYC verification, mobile money transactions, etc.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">What if I don't have any loans or accounts yet?</h3>
                <p className="text-muted-foreground">
                  Perfect! CrediQ is designed for everyone. Your baseline score is calculated from your 
                  questionnaire responses. As you start using KOB services (even just mobile money or savings), 
                  your score becomes more accurate and comprehensive.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">How is this different from traditional credit bureaus?</h3>
                <p className="text-muted-foreground">
                  Traditional bureaus update quarterly and charge fees. CrediQ updates in real-time, is completely 
                  free, and integrates all your KOB financial activities (banking, mobile money, loans, savings) 
                  into one comprehensive score.
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-2">Can I improve my score quickly?</h3>
                <p className="text-muted-foreground">
                  While building excellent credit takes time, you can see meaningful improvements quickly:
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>• Complete KYC verification: <strong>+50 points instantly</strong></li>
                  <li>• Make 3 on-time loan payments: <strong>+30-50 points</strong></li>
                  <li>• Open a savings account: <strong>+40 points</strong></li>
                </ul>
              </Card>
            </div>

            {/* Security */}
            <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-16">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-4">Your Data is Secure</h2>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Bank-grade TLS 1.3 encryption</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>AES-256 data encryption at rest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>COBAC & BEAC compliant</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>PCI-DSS Level 1 certified</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Never shared without your explicit permission</span>
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Card className="p-12 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Start Your Credit Journey?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of Cameroonians building their financial future with CrediQ. 
                Get your free score in just 3 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/crediq/onboarding">
                  <Button size="lg" className="text-lg px-8">
                    Get Your Free Score
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline">
                    Sign In
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </Layout>
  );
}
