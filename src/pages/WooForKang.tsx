import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, ArrowRight, ShoppingCart, CreditCard, Shield, Zap, FileCode, BookOpen, Github, CheckCircle, Smartphone, BarChart, Gauge } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import wooKangLogo from "@/assets/woo-kang-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const features = [
  {
    icon: Smartphone,
    title: "Mobile Money Integration",
    description: "Accept MTN and Orange Money payments directly in your WooCommerce store with automatic settlement."
  },
  {
    icon: CreditCard,
    title: "Card Payments",
    description: "Process international card payments via Stripe with full PCI DSS compliance and fraud protection."
  },
  {
    icon: BarChart,
    title: "Bank Transfer Support",
    description: "Enable direct bank transfers with automatic reconciliation and instant payment verification."
  },
  {
    icon: Shield,
    title: "Built-in Security",
    description: "Enterprise-grade security with PSD2 compliance, SSL encryption, and real-time fraud detection."
  },
  {
    icon: Gauge,
    title: "Real-time Settlement",
    description: "Automated settlement processing with transparent fee calculation and instant fund transfers."
  },
  {
    icon: Zap,
    title: "XAF Currency Native",
    description: "Full support for Central African Franc (XAF) with accurate exchange rates and local payment methods."
  }
];

const steps = [
  {
    number: 1,
    icon: Download,
    title: "Download Plugin",
    description: "Download Woo for Kang from WordPress.org or upload directly to your site"
  },
  {
    number: 2,
    icon: ShoppingCart,
    title: "Install & Activate",
    description: "Install the plugin through WordPress admin and activate it with one click"
  },
  {
    number: 3,
    icon: CreditCard,
    title: "Connect KOB API",
    description: "Enter your KOB API credentials from your developer dashboard"
  },
  {
    number: 4,
    icon: Shield,
    title: "Configure Payment Methods",
    description: "Enable Mobile Money, Cards, and Bank Transfers in your store settings"
  },
  {
    number: 5,
    icon: CheckCircle,
    title: "Start Accepting Payments",
    description: "Your store is ready to accept payments from customers across Cameroon"
  }
];

