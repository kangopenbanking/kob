import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Shield,
  Zap,
  Globe,
  Lock,
  CheckCircle,
  ArrowRight,
  Code,
  Smartphone,
  Building2,
  Users,
  TrendingUp,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import heroImage from "@/assets/hero-banking.jpg";
import heroBanner from "@/assets/hero-cameroon-xaf.png";

const Index = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
          style={{ backgroundImage: `url(${heroBanner})` }}
        ></div>
        <div className="absolute inset-0 bg-background/80"></div>
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fade-in">
              <Badge variant="outline" className="w-fit">
                🇨🇲 Proudly Cameroon's #1 Open Banking Platform
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                Unified Banking API for{" "}
                <span className="text-primary">Cameroon</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Connect to banks, credit unions, and mobile money operators across Cameroon with a single, secure API. COBAC & BEAC compliant.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/register">
                  <Button size="lg" className="text-lg px-8">
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/documentation">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    View Documentation
                  </Button>
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">99.9% Uptime SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">COBAC Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">PCI-DSS Certified</span>
                </div>
              </div>
            </div>
            <div className="relative lg:block hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl blur-3xl"></div>
              <img
                src={heroImage}
                alt="Banking Platform"
                className="relative rounded-2xl shadow-2xl border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Portal Access Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three Portals, One Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Access the right tools for your role in the banking ecosystem
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1">
              <Code className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Developer Portal</h3>
              <p className="text-muted-foreground mb-6">
                Build and test integrations with our comprehensive API documentation, sandbox environment, and SDKs.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Interactive API documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Sandbox testing environment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Code examples & SDKs</span>
                </li>
              </ul>
              <Link to="/developer">
                <Button className="w-full">Access Developer Portal</Button>
              </Link>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1 border-primary">
              <Building2 className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Admin Portal</h3>
              <p className="text-muted-foreground mb-6">
                Manage your institution's integration, monitor compliance, and oversee operations.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Institution management</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Compliance reporting</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>User & role management</span>
                </li>
              </ul>
              <Link to="/admin">
                <Button className="w-full" variant="outline">Access Admin Portal</Button>
              </Link>
            </Card>

            <Card className="p-8 hover:shadow-lg transition-all hover:-translate-y-1">
              <BarChart3 className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-2xl font-bold mb-3">Banking Ops</h3>
              <p className="text-muted-foreground mb-6">
                Monitor transactions, perform reconciliations, and manage banking operations in real-time.
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Transaction monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Automated reconciliation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>Bulk operations</span>
                </li>
              </ul>
              <Link to="/banking-ops">
                <Button className="w-full">Access Banking Ops</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">25+</div>
              <div className="text-sm opacity-90">Financial Institutions</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">99.9%</div>
              <div className="text-sm opacity-90">Uptime Guarantee</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">&lt;200ms</div>
              <div className="text-sm opacity-90">Avg Response Time</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">1M+</div>
              <div className="text-sm opacity-90">API Calls Daily</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Build Financial Services
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive features for modern fintech applications
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6">
              <Shield className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Bank-Grade Security</h3>
              <p className="text-muted-foreground">
                TLS 1.3 encryption, AES-256 at rest, PCI-DSS Level 1 certified with 24/7 security monitoring.
              </p>
            </Card>

            <Card className="p-6">
              <Zap className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Instant Integration</h3>
              <p className="text-muted-foreground">
                Connect to multiple banks with one API. No individual bank integrations needed.
              </p>
            </Card>

            <Card className="p-6">
              <Globe className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">CEMAC Coverage</h3>
              <p className="text-muted-foreground">
                Access banks and mobile money across Cameroon and Central African region.
              </p>
            </Card>

            <Card className="p-6">
              <Lock className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Regulatory Compliant</h3>
              <p className="text-muted-foreground">
                Full COBAC & BEAC compliance with automated reporting and audit trails.
              </p>
            </Card>

            <Card className="p-6">
              <Smartphone className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Mobile Money</h3>
              <p className="text-muted-foreground">
                Integrate with Orange Money, MTN MoMo, and other mobile payment providers.
              </p>
            </Card>

            <Card className="p-6">
              <Clock className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Real-Time Data</h3>
              <p className="text-muted-foreground">
                Access account balances, transactions, and payment status in real-time.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-muted-foreground">
              Simple integration process from sandbox to production
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-bold mb-2">Register</h3>
              <p className="text-sm text-muted-foreground">
                Create your account and complete KYC verification
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-bold mb-2">Test</h3>
              <p className="text-sm text-muted-foreground">
                Integrate using our sandbox environment and test APIs
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-bold mb-2">Deploy</h3>
              <p className="text-sm text-muted-foreground">
                Get production credentials and go live
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-bold mb-2">Scale</h3>
              <p className="text-sm text-muted-foreground">
                Monitor, optimize, and grow your integration
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powering Innovation Across Fintech
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-6">
              <Users className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Account Aggregation</h3>
              <p className="text-muted-foreground">
                Build personal finance apps that aggregate accounts from multiple banks for a unified view.
              </p>
            </Card>

            <Card className="p-6">
              <Zap className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Payment Initiation</h3>
              <p className="text-muted-foreground">
                Enable instant payments and transfers directly from users' bank accounts.
              </p>
            </Card>

            <Card className="p-6">
              <TrendingUp className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Lending Platforms</h3>
              <p className="text-muted-foreground">
                Access transaction data for credit scoring and automated loan decisioning.
              </p>
            </Card>

            <Card className="p-6">
              <FileText className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Business Tools</h3>
              <p className="text-muted-foreground">
                Build accounting, invoicing, and reconciliation tools for businesses.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Trusted by Leading Financial Institutions
            </h2>
            <p className="text-muted-foreground">
              Connected to major banks, credit unions, and mobile money providers
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center opacity-60">
            <div className="text-center text-2xl font-bold">Banks</div>
            <div className="text-center text-2xl font-bold">Orange Money</div>
            <div className="text-center text-2xl font-bold">MTN MoMo</div>
            <div className="text-center text-2xl font-bold">CamCCUL</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Transform Financial Services?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join leading fintechs building on Cameroon's most reliable open banking platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Get Started Free
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
