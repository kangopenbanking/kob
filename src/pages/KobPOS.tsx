import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Store, QrCode, Smartphone, CreditCard, BarChart3, Shield, Package, Users,
  Globe, Tag, ArrowRight, CheckCircle, Layers, Settings, Eye, Crown,
  MapPin, Image, FileText, BookOpen, Zap, Wallet, RefreshCw, ShoppingCart,
  ListChecks, DollarSign, Printer, Download, ChevronRight, Lock
} from "lucide-react";

const posFeatures = [
  { icon: QrCode, title: "QR Code Payments", description: "Generate unique QR codes for in-store payments. Customers scan and pay instantly from their Kang wallet." },
  { icon: Smartphone, title: "Mobile POS", description: "Turn any smartphone or tablet into a full-featured point-of-sale terminal with inventory management." },
  { icon: Package, title: "Inventory Management", description: "Track stock levels in real-time with low-stock alerts, SKU codes, barcodes, and multi-location support." },
  { icon: BarChart3, title: "Sales Analytics", description: "Comprehensive dashboards with revenue trends, top products, customer insights, and daily reconciliation." },
  { icon: Globe, title: "Marketplace Discovery", description: "Get listed on the KOB consumer marketplace. Customers discover your store, browse products, and order online." },
  { icon: Shield, title: "Secure Transactions", description: "Every transaction is encrypted and settled wallet-to-wallet with full audit trails and fraud protection." },
  { icon: Users, title: "Multi-Cashier Support", description: "Add staff with role-based access and 6-digit PIN authentication for secure cashier operations." },
  { icon: Wallet, title: "Instant Settlement", description: "Funds settle instantly to your merchant wallet. No waiting days for bank transfers." },
  { icon: RefreshCw, title: "WooCommerce Sync", description: "Bidirectional sync with WooCommerce stores — unified catalog, inventory, and order management." },
];

const setupSteps = [
  { step: 1, icon: Store, title: "Create Your Store Profile", description: "Enter your store name, description, and business details. Choose a category that best describes your business to help customers find you.", tips: ["Use a memorable, professional store name", "Write a clear description of what you sell", "Add your physical address for local discovery"] },
  { step: 2, icon: Image, title: "Upload Brand Assets", description: "Add your logo and banner image to make your storefront visually appealing. Professional visuals build customer trust and recognition.", tips: ["Logo: Square format, minimum 200×200px", "Banner: Wide format, 1200×400px recommended", "Use high-quality images with good lighting"] },
  { step: 3, icon: Globe, title: "Set Country & Currency", description: "Select your operating country and currency. Cameroon (XAF/FCFA) is the default. The system supports multiple African and international currencies.", tips: ["Currency determines how prices display to customers", "XAF is default for all CEMAC zone countries", "You can change currency before going live"] },
  { step: 4, icon: Tag, title: "Choose Categories", description: "Select a main category and sub-category for your business. Choose from 13+ main categories covering Food, Fashion, Electronics, Health, and more.", tips: ["Categories affect search ranking and discoverability", "Add custom sub-categories if none fits your niche", "You can update categories anytime"] },
  { step: 5, icon: Package, title: "Configure POS Attributes", description: "Set up product attributes for your POS system: SKU, barcode, weight, unit of measure, pricing, tax class, and stock levels.", tips: ["SKU codes help identify products quickly at checkout", "Set low-stock alerts to avoid running out", "Use barcodes for rapid scanning"] },
  { step: 6, icon: Crown, title: "Choose a Subscription Plan", description: "Select a plan to publish your store on the KOB marketplace. Plans range from basic listing to premium with analytics and priority placement.", tips: ["Start with Basic to test the marketplace", "Premium plans include analytics dashboards", "Upgrade anytime as your business grows"] },
  { step: 7, icon: Eye, title: "Publish & Go Live", description: "Toggle your store to published and you're live! Customers can now discover your store, browse products, scan QR codes, and pay via wallet.", tips: ["Ensure your profile is 100% complete first", "Print your QR code for your store counter", "Share your store link on social media"] },
];