const WooForKang = () => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(
        `https://api.kangopenbanking.com/v1/woocommerce-download-plugin`,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'woo-for-kang-v1.0.0.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Woo for Kang v1.0.0 plugin ZIP is downloading",
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <SEO
        title="Woo for Kang - WooCommerce Payment Plugin for Cameroon"
        description="Accept Mobile Money, Card, and Bank Transfer payments in your WooCommerce store. Built for Cameroon merchants with XAF currency support."
        keywords="WooCommerce Cameroon, Mobile Money plugin, MTN Money WooCommerce, Orange Money payments, XAF payment gateway"
      />

      <div className="min-h-screen bg-background">
        {/* Hero Section — solid fi-purple like KOB POS */}
        <section className="relative py-32 overflow-hidden bg-[hsl(var(--fi-purple))]">
          <div className="absolute inset-0 opacity-10">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-white"
                style={{ width: 60 + i * 40, height: 60 + i * 40, left: `${10 + i * 18}%`, top: `${20 + (i % 3) * 25}%` }}
                animate={{ y: [0, -20, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
              />
            ))}
          </div>

          <div className="container relative z-10 mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <img 
                  src={wooKangLogo} 
                  alt="Woo for Kang Logo" 
                  className="mx-auto h-32 w-auto drop-shadow-lg"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Badge className="mb-6 py-2 px-4 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  WordPress Plugin
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-6xl font-bold mb-6 text-white tracking-tight"
              >
                Accept Payments in Your
                <br />
                <span className="text-white/80">WooCommerce Store</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                The most powerful payment solution for Cameroon merchants. Accept Mobile Money, Cards, and Bank Transfers with zero hassle.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap gap-4 justify-center"
              >
                <Button 
                  size="lg"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-white text-[hsl(var(--fi-purple))] hover:bg-white/90 rounded-xl px-8 py-6 text-lg shadow-lg transition-all duration-200 hover:scale-[1.02]"
                >
                  <Download className="mr-2 h-5 w-5" />
                  {downloading ? "Preparing Download..." : "Download Plugin v1.0.0"}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-white text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg transition-all duration-200 hover:scale-[1.02]"
                  asChild
                >
                  <Link to="/integrations/woocommerce-plugin-code">
                    <FileCode className="mr-2 h-5 w-5" />
                    View Plugin Code
                  </Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-2 border-white text-white hover:bg-white/10 rounded-xl px-8 py-6 text-lg transition-all duration-200 hover:scale-[1.02]"
                  asChild
                >
                  <Link to="/integrations/woocommerce-merchant-register">
                    Register Your Store
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4 text-foreground">Everything You Need to Succeed</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Built for Cameroon merchants with enterprise-grade features and local payment methods.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="h-full bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <div className="mb-4">
                        <feature.icon className="w-8 h-8 text-fi-purple" strokeWidth={1.5} />
                      </div>
                      <CardTitle className="text-xl font-semibold mb-2">{feature.title}</CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Get Started Timeline */}
        <section className="py-24 bg-muted/30 border-t border-b border-border">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4 text-foreground">Get Started in 5 Minutes</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Simple setup process with no technical knowledge required.
              </p>
            </motion.div>

            {/* Desktop Horizontal Timeline */}
            <div className="hidden lg:flex items-start justify-center gap-4 max-w-6xl mx-auto">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="flex-1 relative"
                >
                  <Card className="bg-card rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative overflow-visible">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-fi-purple flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {step.number}
                    </div>
                    <CardContent className="pt-14 pb-6 px-6 text-center">
                      <step.icon className="w-7 h-7 text-fi-purple mx-auto mb-4" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold mb-3 text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </CardContent>
                  </Card>
                  {index < steps.length - 1 && (
                    <div className="absolute top-8 -right-2 w-4 h-0.5 bg-fi-purple/30" />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Mobile/Tablet Vertical Timeline */}
            <div className="lg:hidden max-w-2xl mx-auto space-y-6">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="relative"
                >
                  <Card className="bg-card rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6 flex gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-fi-purple flex items-center justify-center text-white text-xl font-bold shadow-lg">
                        {step.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <step.icon className="w-6 h-6 text-fi-purple" strokeWidth={1.5} />
                          <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                  {index < steps.length - 1 && (
                    <div className="absolute left-7 top-[calc(100%)] w-0.5 h-6 bg-fi-purple/30" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <Card className="bg-card border-2 border-fi-purple rounded-3xl shadow-xl overflow-hidden">
                <CardHeader className="text-center py-10 px-8">
                  <CardTitle className="text-3xl font-bold mb-4">Simple, Transparent Pricing</CardTitle>
                  <div className="mb-8">
                    <div className="flex items-baseline justify-center gap-2 mb-4">
                      <span className="text-6xl font-bold text-fi-purple">3.5%</span>
                      <span className="text-2xl text-muted-foreground">+ 100 XAF</span>
                    </div>
                    <p className="text-lg text-muted-foreground">per successful transaction</p>
                  </div>
                  <div className="inline-block">
                    <Badge className="bg-fi-purple/10 text-fi-purple border-0 px-4 py-2 text-sm">
                      Free Plugin Download
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-10">
                  <div className="space-y-4">
                    {[
                      "All payment methods included",
                      "Real-time settlement",
                      "24/7 email & chat support",
                      "Automatic fraud detection",
                      "Detailed analytics dashboard",
                      "No hidden fees or setup costs"
                    ].map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                        className="flex items-center gap-3"
                      >
                        <CheckCircle className="w-5 h-5 text-fi-purple flex-shrink-0" strokeWidth={1.5} />
                        <span className="text-base text-foreground">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                  <Button 
                    size="lg"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full mt-8 bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl py-6 text-lg shadow-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    {downloading ? "Preparing Download..." : "Download Plugin v1.0.0"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* KOB POS Storefront Section */}
        <section className="py-24 bg-background border-t border-border">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto"
            >
              <Card className="rounded-3xl border-l-4 border-l-fi-purple shadow-xl overflow-hidden">
                <CardContent className="p-10 md:p-12">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-fi-purple/10 flex items-center justify-center">
                      <ShoppingCart className="w-8 h-8 text-fi-purple" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold mb-2 text-foreground">Also Accept In-Store Payments with KOB POS</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Complement your WooCommerce online store with in-person QR payments, inventory management, and marketplace discovery. Sync products and orders between your online and physical stores.
                      </p>
                    </div>
                    <Button size="lg" className="bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl px-8 flex-shrink-0" asChild>
                      <Link to="/kob-pos">
                        Explore KOB POS
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold mb-4 text-foreground">Developer Resources</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to integrate and customize the plugin.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <Card className="h-full bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-fi-purple hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <FileCode className="w-10 h-10 text-fi-purple mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">API Documentation</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Comprehensive API reference with code examples and integration guides.
                    </CardDescription>
                    <Link to="/developer" className="text-fi-purple hover:underline inline-flex items-center gap-2 font-medium">
                      View Docs
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Card className="h-full bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-fi-purple hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <Github className="w-10 h-10 text-fi-purple mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">GitHub Repository</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Access the source code, report issues, and contribute to development.
                    </CardDescription>
                    <a href="https://github.com/woocommerce/woocommerce" target="_blank" rel="noopener noreferrer" className="text-fi-purple hover:underline inline-flex items-center gap-2 font-medium">
                      View on GitHub
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </CardHeader>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="h-full bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-fi-purple hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <BookOpen className="w-10 h-10 text-fi-purple mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">Integration Guides</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Step-by-step tutorials for common integration scenarios and customizations.
                    </CardDescription>
                    <Link to="/integrations/woocommerce-docs" className="text-fi-purple hover:underline inline-flex items-center gap-2 font-medium">
                      Browse Guides
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </CardHeader>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-4xl mx-auto"
            >
              <Card className="bg-card border-l-4 border-fi-purple rounded-3xl shadow-2xl overflow-hidden">
                <CardContent className="p-12 text-center">
                  <h2 className="text-4xl font-bold mb-4 text-foreground">Ready to Transform Your Store?</h2>
                  <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                    Join hundreds of Cameroon merchants already accepting payments with Woo for Kang. Get started in minutes.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center">
                    <Button 
                      size="lg"
                      onClick={handleDownload}
                      disabled={downloading}
                      className="bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl px-10 py-7 text-lg shadow-lg transition-all duration-200 hover:scale-[1.03]"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {downloading ? "Preparing..." : "Download Now v1.0.0"}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="border-fi-purple border-2 text-fi-purple hover:bg-fi-purple/5 rounded-xl px-10 py-7 text-lg transition-all duration-200 hover:scale-[1.03]"
                      asChild
                    >
                      <Link to="/integrations/woocommerce-merchant-register">
                        Register Your Store
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default WooForKang;
