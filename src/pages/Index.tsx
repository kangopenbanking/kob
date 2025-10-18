import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Shield, 
  Zap, 
  Globe, 
  Lock, 
  Code, 
  CheckCircle2, 
  ArrowRight,
  Users,
  TrendingUp
} from "lucide-react";
import heroImage from "@/assets/hero-banking.jpg";

const Index = () => {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.15
          }}
        />
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Secure • Compliant • XAF Native</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary-light to-accent bg-clip-text text-transparent">
              Unified Banking API for Cameroon
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Connect credit unions, banks, and fintech companies through a single, powerful Open Banking API. 
              Built for XAF, designed for growth.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Link to="/register">
                <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-primary-light hover:opacity-90 transition-opacity">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/documentation">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  View Documentation
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <span>PSD2 Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <span>99.9% Uptime SLA</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent" />
                <span>XAF Native</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Built for Financial Institutions</h2>
            <p className="text-xl text-muted-foreground">
              Everything you need to integrate banking services in Cameroon
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Multiple Institution Types</CardTitle>
                <CardDescription>
                  Support for banks, credit unions, and fintech companies with tailored features
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Instant Integration</CardTitle>
                <CardDescription>
                  Connect to Flutterwave, Stripe, PayPal, and Kang Payments with unified APIs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Bank-Grade Security</CardTitle>
                <CardDescription>
                  End-to-end encryption, PCI-DSS compliant, with real-time fraud detection
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Developer-Friendly</CardTitle>
                <CardDescription>
                  RESTful APIs, comprehensive documentation, SDKs, and sandbox environment
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>XAF Currency Native</CardTitle>
                <CardDescription>
                  Designed specifically for Cameroon's banking ecosystem and XAF transactions
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-accent" />
                </div>
                <CardTitle>Compliance Ready</CardTitle>
                <CardDescription>
                  Built following UK Open Banking standards adapted for Cameroon regulations
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary-dark text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="flex items-center justify-center mb-4">
                <Users className="h-12 w-12" />
              </div>
              <div className="text-5xl font-bold mb-2">50+</div>
              <div className="text-lg opacity-90">Financial Institutions Ready</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <TrendingUp className="h-12 w-12" />
              </div>
              <div className="text-5xl font-bold mb-2">99.9%</div>
              <div className="text-lg opacity-90">Uptime Guarantee</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <Shield className="h-12 w-12" />
              </div>
              <div className="text-5xl font-bold mb-2">100%</div>
              <div className="text-lg opacity-90">PCI-DSS Compliant</div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Partners */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Integrated Payment Partners</h2>
            <p className="text-xl text-muted-foreground">
              Seamlessly connect with leading payment providers
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            <div className="text-2xl font-bold">Flutterwave</div>
            <div className="text-2xl font-bold">Stripe</div>
            <div className="text-2xl font-bold">PayPal</div>
            <div className="text-2xl font-bold">Kang Payments</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto border-2 border-primary/20 bg-gradient-to-br from-card to-muted/50">
            <CardContent className="p-12 text-center space-y-6">
              <h2 className="text-4xl font-bold">Ready to Transform Banking in Cameroon?</h2>
              <p className="text-xl text-muted-foreground">
                Join financial institutions already using Kang Open Banking to streamline operations
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link to="/register">
                  <Button size="lg" className="text-lg px-8 bg-gradient-to-r from-primary to-primary-light">
                    Register Your Institution
                  </Button>
                </Link>
                <Link to="/documentation">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Explore API Docs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
};

export default Index;
