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
  Lock,
  ArrowRight,
  PieChart,
  CreditCard,
  FileText,
  Activity,
  MapPin,
  X,
  Zap,
  Clock,
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
              Advanced 300-850 credit scoring powered by internal transactions, savings behavior, and Njangi group participation — 
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
              Multi-factor scoring combining transaction history, savings, and Njangi participation
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
                    <Badge variant="outline">Core Factors</Badge>
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

            <Card className="border-accent/30">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <Badge variant="outline">Score Booster</Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">Njangi Group Participation</CardTitle>
                <CardDescription>Your community savings activity strengthens your credit profile</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Njangi is a traditional Cameroonian rotating savings group. Active participation in Njangi groups on KOB 
                  directly impacts your credit score — on-time contributions boost it, while missed contributions lower it.
                </p>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>On-Time Contributions:</strong> Each timely Njangi contribution is logged as a positive credit event
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Payout History:</strong> Successfully received payouts show healthy group participation
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Missed Contributions:</strong> Overdue payments are automatically flagged and reduce your score
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Group Membership:</strong> Active membership in multiple groups signals financial reliability
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Transparent Tracking:</strong> All contributions and payouts are immutably recorded on the platform
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
                Score Refresh & Recalculation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Credit scores are calculated on-demand and cached for performance. 
                Scores are automatically recalculated when:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                  <span>A loan application is submitted</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-accent mt-0.5" />
                  <span>A Njangi contribution is made or missed</span>
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

      {/* PostiQ Code Section */}
      <section className="py-20 bg-gradient-to-br from-postiq-red-light/30 via-background to-postiq-blue-light/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-postiq-blue">
              <MapPin className="h-4 w-4 inline mr-2 text-postiq-blue" />
              Location-Based Credit Boost
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              PostiQ Code: Your Address = Higher Credit Score
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              UK-style hierarchical locations (AA## ###) for Cameroon. 
              Verify your address, boost your credit by +50 points instantly.
            </p>
          </div>

          {/* Comparison Cards: what3words vs PostiQ */}
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
            {/* what3words Card (Red theme) */}
            <Card className="border-postiq-red/30 bg-gradient-to-br from-postiq-red-light/20 to-background">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-postiq-red">what3words</h3>
                  <div className="text-3xl text-postiq-red">///</div>
                </div>
                <div className="font-mono text-sm bg-postiq-red-light px-3 py-2 rounded text-postiq-red-dark">
                  ///filled.count.soap
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    Random word combinations
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    No hierarchical structure
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    <strong>No credit score benefit</strong>
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <X className="h-4 w-4 text-postiq-red mt-0.5 shrink-0" />
                    Complex to remember
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* PostiQ Code Card (Blue theme) */}
            <Card className="border-postiq-blue/50 bg-gradient-to-br from-postiq-blue-light/30 to-background shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-postiq-blue">PostiQ Code</h3>
                  <MapPin className="h-8 w-8 text-postiq-blue" />
                </div>
                <div className="font-mono text-sm bg-postiq-blue-light px-3 py-2 rounded text-postiq-blue-dark font-bold">
                  YA01 456
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-postiq-blue mt-0.5 shrink-0" />
                    UK-style hierarchical format
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-postiq-blue mt-0.5 shrink-0" />
                    Region-based (AA## ### format)
                  </li>
                  <li className="flex items-start gap-2 font-semibold text-postiq-blue">
                    <TrendingUp className="h-4 w-4 text-postiq-blue mt-0.5 shrink-0" />
                    <strong>+50 Credit Score Boost 🎉</strong>
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-postiq-blue mt-0.5 shrink-0" />
                    Simple, memorable codes
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Credit Score Impact Visualization */}
          <Card className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-postiq-blue-light/20 to-background border-postiq-blue/30">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-2">Instant Credit Score Impact</h3>
              <p className="text-muted-foreground">Verify your address once, boost your score permanently</p>
            </div>

            <div className="flex items-center justify-center gap-8 mb-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">Before Verification</div>
                <div className="text-5xl font-bold text-orange-500">650</div>
                <Badge variant="outline" className="mt-2">Fair</Badge>
              </div>

              <ArrowRight className="h-8 w-8 text-postiq-blue" />

              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-2">After Verification</div>
                <div className="text-5xl font-bold text-yellow-600">700</div>
                <Badge variant="outline" className="mt-2 bg-green-50 dark:bg-green-950">Good</Badge>
              </div>
            </div>

            <div className="text-center p-4 bg-gradient-to-r from-green-500/20 to-postiq-blue/20 rounded-lg border border-green-500/30">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="font-bold text-lg text-green-600">+50 Points Instantly</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                5 free verifications per day • GPS-based • Instant boost
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link to="/credit-score">
                <Button size="lg" className="bg-gradient-to-r from-postiq-blue to-primary hover:from-postiq-blue-dark hover:to-primary-dark">
                  <MapPin className="mr-2 h-4 w-4" />
                  Verify Your Address Now
                </Button>
              </Link>
            </div>
          </Card>

          {/* How PostiQ Works */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
            <Card className="text-center p-6 border-postiq-blue/30">
              <div className="h-12 w-12 bg-postiq-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-6 w-6 text-postiq-blue" />
              </div>
              <h4 className="font-semibold mb-2">1. Enable GPS</h4>
              <p className="text-sm text-muted-foreground">
                Share your location to get your unique PostiQ code
              </p>
            </Card>

            <Card className="text-center p-6 border-postiq-blue/30">
              <div className="h-12 w-12 bg-postiq-blue/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-6 w-6 text-postiq-blue" />
              </div>
              <h4 className="font-semibold mb-2">2. Get Your Code</h4>
              <p className="text-sm text-muted-foreground">
                Receive UK-style location code (YA01 456) covering ~500m radius
              </p>
            </Card>

            <Card className="text-center p-6 border-green-500/30">
              <div className="h-12 w-12 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="font-semibold mb-2">3. Score Boost</h4>
              <p className="text-sm text-muted-foreground">
                Your credit score increases by +50 points automatically
              </p>
            </Card>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-postiq-blue rounded-full" />
              <span>UK-Style Format</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Credit Score Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full" />
              <span>Cameroon Postal Integrated</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span>Secure & Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* Njangi & Credit Score Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How Njangi Groups Boost Your Credit</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your Njangi participation directly impacts your creditworthiness — every contribution counts
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <Card className="text-center p-6 hover:shadow-lg transition-all border-accent/30">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Community Trust</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Active Njangi membership demonstrates reliability to peers and lenders alike
              </p>
              <Badge variant="outline" className="text-xs">Social Credit</Badge>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-all border-accent/30">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Score Boost per Contribution</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Every on-time contribution is a positive credit event that lifts your score
              </p>
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20">+Points Each Cycle</Badge>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-all border-accent/30">
              <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Better Loan Terms</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Consistent Njangi history helps you qualify for lower rates and higher amounts
              </p>
              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20">Lower APR</Badge>
            </Card>

            <Card className="text-center p-6 hover:shadow-lg transition-all border-accent/30">
              <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Overdue Detection</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Missed contributions are automatically detected and reflected in your score
              </p>
              <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/20">Auto-Tracked</Badge>
            </Card>
          </div>

          <Card className="mt-12 max-w-3xl mx-auto p-6 bg-accent/5 border-accent/30">
            <h3 className="font-semibold text-xl mb-4 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-accent" />
              How Njangi Benefits Your Credit
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Scenario:</strong> You join a monthly Njangi group contributing 50,000 XAF per cycle. 
                After 6 months of on-time contributions, your credit score has received 6 positive credit events — 
                each one boosting your payment history and savings behavior factors.
              </p>
              <p>
                <strong>The Result:</strong> Your score climbs steadily, unlocking better loan terms. 
                Lenders see your consistent group savings as proof of financial discipline. 
                A missed contribution, however, is flagged as a negative event — so staying on track matters.
              </p>
            </div>
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

      {/* Real-World Impact */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Real-World Impact of Njangi Participation</h2>
            <p className="text-xl text-muted-foreground">
              See how consistent Njangi contributions transform credit access
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto">
            <Card className="p-8">
              <div className="mb-8">
                <Badge className="mb-3 bg-accent">Case Study</Badge>
                <h3 className="text-2xl font-semibold mb-2">Emmanuel's Credit Journey</h3>
                <p className="text-muted-foreground">
                  Emmanuel joined KOB 6 months ago and immediately started participating in two Njangi groups. 
                  Here's how consistent contributions transformed his credit profile.
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <Badge variant="outline" className="mb-4">Before Njangi</Badge>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Credit Score</p>
                      <p className="text-4xl font-bold mb-1">580</p>
                      <p className="text-xs text-muted-foreground">New user, minimal activity</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Score Classification</p>
                      <p className="text-xl font-semibold mb-1">Baseline</p>
                      <p className="text-xs text-muted-foreground">Limited data from questionnaire only</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Confidence Level</p>
                      <p className="text-xl font-semibold mb-1">35%</p>
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Low confidence - not enough data
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Loan Offer</p>
                      <p className="text-xl font-semibold mb-1">200,000 XAF</p>
                      <p className="text-xs text-muted-foreground">@ 20% APR over 1 year</p>
                    </div>
                  </div>
                </div>

                <div>
                  <Badge className="mb-4 bg-accent">After 6 Months of Njangi ✨</Badge>
                  <div className="space-y-4">
                    <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Credit Score</p>
                      <p className="text-4xl font-bold text-accent mb-1">710</p>
                      <p className="text-xs text-muted-foreground">12 on-time contributions across 2 groups</p>
                    </div>
                    <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Score Classification</p>
                      <p className="text-xl font-semibold text-accent mb-1">Internal</p>
                      <p className="text-xs text-muted-foreground">Rich transaction and savings data</p>
                    </div>
                    <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Confidence Level</p>
                      <p className="text-xl font-semibold text-accent mb-1">78%</p>
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Medium-high confidence - consistent data
                      </p>
                    </div>
                    <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Improved Loan Offer</p>
                      <p className="text-xl font-semibold text-accent mb-1">750,000 XAF</p>
                      <p className="text-xs text-muted-foreground">@ 12% APR over 3 years</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  The Transformation
                </h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">+130 Points</strong>
                      <p className="text-green-800 dark:text-green-200">From 12 on-time Njangi contributions and regular savings</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">+43% Confidence</strong>
                      <p className="text-green-800 dark:text-green-200">Consistent activity builds a reliable profile</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <DollarSign className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">+550,000 XAF</strong>
                      <p className="text-green-800 dark:text-green-200">Higher loan amount due to proven discipline</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="text-green-900 dark:text-green-100">8% Lower APR</strong>
                      <p className="text-green-800 dark:text-green-200">Saves over 200,000 XAF in interest over 3 years</p>
                    </div>
                  </div>
                </div>
              </div>
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
                <CardTitle className="text-lg">Join a Njangi Group</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Active Njangi participation builds credit through consistent contributions and community trust.
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
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-blue-600 hover:bg-primary-foreground hover:text-primary">
                Apply for a Loan
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
