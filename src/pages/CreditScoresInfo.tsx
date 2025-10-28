import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Wallet,
  Shield,
  Users,
  BarChart3,
  Globe,
  Lock,
  ArrowRight,
  PieChart,
  CreditCard,
  FileText,
  Activity,
} from "lucide-react";

export default function CreditScoresInfo() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6">
              Credit Scoring System
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Comprehensive Credit Scoring
              <span className="text-primary block">for Cameroon</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Advanced 300-850 credit scoring with hybrid data from internal transactions and NjangiBox credit bureau, 
              enabling smarter lending decisions and financial inclusion
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/credit-score">
                <Button size="lg" className="text-lg px-8">
                  Check Your Credit Score <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/documentation">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  API Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Score Ranges */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Credit Score Ranges</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Understand what your credit score means (300-850 scale)
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 max-w-5xl mx-auto">
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <div className="text-3xl font-bold mb-1">300-579</div>
                <CardTitle className="text-lg">Poor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Loan approvals unlikely. Focus on payment history.
                </p>
              </CardContent>
            </Card>

            <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
              <CardHeader>
                <div className="text-3xl font-bold mb-1">580-669</div>
                <CardTitle className="text-lg">Fair</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Limited loan options. Higher interest rates.
                </p>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader>
                <div className="text-3xl font-bold mb-1">670-739</div>
                <CardTitle className="text-lg">Good</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Favorable loan terms. Competitive rates.
                </p>
              </CardContent>
            </Card>

            <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <div className="text-3xl font-bold mb-1">740-799</div>
                <CardTitle className="text-lg">Very Good</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Excellent loan terms. Low interest rates.
                </p>
              </CardContent>
            </Card>

            <Card className="border-accent/50 bg-accent/10">
              <CardHeader>
                <div className="text-3xl font-bold mb-1">800-850</div>
                <CardTitle className="text-lg">Excellent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Best rates available. Premium benefits.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Credit Scoring Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Hybrid scoring combining multiple data sources for accurate assessment
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <Badge variant="outline">60% Weight</Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">Internal KOB Score</CardTitle>
                <CardDescription>Based on your activity within our platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Payment History (35%):</strong> On-time loan repayments and transaction patterns
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Amounts Owed (30%):</strong> Current loan balances and debt-to-income ratio
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Savings Behavior (15%):</strong> Savings account consistency and balance growth
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Credit History (15%):</strong> Length of account relationship and activity
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>KYC Verification (5%):</strong> Identity verification level and completeness
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Globe className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <Badge variant="outline">40% Weight</Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">NjangiBox Bureau Score</CardTitle>
                <CardDescription>Cross-institution credit history data</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Cross-Bank History:</strong> Loan and credit performance across all participating institutions
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Public Records:</strong> Court judgments, liens, and bankruptcies if any
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Credit Inquiries:</strong> Recent hard inquiries from other lenders
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Payment Patterns:</strong> Historical payment behavior across the financial system
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Fallback:</strong> 100% internal scoring if external data unavailable
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="max-w-3xl mx-auto bg-accent/10 border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-accent" />
                Score Refresh & Caching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Credit scores are calculated on-demand and cached for 30 days to balance accuracy with performance. 
                Scores are automatically recalculated when:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                  <span>A loan application is submitted</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                  <span>A user manually requests a refresh</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                  <span>30 days have passed since last calculation</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits for Users */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Benefits for Borrowers</h2>
            <p className="text-xl text-muted-foreground">
              How good credit helps you access better financial products
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card>
              <CardHeader>
                <DollarSign className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Better Loan Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Higher credit scores qualify you for lower interest rates, saving thousands in loan costs.
                </p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Score 750+:</span>
                    <strong className="text-primary">8-10% APR</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Score 650-749:</span>
                    <strong>12-15% APR</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Score &lt;650:</span>
                    <strong className="text-destructive">18-24% APR</strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Wallet className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Savings Bonuses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Earn interest rate bonuses on savings accounts based on your credit score.
                </p>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Score 750+:</span>
                    <strong className="text-accent">+0.5% bonus</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Score 700-749:</span>
                    <strong className="text-accent">+0.3% bonus</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Score 650-699:</span>
                    <strong className="text-accent">+0.1% bonus</strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CheckCircle className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Auto-Approval</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Excellent credit scores can lead to instant pre-approval for loans without manual review.
                </p>
                <ul className="text-sm space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                    <span>Score ≥700: Pre-approved instantly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                    <span>Higher loan amounts available</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                    <span>Faster disbursement times</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* B2B API Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4">For Financial Institutions</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Credit Scoring B2B APIs</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Access credit scores for your customers with consent-based queries
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-8">
            <Card className="border-primary/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl">Institution API Access</CardTitle>
                  <Badge>B2B Only</Badge>
                </div>
                <CardDescription>
                  Query customer credit scores with proper consent and transparent pricing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Consent-Based Queries
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    All credit score queries require explicit user consent. Unauthorized queries are rejected and logged for audit.
                  </p>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                      ⚠️ Compliance Requirement
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Users must grant explicit consent for their credit data to be queried. 
                      All queries are logged as hard inquiries and users are notified.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Transparent Pricing
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Standard</p>
                      <p className="text-2xl font-bold mb-1">50 XAF</p>
                      <p className="text-xs text-muted-foreground mb-2">per query</p>
                      <p className="text-xs">5,000 queries/day</p>
                    </div>
                    <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                      <p className="text-sm font-medium mb-1">Premium</p>
                      <p className="text-2xl font-bold mb-1">35 XAF</p>
                      <p className="text-xs text-muted-foreground mb-2">per query</p>
                      <p className="text-xs">50,000 queries/day</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm font-medium mb-1">Enterprise</p>
                      <p className="text-2xl font-bold mb-1">25 XAF</p>
                      <p className="text-xs text-muted-foreground mb-2">per query</p>
                      <p className="text-xs">Unlimited queries</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    API Features
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>Real-time credit score queries</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>Score factor breakdown</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>Risk category assessment</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>Comprehensive audit logs</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>Rate limiting protection</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5" />
                        <span>RESTful API with SDKs</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Link to="/documentation">
                    <Button className="w-full" size="lg">
                      View API Documentation <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Improving Your Score */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How to Improve Your Credit Score</h2>
            <p className="text-xl text-muted-foreground">
              Practical steps to build and maintain excellent credit
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <CardTitle className="text-lg">Pay On Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Payment history is 35% of your score. Set up auto-payments to never miss a due date.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <CardTitle className="text-lg">Keep Balances Low</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Maintain debt-to-income ratio below 40%. Lower utilization shows responsible credit management.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <CardTitle className="text-lg">Build Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Regular savings contributions demonstrate financial stability and boost your score by up to 15%.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl font-bold text-primary">4</span>
                </div>
                <CardTitle className="text-lg">Limit Inquiries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Too many credit inquiries can lower your score. Only apply for credit when necessary.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Check Your Credit Score?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Get your comprehensive credit score and detailed report in seconds
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/credit-score">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Check My Score Now
              </Button>
            </Link>
            <Link to="/loans">
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Apply for a Loan
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
