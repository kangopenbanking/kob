import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Store, Mail, Globe, Key, Lock, Webhook, ShoppingCart, Shield, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import wooKangLogo from "@/assets/woo-kang-logo.png";

const AnimatedBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute top-20 left-[10%] w-32 h-32 rounded-full bg-fi-purple/5 blur-2xl"
        animate={{ y: [0, -30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-40 right-[15%] w-40 h-40 rounded-full bg-fi-purple/10 blur-3xl"
        animate={{ y: [0, 40, 0], scale: [1, 0.9, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-32 left-[20%] w-24 h-24 rounded-full bg-fi-purple/5 blur-2xl"
        animate={{ y: [0, -20, 0], x: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-fi-purple/10"
          style={{ left: `${15 + i * 15}%`, bottom: -10 }}
          animate={{ y: [-10, -600], opacity: [0, 0.5, 0] }}
          transition={{ duration: 8 + i, repeat: Infinity, ease: "easeOut", delay: i * 1.5 }}
        />
      ))}
    </div>
  );
};

const features = [
  {
    icon: ShoppingCart,
    title: "Easy Integration",
    description: "Connect your WooCommerce store in minutes with our simple setup process"
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Enterprise-grade security with PCI DSS compliance and fraud protection"
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    description: "Get paid quickly with automated settlement to your account"
  }
];

export default function WooCommerceMerchantRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    store_name: '',
    store_url: '',
    admin_email: ''
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({ title: "Copied!", description: `${field} copied to clipboard` });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to register your WooCommerce store",
          variant: "destructive"
        });
        navigate('/auth');
        return;
      }

      const { data, error } = await supabase.functions.invoke('woocommerce-register-merchant', {
        body: formData,
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) throw error;
      
      setCredentials(data);
      toast({
        title: "Registration Successful!",
        description: "Your WooCommerce store has been registered with KOB",
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register store",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (credentials) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <AnimatedBackground />
        
        <div className="container relative z-10 max-w-4xl mx-auto py-16 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="border-2 border-green-200 bg-card shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200 pb-8">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                    <Check className="h-10 w-10 text-white" />
                  </div>
                </div>
                <CardTitle className="text-center text-3xl font-bold text-green-700">
                  Store Registered Successfully!
                </CardTitle>
                <CardDescription className="text-center text-lg text-green-600 mt-2">
                  Your credentials are ready. Save them securely — they won't be shown again.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <Alert className="bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                  <AlertDescription className="text-yellow-800 font-medium flex items-start gap-2">
                    <span className="text-2xl">⚠️</span>
                    <span><strong>Critical:</strong> Copy and save these credentials now. They will not be displayed again for security reasons.</span>
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {/* API Key */}
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Key className="h-5 w-5 text-fi-purple" />
                      API Key
                    </Label>
                    <div className="flex gap-2">
                      <Input value={credentials.api_key} readOnly className="font-mono text-sm bg-card border-2 focus:border-fi-purple rounded-xl" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(credentials.api_key, "API Key")} className="rounded-xl border-2 hover:bg-fi-purple/5 hover:border-fi-purple transition-all duration-200">
                        {copiedField === "API Key" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-fi-purple" />}
                      </Button>
                    </div>
                  </motion.div>

                  {/* Client Secret */}
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Lock className="h-5 w-5 text-fi-purple" />
                      Client Secret
                    </Label>
                    <div className="flex gap-2">
                      <Input value={credentials.client_secret} readOnly className="font-mono text-sm bg-card border-2 focus:border-fi-purple rounded-xl" type="password" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(credentials.client_secret, "Client Secret")} className="rounded-xl border-2 hover:bg-fi-purple/5 hover:border-fi-purple transition-all duration-200">
                        {copiedField === "Client Secret" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-fi-purple" />}
                      </Button>
                    </div>
                  </motion.div>

                  {/* Webhook Secret */}
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Webhook className="h-5 w-5 text-fi-purple" />
                      Webhook Secret
                    </Label>
                    <div className="flex gap-2">
                      <Input value={credentials.webhook_secret} readOnly className="font-mono text-sm bg-card border-2 focus:border-fi-purple rounded-xl" type="password" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(credentials.webhook_secret, "Webhook Secret")} className="rounded-xl border-2 hover:bg-fi-purple/5 hover:border-fi-purple transition-all duration-200">
                        {copiedField === "Webhook Secret" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-fi-purple" />}
                      </Button>
                    </div>
                  </motion.div>

                  {/* Webhook URL */}
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Globe className="h-5 w-5 text-fi-purple" />
                      Webhook URL
                    </Label>
                    <div className="flex gap-2">
                      <Input value={credentials.webhook_url} readOnly className="font-mono text-sm bg-card border-2 focus:border-fi-purple rounded-xl" />
                      <Button variant="outline" size="icon" onClick={() => handleCopy(credentials.webhook_url, "Webhook URL")} className="rounded-xl border-2 hover:bg-fi-purple/5 hover:border-fi-purple transition-all duration-200">
                        {copiedField === "Webhook URL" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-fi-purple" />}
                      </Button>
                    </div>
                  </motion.div>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4">Next Steps:</h3>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {[
                      "Install the Woo for Kang plugin in your WordPress admin",
                      "Navigate to WooCommerce → Settings → Payments",
                      "Enable \"Kang Open Banking\" and paste your credentials",
                      "Configure payment methods and start accepting payments!"
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-fi-purple text-white flex items-center justify-center flex-shrink-0 text-xs font-bold">{i + 1}</div>
                        <p>{text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <div className="flex gap-4 pt-6">
                  <Button
                    onClick={() => navigate("/integrations/woocommerce-docs")}
                    className="flex-1 bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl py-6 shadow-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    View Installation Guide
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                   <Button
                    variant="outline"
                    onClick={() => navigate("/merchant/woo-sync")}
                    className="flex-1 border-2 border-fi-purple text-fi-purple hover:bg-fi-purple/5 rounded-xl py-6 transition-all duration-200 hover:scale-[1.02]"
                  >
                    Manage Integration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="container relative z-10 max-w-6xl mx-auto py-16 px-4">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Link to="/woo-for-kang" className="inline-block mb-6">
            <img 
              src={wooKangLogo} 
              alt="Woo for Kang Logo" 
              className="mx-auto h-24 w-auto drop-shadow-lg hover:scale-105 transition-transform duration-200"
            />
          </Link>
          <h1 className="text-5xl font-bold mb-4 text-foreground">
            Register Your <span className="text-fi-purple">WooCommerce Store</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect your store to accept Mobile Money, Cards, and Bank Transfers in Cameroon
          </p>
        </motion.div>

        {/* Features Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
            >
              <Card className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6 text-center">
                  <feature.icon className="w-10 h-10 text-fi-purple mx-auto mb-3" strokeWidth={1.5} />
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Registration Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className="max-w-2xl mx-auto bg-card shadow-2xl rounded-2xl border-2 border-fi-purple/10">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Store className="h-6 w-6 text-fi-purple" />
                Store Details
              </CardTitle>
              <CardDescription className="text-base">
                Provide your WooCommerce store information to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="store_name" className="flex items-center gap-2 text-base font-semibold">
                    <Store className="h-4 w-4 text-fi-purple" />
                    Store Name
                  </Label>
                  <Input
                    id="store_name"
                    placeholder="My Awesome Store"
                    value={formData.store_name}
                    onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                    required
                    className="border-2 focus:border-fi-purple rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store_url" className="flex items-center gap-2 text-base font-semibold">
                    <Globe className="h-4 w-4 text-fi-purple" />
                    Store URL
                  </Label>
                  <Input
                    id="store_url"
                    type="url"
                    placeholder="https://mystore.com"
                    value={formData.store_url}
                    onChange={(e) => setFormData({ ...formData, store_url: e.target.value })}
                    required
                    className="border-2 focus:border-fi-purple rounded-xl"
                  />
                  <p className="text-sm text-muted-foreground">
                    Your WooCommerce store's full URL (e.g., https://yourstore.com)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_email" className="flex items-center gap-2 text-base font-semibold">
                    <Mail className="h-4 w-4 text-fi-purple" />
                    Admin Email
                  </Label>
                  <Input
                    id="admin_email"
                    type="email"
                    placeholder="admin@mystore.com"
                    value={formData.admin_email}
                    onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                    required
                    className="border-2 focus:border-fi-purple rounded-xl"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email for important notifications and API credentials
                  </p>
                </div>

                <Alert className="bg-fi-purple/5 border-2 border-fi-purple/20 rounded-xl">
                  <AlertDescription className="text-fi-purple">
                    <strong>What happens next:</strong> You'll receive secure API credentials to configure the Woo for Kang plugin in your WordPress admin.
                  </AlertDescription>
                </Alert>

                <Button 
                  type="submit" 
                  className="w-full bg-fi-purple hover:bg-fi-purple/90 text-white rounded-xl py-6 text-lg shadow-lg transition-all duration-200 hover:scale-[1.02]" 
                  disabled={loading}
                >
                  {loading ? "Registering Store..." : "Register Store"}
                  {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Need help with setup?
                </p>
                <Button
                  variant="link"
                  className="text-fi-purple hover:text-fi-purple/80"
                  asChild
                >
                  <Link to="/integrations/woocommerce-docs">
                    View Documentation
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
