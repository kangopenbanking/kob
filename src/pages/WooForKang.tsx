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

const AnimatedBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating Circles */}
      <motion.div
        className="absolute top-20 left-[10%] w-32 h-32 rounded-full bg-[#96588a]/5 blur-2xl"
        animate={{
          y: [0, -30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute top-40 right-[15%] w-40 h-40 rounded-full bg-[#96588a]/8 blur-3xl"
        animate={{
          y: [0, 40, 0],
          scale: [1, 0.9, 1],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <motion.div
        className="absolute bottom-32 left-[20%] w-24 h-24 rounded-full bg-[#96588a]/6 blur-2xl"
        animate={{
          y: [0, -20, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
      />

      {/* Abstract Shapes */}
      <motion.div
        className="absolute top-[30%] right-[25%] w-20 h-20 bg-[#96588a]/4 blur-xl"
        style={{ borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }}
        animate={{
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute bottom-[25%] right-[10%] w-16 h-16 bg-[#96588a]/5 blur-xl"
        style={{ borderRadius: "63% 37% 54% 46% / 55% 48% 52% 45%" }}
        animate={{
          rotate: [360, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Bubbles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-[#96588a]/10"
          style={{
            left: `${15 + i * 15}%`,
            bottom: -10,
          }}
          animate={{
            y: [-10, -600],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 8 + i,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 1.5
          }}
        />
      ))}

      {/* Wave SVG */}
      <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <motion.path
          fill="#96588a"
          fillOpacity="0.03"
          d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,144C960,149,1056,139,1152,122.7C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          animate={{
            d: [
              "M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,144C960,149,1056,139,1152,122.7C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              "M0,160L48,149.3C96,139,192,117,288,128C384,139,480,181,576,197.3C672,213,768,203,864,181.3C960,160,1056,128,1152,133.3C1248,139,1344,181,1392,202.7L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
              "M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,144C960,149,1056,139,1152,122.7C1248,107,1344,85,1392,74.7L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z",
            ]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </svg>
    </div>
  );
};

const WooForKang = () => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke('woocommerce-download-plugin');
      
      if (error) throw error;
      
      // Open download URL in new tab
      window.open(data.download_url, '_blank');
      
      toast({
        title: "Download Started",
        description: `Woo for Kang v${data.version} is being downloaded`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download plugin",
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
        {/* Hero Section */}
        <section className="relative py-32 overflow-hidden">
          <AnimatedBackground />
          
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
                <Badge className="mb-6 py-2 px-4 bg-white border border-[#96588a]/20 text-[#96588a] hover:bg-[#96588a]/5">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  WordPress Plugin
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-6xl font-bold mb-6 text-foreground tracking-tight"
              >
                Accept Payments in Your
                <br />
                <span className="text-[#96588a]">WooCommerce Store</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
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
                  className="bg-[#96588a] hover:bg-[#7a466f] text-white rounded-xl px-8 py-6 text-lg shadow-lg transition-all duration-200 hover:scale-[1.02]"
                >
                  <Download className="mr-2 h-5 w-5" />
                  {downloading ? "Preparing Download..." : "Download Plugin v1.0.0"}
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white border-[#96588a] border-2 text-[#96588a] hover:bg-[#96588a]/5 rounded-xl px-8 py-6 text-lg transition-all duration-200 hover:scale-[1.02]"
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
                  <Card className="h-full bg-white border border-border rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <div className="mb-4">
                        <feature.icon className="w-8 h-8 text-[#96588a]" strokeWidth={1.5} />
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
                  <Card className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative overflow-visible">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[#96588a] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {step.number}
                    </div>
                    <CardContent className="pt-14 pb-6 px-6 text-center">
                      <step.icon className="w-7 h-7 text-[#96588a] mx-auto mb-4" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold mb-3 text-foreground">{step.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                    </CardContent>
                  </Card>
                  {index < steps.length - 1 && (
                    <div className="absolute top-8 -right-2 w-4 h-0.5 bg-[#96588a]/30" />
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
                  <Card className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6 flex gap-6">
                      <div className="flex-shrink-0 w-14 h-14 rounded-full bg-[#96588a] flex items-center justify-center text-white text-xl font-bold shadow-lg">
                        {step.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <step.icon className="w-6 h-6 text-[#96588a]" strokeWidth={1.5} />
                          <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                  {index < steps.length - 1 && (
                    <div className="absolute left-7 top-[calc(100%)] w-0.5 h-6 bg-[#96588a]/30" />
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
              <Card className="bg-white border-2 border-[#96588a] rounded-3xl shadow-xl overflow-hidden">
                <CardHeader className="text-center py-10 px-8">
                  <CardTitle className="text-3xl font-bold mb-4">Simple, Transparent Pricing</CardTitle>
                  <div className="mb-8">
                    <div className="flex items-baseline justify-center gap-2 mb-4">
                      <span className="text-6xl font-bold text-[#96588a]">3.5%</span>
                      <span className="text-2xl text-muted-foreground">+ 100 XAF</span>
                    </div>
                    <p className="text-lg text-muted-foreground">per successful transaction</p>
                  </div>
                  <div className="inline-block">
                    <Badge className="bg-[#96588a]/10 text-[#96588a] border-0 px-4 py-2 text-sm">
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
                        <CheckCircle className="w-5 h-5 text-[#96588a] flex-shrink-0" strokeWidth={1.5} />
                        <span className="text-base text-foreground">{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                  <Button 
                    size="lg"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full mt-8 bg-[#96588a] hover:bg-[#7a466f] text-white rounded-xl py-6 text-lg shadow-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    {downloading ? "Preparing Download..." : "Download Plugin v1.0.0"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Developer Resources */}
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
                <Card className="h-full bg-white border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-[#96588a] hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <FileCode className="w-10 h-10 text-[#96588a] mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">API Documentation</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Comprehensive API reference with code examples and integration guides.
                    </CardDescription>
                    <Link to="/developer" className="text-[#96588a] hover:underline inline-flex items-center gap-2 font-medium">
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
                <Card className="h-full bg-white border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-[#96588a] hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <Github className="w-10 h-10 text-[#96588a] mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">GitHub Repository</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Access the source code, report issues, and contribute to development.
                    </CardDescription>
                    <a href="https://github.com/woocommerce/woocommerce" target="_blank" rel="noopener noreferrer" className="text-[#96588a] hover:underline inline-flex items-center gap-2 font-medium">
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
                <Card className="h-full bg-white border border-border rounded-2xl shadow-sm hover:shadow-lg hover:border-[#96588a] hover:border-2 transition-all duration-300">
                  <CardHeader>
                    <BookOpen className="w-10 h-10 text-[#96588a] mb-4" strokeWidth={1.5} />
                    <CardTitle className="text-xl font-semibold mb-2">Integration Guides</CardTitle>
                    <CardDescription className="text-base leading-relaxed mb-4">
                      Step-by-step tutorials for common integration scenarios and customizations.
                    </CardDescription>
                    <Link to="/integrations/woocommerce-docs" className="text-[#96588a] hover:underline inline-flex items-center gap-2 font-medium">
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
              <Card className="bg-white border-l-4 border-[#96588a] rounded-3xl shadow-2xl overflow-hidden">
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
                      className="bg-[#96588a] hover:bg-[#7a466f] text-white rounded-xl px-10 py-7 text-lg shadow-lg transition-all duration-200 hover:scale-[1.03]"
                    >
                      <Download className="mr-2 h-5 w-5" />
                      {downloading ? "Preparing..." : "Download Now v1.0.0"}
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="bg-white border-[#96588a] border-2 text-[#96588a] hover:bg-[#96588a]/5 rounded-xl px-10 py-7 text-lg transition-all duration-200 hover:scale-[1.03]"
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