const categories = [
  "Food & Beverages", "Fashion & Apparel", "Electronics & Technology", "Beauty & Cosmetics",
  "Health & Pharmacy", "Home & Living", "Education & Books", "Agriculture & Farming",
  "Construction & Building", "Transport & Logistics", "Professional Services", "Entertainment & Leisure"
];

const countries = [
  { flag: "🇨🇲", name: "Cameroon", currency: "XAF (FCFA)", default: true },
  { flag: "🇳🇬", name: "Nigeria", currency: "NGN (₦)" },
  { flag: "🇬🇭", name: "Ghana", currency: "GHS (GH₵)" },
  { flag: "🇰🇪", name: "Kenya", currency: "KES (KSh)" },
  { flag: "🇿🇦", name: "South Africa", currency: "ZAR (R)" },
  { flag: "🇸🇳", name: "Senegal", currency: "XOF (FCFA)" },
];

const ENTERPRISE_FEATURES = [
  { icon: Image, title: "Custom Branding", description: "Fully branded receipts, customisable colours, fonts, and storefront theming that reflects your business identity." },
  { icon: Settings, title: "API Access", description: "Programmatic access to your POS data, orders, and inventory. Build custom integrations and automate workflows." },
  { icon: MapPin, title: "Multi-location Inventory", description: "Manage stock across multiple physical locations. Per-location tracking, transfers, and consolidated reporting." },
  { icon: Users, title: "Dedicated Account Manager", description: "A personal point of contact for onboarding, strategy, and priority support — assigned within 24 hours." },
  { icon: Shield, title: "SLA Guarantee", description: "99.9% uptime, <2hr support response, <4hr incident resolution. Service credits applied automatically." },
];

const pricingPlans = [
  { name: "Starter", price: "Free", period: "", features: ["Basic store listing", "QR code payments", "Up to 50 products", "Email support"], highlight: false, tier: 'standard' },
  { name: "Professional", price: "5,000 XAF", period: "/month", features: ["Priority marketplace listing", "Unlimited products", "Sales analytics", "Multi-cashier support", "WooCommerce sync", "Priority support"], highlight: true, tier: 'standard' },
  { name: "Enterprise", price: "15,000 XAF", period: "/month", features: ["Everything in Professional", "Custom branding", "API access", "Multi-location inventory", "Dedicated account manager", "SLA guarantee"], highlight: false, tier: 'enterprise' },
];

