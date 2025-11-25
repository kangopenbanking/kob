import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Download, Package, CreditCard, Smartphone, ArrowRight, Shield, Zap, BarChart3, Code } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";

const WooForKang = () => {
  const features = [
    {
      icon: CreditCard,
      title: "Multiple Payment Methods",
      description: "Accept Mobile Money (MTN, Orange Money), Bank Transfers, and Card Payments"
    },
    {
      icon: Smartphone,
      title: "Mobile Money Integration",
      description: "Native support for XAF and other African currencies with instant settlements"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "PCI-DSS compliant with COBAC regulatory compliance built-in"
    },
    {
      icon: Zap,
      title: "Instant Setup",
      description: "Install and configure in minutes with automatic API integration"
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Track transactions, settlements, and revenue from your WordPress dashboard"
    },
    {
      icon: Package,
      title: "WooCommerce Native",
      description: "Seamless integration with all WooCommerce features and extensions"
    }
  ];

  const steps = [
    { number: "1", title: "Download Plugin", description: "Get the Woo for Kang plugin from WordPress.org or directly from GitHub" },
    { number: "2", title: "Install & Activate", description: "Upload to WordPress and activate through your Plugins menu" },
    { number: "3", title: "Connect KOB API", description: "Enter your API credentials from your KOB developer dashboard" },
    { number: "4", title: "Configure Payments", description: "Enable payment methods and customize checkout experience" },
    { number: "5", title: "Start Selling", description: "Begin accepting payments from customers across Cameroon and beyond" }
  ];

  return (
    <>
      <SEO 
        title="Woo for Kang - WooCommerce Payment Plugin"
        description="Accept Mobile Money, Bank Transfers, and Card Payments in your WooCommerce store with the Woo for Kang plugin. PCI-DSS compliant with instant settlements."
        keywords="WooCommerce payment gateway, Cameroon payments, Mobile Money WooCommerce, XAF payment plugin, African payment gateway"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-[#96588a]/5 via-background to-[#96588a]/10">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#96588a]/30 bg-[#96588a]/10 mb-6">
              <Package className="h-4 w-4 text-[#96588a]" />
              <span className="text-sm font-medium text-[#96588a]">WordPress Plugin</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#96588a] to-[#7a466f] bg-clip-text text-transparent">
              Woo for Kang
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The Complete Payment Solution for WooCommerce Stores in Cameroon and Africa
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-gradient-to-r from-[#96588a] to-[#7a466f] hover:opacity-90 text-white">
                <Download className="mr-2 h-5 w-5" />
                Download Plugin
              </Button>
              <Button size="lg" variant="outline" className="border-[#96588a]/30 hover:bg-[#96588a]/10">
                View Documentation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#96588a]" />
                <span>Free Plugin</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#96588a]" />
                <span>3.5% + 100 XAF per transaction</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#96588a]" />
                <span>No Monthly Fees</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to Accept Payments
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built specifically for African e-commerce with support for local payment methods
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-[#96588a]/20 hover:border-[#96588a]/40 transition-colors">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-[#96588a]/20 to-[#96588a]/5 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-[#96588a]" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Installation Steps */}
        <section className="container mx-auto px-4 py-20 bg-gradient-to-br from-[#96588a]/5 to-transparent rounded-3xl">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Get Started in 5 Minutes
              </h2>
              <p className="text-muted-foreground">
                Simple installation process with no technical expertise required
              </p>
            </div>
            
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-[#96588a] to-[#7a466f] flex items-center justify-center text-white font-bold text-lg">
                    {step.number}
                  </div>
                  <div className="flex-1 pt-2">
                    <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-3xl mx-auto">
            <Card className="border-[#96588a]/30 bg-gradient-to-br from-[#96588a]/5 to-background">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl mb-2">Simple, Transparent Pricing</CardTitle>
                <CardDescription className="text-base">
                  No hidden fees, no monthly charges, no setup costs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-5xl font-bold text-[#96588a] mb-4">
                    3.5% + 100 XAF
                  </div>
                  <p className="text-lg text-muted-foreground mb-8">
                    per successful transaction
                  </p>
                  
                  <div className="space-y-4 max-w-md mx-auto text-left">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#96588a] mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Free plugin download and installation</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#96588a] mt-0.5 flex-shrink-0" />
                      <span className="text-sm">No monthly subscription fees</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#96588a] mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Instant settlements to your account</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#96588a] mt-0.5 flex-shrink-0" />
                      <span className="text-sm">Support for XAF and multiple currencies</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-[#96588a] mt-0.5 flex-shrink-0" />
                      <span className="text-sm">24/7 technical support included</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Developer Resources */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Developer Resources
              </h2>
              <p className="text-muted-foreground">
                Everything you need to customize and extend the plugin
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-[#96588a]/20 hover:border-[#96588a]/40 transition-colors">
                <CardHeader>
                  <Code className="h-8 w-8 text-[#96588a] mb-2" />
                  <CardTitle>API Documentation</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    Complete API reference and integration guides
                  </CardDescription>
                  <Link to="/for-developers">
                    <Button variant="ghost" className="text-[#96588a] hover:text-[#96588a] hover:bg-[#96588a]/10 p-0">
                      View Docs <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              
              <Card className="border-[#96588a]/20 hover:border-[#96588a]/40 transition-colors">
                <CardHeader>
                  <Package className="h-8 w-8 text-[#96588a] mb-2" />
                  <CardTitle>GitHub Repository</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    Open source codebase for customization
                  </CardDescription>
                  <Button variant="ghost" className="text-[#96588a] hover:text-[#96588a] hover:bg-[#96588a]/10 p-0">
                    View on GitHub <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="border-[#96588a]/20 hover:border-[#96588a]/40 transition-colors">
                <CardHeader>
                  <Shield className="h-8 w-8 text-[#96588a] mb-2" />
                  <CardTitle>Support Center</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    Get help from our technical support team
                  </CardDescription>
                  <Link to="/contact">
                    <Button variant="ghost" className="text-[#96588a] hover:text-[#96588a] hover:bg-[#96588a]/10 p-0">
                      Contact Support <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <Card className="border-[#96588a]/30 bg-gradient-to-br from-[#96588a]/10 via-[#96588a]/5 to-background">
              <CardContent className="p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Ready to Start Accepting Payments?
                </h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                  Join thousands of WooCommerce stores across Africa using Woo for Kang to process payments
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="bg-gradient-to-r from-[#96588a] to-[#7a466f] hover:opacity-90 text-white">
                    <Download className="mr-2 h-5 w-5" />
                    Download Now
                  </Button>
                  <Link to="/register">
                    <Button size="lg" variant="outline" className="border-[#96588a]/30 hover:bg-[#96588a]/10">
                      Create KOB Account
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
};

export default WooForKang;
