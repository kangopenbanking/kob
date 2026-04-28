import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Download, 
  ShoppingCart, 
  Key, 
  Webhook, 
  CheckCircle, 
  AlertTriangle,
  Code,
  Terminal,
  PlayCircle,
  FileText,
  Settings,
  CreditCard,
  Smartphone,
  Building2,
  Shield,
  ArrowRight,
  FileCode
} from "lucide-react";

const WooCommerceGuide = () => {
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

  const paymentMethods = [
    { icon: Smartphone, name: "Mobile Money", description: "MTN Mobile Money, Orange Money" },
    { icon: CreditCard, name: "Card Payments", description: "Visa, Mastercard via Stripe" },
    { icon: Building2, name: "Bank Transfer", description: "Direct bank transfers in XAF" }
  ];

  const features = [
    "Automatic order status updates via webhooks",
    "Real-time transaction synchronization",
    "Multi-currency support (XAF primary)",
    "Refund and cancellation handling",
    "Comprehensive transaction logs",
    "WooCommerce Blocks compatibility",
    "Mobile-responsive checkout"
  ];

  return (
    <>
      <SEO
        title="WooCommerce Integration Guide - Woo for Kang Plugin"
        description="Complete guide to integrating Kang Open Banking payments into your WooCommerce store. Accept Mobile Money, cards, and bank transfers in Cameroon."
        keywords="woocommerce cameroon, mobile money woocommerce, xaf payment gateway, cameroon ecommerce"
      />
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 max-w-5xl">
          
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#96588a] text-white hover:bg-[#7a466f]">
              <ShoppingCart className="mr-2 h-3 w-3" />
              WooCommerce Plugin
            </Badge>
            <h1 className="text-5xl font-bold mb-4">Woo for Kang</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Complete integration guide for accepting Mobile Money, cards, and bank transfers on your WooCommerce store
            </p>
          </div>

          {/* Ready Alert */}
          <Alert className="mb-12 border-green-500 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm">
              <strong className="text-green-800">Available Now:</strong> Woo for Kang v1.0.0 is production-ready. 
              Download the plugin ZIP, install it in WordPress, and start accepting payments.
              <Link to="/integrations/woocommerce-merchant-register" className="ml-2 text-green-700 hover:underline font-medium">
                Register Your Store <ArrowRight className="inline h-3 w-3 ml-1" />
              </Link>
            </AlertDescription>
          </Alert>

          {/* Payment Methods */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Supported Payment Methods
              </CardTitle>
              <CardDescription>Accept all major payment methods in Cameroon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <div key={method.name} className="flex flex-col items-center text-center p-4 rounded-lg border bg-card">
                      <Icon className="h-10 w-10 mb-3 text-[#96588a]" />
                      <h3 className="font-semibold mb-1">{method.name}</h3>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs defaultValue="installation" className="mb-12">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="installation">Installation</TabsTrigger>
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="testing">Testing</TabsTrigger>
              <TabsTrigger value="troubleshooting">Help</TabsTrigger>
            </TabsList>

            {/* Installation Tab */}
            <TabsContent value="installation" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Step 1: Download Plugin
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border-2 border-green-500 bg-green-50 p-6 text-center">
                    <Download className="h-12 w-12 mx-auto mb-3 text-green-600" />
                    <p className="text-green-800 font-semibold mb-2">Woo for Kang v1.0.0</p>
                    <p className="text-sm text-green-700 mb-4">Production-ready — Download now</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <Button 
                        onClick={handleDownload}
                        disabled={downloading}
                        className="bg-[#96588a] hover:bg-[#7a466f]"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        {downloading ? "Downloading..." : "Download Plugin ZIP"}
                      </Button>
                      <Button variant="outline" asChild>
                        <Link to="/integrations/woocommerce-plugin-code">
                          <FileCode className="mr-2 h-4 w-4" />
                          View Plugin Code
                        </Link>
                      </Button>
                      <Button variant="default" asChild className="bg-green-600 hover:bg-green-700">
                        <Link to="/integrations/woocommerce-merchant-register">
                          Register Your Store
                        </Link>
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-3">
                      9 files included: gateway, API client, webhooks, logger, templates, readme, license
                    </p>
                  </div>
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Requirements: WordPress 5.8+, WooCommerce 6.0+, PHP 7.4+
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Step 2: Install in WordPress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Upload Plugin</p>
                      <p className="text-sm text-muted-foreground">Navigate to <code className="bg-muted px-1 py-0.5 rounded">Plugins → Add New → Upload Plugin</code></p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                      2
                    </div>
                    <div>
                      <p className="font-medium">Choose File</p>
                      <p className="text-sm text-muted-foreground">Select the downloaded <code className="bg-muted px-1 py-0.5 rounded">woo-for-kang.zip</code> file</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Activate</p>
                      <p className="text-sm text-muted-foreground">Click "Activate Plugin" after installation completes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuration Tab */}
            <TabsContent value="configuration" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Get API Credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Register your WooCommerce store to receive API credentials instantly.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Register Your Store</p>
                        <p className="text-sm text-muted-foreground">Provide store details and get instant API credentials</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Automatic Setup</p>
                        <p className="text-sm text-muted-foreground">API Key, Client Secret, and Webhook credentials generated automatically</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Secure Integration</p>
                        <p className="text-sm text-muted-foreground">Credentials are hashed and stored securely</p>
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-[#96588a] hover:bg-[#7a466f]">
                    <Link to="/integrations/woocommerce-merchant-register">
                      Register Your Store <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configure Plugin Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                        1
                      </div>
                      <div>
                        <p className="font-medium">Navigate to Payment Settings</p>
                        <p className="text-sm text-muted-foreground">
                          <code className="bg-muted px-1 py-0.5 rounded">WooCommerce → Settings → Payments</code>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                        2
                      </div>
                      <div>
                        <p className="font-medium">Enable Kang Open Banking</p>
                        <p className="text-sm text-muted-foreground">Toggle the "Kang Open Banking" payment method to enabled</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                        3
                      </div>
                      <div>
                        <p className="font-medium">Enter API Credentials</p>
                        <p className="text-sm text-muted-foreground">Paste your Client ID and Client Secret</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                        4
                      </div>
                      <div>
                        <p className="font-medium">Select Payment Methods</p>
                        <p className="text-sm text-muted-foreground">Choose which methods to enable (Mobile Money, Cards, Bank Transfer)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#96588a] text-white text-sm font-bold flex-shrink-0">
                        5
                      </div>
                      <div>
                        <p className="font-medium">Configure Webhook URL</p>
                        <p className="text-sm text-muted-foreground">The plugin auto-generates your webhook endpoint</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Webhook Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Webhooks automatically update order statuses when payments are completed.
                  </p>
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      Your webhook URL: <code className="bg-muted px-1 py-0.5 rounded text-xs">https://yoursite.com/wc-api/woo-for-kang</code>
                      <br />
                      <span className="text-xs text-muted-foreground">This is automatically configured by the plugin</span>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Testing Tab */}
            <TabsContent value="testing" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PlayCircle className="h-5 w-5" />
                    Testing in Sandbox Mode
                  </CardTitle>
                  <CardDescription>Test payments before going live</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert className="border-yellow-500 bg-yellow-500/5">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription>
                      Always test with sandbox credentials first. Use test phone numbers and card details to verify integration.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold">Test Data:</h4>
                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p><strong>Mobile Money Test Number:</strong> <code>237650000000</code></p>
                      <p><strong>Test Card Number:</strong> <code>4242 4242 4242 4242</code></p>
                      <p><strong>Expiry:</strong> <code>Any future date</code></p>
                      <p><strong>CVC:</strong> <code>123</code></p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Testing Checklist:</h4>
                    {[
                      "Place test order with Mobile Money",
                      "Place test order with Card payment",
                      "Place test order with Bank Transfer",
                      "Verify webhook updates order status",
                      "Test refund flow",
                      "Test order cancellation",
                      "Check transaction logs in admin"
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Going Live
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <p className="font-medium">Switch to Production Keys</p>
                      <p className="text-sm text-muted-foreground">Replace sandbox credentials with production API keys</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <p className="font-medium">Process Real Transaction</p>
                      <p className="text-sm text-muted-foreground">Place a small test order with real payment to verify</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-sm font-bold flex-shrink-0">
                      ✓
                    </div>
                    <div>
                      <p className="font-medium">Monitor First Orders</p>
                      <p className="text-sm text-muted-foreground">Watch webhook logs and transaction status closely</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Troubleshooting Tab */}
            <TabsContent value="troubleshooting" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Common Issues</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <h4 className="font-semibold mb-1">Payment not completing</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Check that your API credentials are correct and you're using the right environment (sandbox vs production).
                      </p>
                    </div>
                    
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <h4 className="font-semibold mb-1">Webhook not firing</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Ensure your site has a valid SSL certificate and the webhook URL is accessible from external servers.
                      </p>
                    </div>
                    
                    <div className="border-l-4 border-yellow-500 pl-4">
                      <h4 className="font-semibold mb-1">API connection errors</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Verify your server can make outbound HTTPS requests. Check PHP curl extension is enabled.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Support Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/developer">
                      <Code className="mr-2 h-4 w-4" />
                      API Documentation
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link to="/contact">
                      <FileText className="mr-2 h-4 w-4" />
                      Contact Support
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://github.com/woocommerce" target="_blank" rel="noopener noreferrer">
                      <Terminal className="mr-2 h-4 w-4" />
                      WooCommerce Docs
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Features List */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Plugin Features</CardTitle>
              <CardDescription>Everything you need for payments in Cameroon</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="border-2 border-[#96588a] mb-12">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Simple, Transparent Pricing</CardTitle>
              <CardDescription>Pay only for successful transactions</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div>
                <div className="text-5xl font-bold text-[#96588a] mb-2">Low Fees</div>
                <div className="text-muted-foreground">Dynamic rates per channel — view in merchant dashboard</div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">✓ Free plugin download</p>
                <p className="text-sm text-muted-foreground">✓ No monthly fees</p>
                <p className="text-sm text-muted-foreground">✓ No setup costs</p>
                <p className="text-sm text-muted-foreground">✓ All payment methods included</p>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="bg-gradient-to-r from-[#96588a]/10 to-[#96588a]/5 border-[#96588a]">
            <CardContent className="py-12 text-center space-y-6">
              <h2 className="text-3xl font-bold">Ready to Accept Payments?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Download the plugin and register your store to start accepting Mobile Money, card payments, and bank transfers today.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button 
                  size="lg" 
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-[#96588a] hover:bg-[#7a466f]"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading ? "Preparing..." : "Download Plugin"}
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/integrations/woocommerce-merchant-register">
                    Register Store
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/contact">Contact Sales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default WooCommerceGuide;