export default function KobPOS() {
  return (
    <>
      <SEO
        title="KOB POS - Point of Sale & Storefront for African Merchants"
        description="Transform your business with KOB POS. Accept QR payments, manage inventory, and get discovered on the marketplace. Built for Cameroon and Africa."
        keywords="POS Cameroon, point of sale Africa, QR payment, merchant storefront, mobile money POS, XAF payments"
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative py-28 overflow-hidden bg-[hsl(var(--fi-purple))]">
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
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <Badge className="mb-6 py-2 px-5 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                  <Store className="w-4 h-4 mr-2" />
                  KOB POS & Storefront
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl font-bold mb-6 text-white tracking-tight"
              >
                Your Complete
                <br />
                <span className="text-white/80">Merchant Commerce Platform</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
                className="text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                Accept QR payments, manage inventory, sync with WooCommerce, and get discovered by thousands of customers on the KOB marketplace — all from one platform.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4 justify-center"
              >
                <Button size="lg" className="bg-white text-[hsl(var(--fi-purple))] hover:bg-white/90 rounded-xl px-8 py-6 text-lg shadow-lg" asChild>
                  <Link to="/merchant-register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" className="bg-white/20 text-white border-white/30 backdrop-blur-sm hover:bg-white/30 rounded-xl px-8 py-6 text-lg" asChild>
                  <Link to="/merchant/storefront">
                    Open Storefront
                    <Store className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Everything You Need to Sell</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A complete commerce toolkit designed for African merchants — from market stalls to multi-location retailers.
              </p>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {posFeatures.map((feature, i) => (
                <ScrollReveal key={i} delay={i * 0.06}>
                  <Card className="h-full rounded-2xl border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mb-4">
                        <feature.icon className="w-6 h-6 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      </div>
                      <CardTitle className="text-xl font-semibold mb-2">{feature.title}</CardTitle>
                      <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works — Setup Guide */}
        <section className="py-24 bg-muted/30 border-t border-b border-border">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Set Up in 7 Simple Steps</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Follow our guided setup to go from registration to your first sale in minutes.
              </p>
            </ScrollReveal>

            <div className="max-w-4xl mx-auto space-y-4">
              {setupSteps.map((step, i) => (
                <ScrollReveal key={i} delay={i * 0.05}>
                  <Card className="rounded-2xl border hover:shadow-md transition-all duration-300 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-5 p-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[hsl(var(--fi-purple))] flex items-center justify-center text-white font-bold text-lg shadow-md">
                          {step.step}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <step.icon className="w-5 h-5 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                            <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                          </div>
                          <p className="text-muted-foreground leading-relaxed mb-3">{step.description}</p>
                          <div className="flex flex-wrap gap-2">
                            {step.tips.map((tip, j) => (
                              <span key={j} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1">
                                <CheckCircle className="w-3 h-3 text-[hsl(var(--fi-purple))]" />
                                {tip}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Built for Every Business</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                13+ business categories with detailed sub-categories. Custom entries supported.
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {categories.map((cat, i) => (
                <ScrollReveal key={i} delay={i * 0.04}>
                  <Card className="rounded-xl border hover:border-[hsl(var(--fi-purple))]/50 hover:shadow-md transition-all duration-300 text-center">
                    <CardContent className="p-5">
                      <p className="font-medium text-sm text-foreground">{cat}</p>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
              <ScrollReveal delay={0.5}>
                <Card className="rounded-xl border-dashed border-2 hover:border-[hsl(var(--fi-purple))]/50 transition-all duration-300 text-center">
                  <CardContent className="p-5">
                    <p className="font-medium text-sm text-muted-foreground">+ Custom Category</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Multi-Country Support */}
        <section className="py-24 bg-muted/30 border-t border-b border-border">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Multi-Country, Multi-Currency</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Starting with Cameroon and expanding across Africa. Each country maps to its local currency automatically.
              </p>
            </ScrollReveal>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
              {countries.map((c, i) => (
                <ScrollReveal key={i} delay={i * 0.06}>
                  <Card className={`rounded-xl text-center transition-all duration-300 hover:shadow-md ${c.default ? 'border-2 border-[hsl(var(--fi-purple))] shadow-md' : 'border'}`}>
                    <CardContent className="p-5">
                      <p className="text-3xl mb-2">{c.flag}</p>
                      <p className="font-semibold text-sm text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.currency}</p>
                      {c.default && (
                        <Badge className="mt-2 bg-[hsl(var(--fi-purple))] text-white text-[10px] px-2 py-0.5">Default</Badge>
                      )}
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* POS Attributes */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Professional POS Attributes</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                13 standard product attributes for complete inventory control, plus custom fields for your unique needs.
              </p>
            </ScrollReveal>

            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { label: "SKU", desc: "Unique product identifier" },
                  { label: "Barcode (EAN/UPC)", desc: "For scanner integration" },
                  { label: "Weight (kg)", desc: "Product weight tracking" },
                  { label: "Unit of Measure", desc: "Piece, Kg, Litre, Pack..." },
                  { label: "Tax Class", desc: "Standard, Reduced, Exempt" },
                  { label: "Cost Price (XAF)", desc: "Your purchase cost" },
                  { label: "Selling Price (XAF)", desc: "Customer-facing price" },
                  { label: "Stock Quantity", desc: "Current inventory count" },
                  { label: "Low Stock Alert", desc: "Notification threshold" },
                  { label: "Brand", desc: "Product brand name" },
                  { label: "Color / Size", desc: "Product variants" },
                  { label: "Expiry Date", desc: "For perishable goods" },
                ].map((attr, i) => (
                  <ScrollReveal key={i} delay={i * 0.03}>
                    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-all duration-200">
                      <div className="w-2 h-2 rounded-full bg-[hsl(var(--fi-purple))]" />
                      <div>
                        <p className="font-medium text-sm text-foreground">{attr.label}</p>
                        <p className="text-xs text-muted-foreground">{attr.desc}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
              <ScrollReveal delay={0.4} className="mt-4">
                <div className="flex items-center gap-4 p-4 rounded-xl border-dashed border-2 bg-muted/30">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm text-foreground">+ Custom Attributes</p>
                    <p className="text-xs text-muted-foreground">Add your own fields for specialised inventory needs</p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24 bg-muted/30 border-t border-b border-border">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Simple Pricing</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Start free, scale as you grow. No hidden fees.
              </p>
            </ScrollReveal>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {pricingPlans.map((plan, i) => (
                <ScrollReveal key={i} delay={i * 0.1}>
                  <Card className={`rounded-2xl transition-all duration-300 hover:shadow-lg ${plan.highlight ? 'border-2 border-[hsl(var(--fi-purple))] shadow-lg relative' : 'border'}`}>
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[hsl(var(--fi-purple))] text-white px-4 py-1">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-xl font-semibold">{plan.name}</CardTitle>
                      <div className="mt-4">
                        <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                        <span className="text-muted-foreground">{plan.period}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {plan.features.map((f, j) => {
                          const isEnterpriseLocked = plan.tier !== 'enterprise' && ['Custom branding', 'API access', 'Multi-location inventory', 'Dedicated account manager', 'SLA guarantee'].some(ef => f.toLowerCase().includes(ef.toLowerCase()));
                          return (
                            <div key={j} className="flex items-center gap-3">
                              {isEnterpriseLocked ? (
                                <Lock className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" strokeWidth={1.5} />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-[hsl(var(--fi-purple))] flex-shrink-0" strokeWidth={1.5} />
                              )}
                              <span className={`text-sm ${isEnterpriseLocked ? 'text-muted-foreground/50' : 'text-foreground'}`}>{f}</span>
                              {plan.tier === 'enterprise' && ['Custom branding', 'API access', 'Multi-location inventory', 'Dedicated account manager', 'SLA guarantee'].some(ef => f.toLowerCase().includes(ef.toLowerCase())) && (
                                <Badge className="bg-[hsl(var(--fi-purple))]/10 text-[hsl(var(--fi-purple))] border-0 text-[9px] px-1.5 py-0">Enterprise</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        className={`w-full mt-6 rounded-xl ${plan.highlight ? 'bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white' : ''}`}
                        variant={plan.highlight ? "default" : "outline"}
                        asChild
                      >
                        <Link to="/merchant/storefront">
                          {plan.price === "Free" ? "Get Started" : "Subscribe"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* Enterprise Features Detail */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <div className="inline-flex items-center gap-2 mb-4">
                <Badge className="bg-[hsl(var(--fi-purple))]/10 text-[hsl(var(--fi-purple))] border-[hsl(var(--fi-purple))]/20 px-4 py-1.5">
                  <Crown className="w-4 h-4 mr-2" /> Enterprise Package
                </Badge>
              </div>
              <h2 className="text-4xl font-bold mb-4 text-foreground">Enterprise-Grade Features</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Unlock the full power of KOB POS with custom branding, API access, multi-location management, and dedicated support.
              </p>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {ENTERPRISE_FEATURES.map((feat, i) => (
                <ScrollReveal key={i} delay={i * 0.08}>
                  <Card className="h-full rounded-2xl border-2 border-[hsl(var(--fi-purple))]/10 hover:border-[hsl(var(--fi-purple))]/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardHeader>
                      <div className="w-12 h-12 rounded-xl bg-[hsl(var(--fi-purple))]/10 flex items-center justify-center mb-4">
                        <feat.icon className="w-6 h-6 text-[hsl(var(--fi-purple))]" strokeWidth={1.5} />
                      </div>
                      <CardTitle className="text-lg font-semibold mb-2 flex items-center gap-2">
                        {feat.title}
                        <Badge className="bg-[hsl(var(--fi-purple))]/10 text-[hsl(var(--fi-purple))] border-0 text-[10px]">Enterprise</Badge>
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed">{feat.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
              ))}
              <ScrollReveal delay={0.5}>
                <Card className="h-full rounded-2xl border-2 border-dashed border-[hsl(var(--fi-purple))]/20 flex items-center justify-center hover:shadow-md transition-all duration-300">
                  <CardContent className="text-center py-12">
                    <Crown className="w-10 h-10 text-[hsl(var(--fi-purple))] mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-lg font-semibold text-foreground mb-2">Ready to Scale?</p>
                    <p className="text-sm text-muted-foreground mb-5">Get all enterprise features with one subscription.</p>
                    <Button className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl" asChild>
                      <Link to="/merchant/storefront">
                        Subscribe Now <ArrowRight className="ml-2 w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* QR Payment Flow */}
        <section className="py-24 bg-muted/30 border-t border-b border-border">
          <div className="container mx-auto px-4">
            <ScrollReveal className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4 text-foreground">Accept Payments in Seconds</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Generate a QR code, customer scans, payment settles instantly to your wallet.
              </p>
            </ScrollReveal>

            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  { step: "1", icon: QrCode, title: "Generate QR Code", desc: "Set an amount or leave it open. Your unique merchant QR is ready in one tap." },
                  { step: "2", icon: Smartphone, title: "Customer Scans", desc: "Customer opens the Kang app, scans the QR code, and confirms the payment." },
                  { step: "3", icon: Wallet, title: "Instant Settlement", desc: "Funds transfer wallet-to-wallet instantly. You see it in your balance immediately." },
                ].map((item, i) => (
                  <ScrollReveal key={i} delay={i * 0.1}>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-[hsl(var(--fi-purple))] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 shadow-lg">
                        {item.step}
                      </div>
                      <item.icon className="w-8 h-8 text-[hsl(var(--fi-purple))] mx-auto mb-4" strokeWidth={1.5} />
                      <h3 className="text-lg font-semibold mb-2 text-foreground">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WooCommerce Integration CTA */}
        <section className="py-20 bg-muted/30 border-t border-border">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <Card className="max-w-4xl mx-auto rounded-3xl border-l-4 border-l-fi-purple shadow-xl overflow-hidden">
                <CardContent className="p-10 md:p-12">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-fi-purple/10 flex items-center justify-center">
                      <ShoppingCart className="w-8 h-8 text-fi-purple" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-2xl font-bold mb-2 text-foreground">Also Sell Online with WooCommerce</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Install the Woo for Kang plugin to accept Mobile Money, Card, and Bank Transfer payments on your WordPress store. Sync inventory and orders with your POS.
                      </p>
                    </div>
                    <Button size="lg" className="bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl px-8 flex-shrink-0" asChild>
                      <Link to="/woo-for-kang">
                        Explore the WooCommerce plugin
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-4xl font-bold mb-4 text-foreground">Ready to Start Selling?</h2>
                <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                  Join thousands of African merchants growing their business with KOB POS. Set up your storefront in minutes.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Button size="lg" className="bg-[hsl(var(--fi-purple))] hover:bg-[hsl(var(--fi-purple))]/90 text-white rounded-xl px-10 py-7 text-lg shadow-lg" asChild>
                    <Link to="/merchant-register">
                      Create Free Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-xl px-10 py-7 text-lg border-2" asChild>
                    <Link to="/manual/merchants">
                      <BookOpen className="mr-2 h-5 w-5" />
                      Read the Guide
                    </Link>
                  </Button>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </div>
    </>
  );
}
