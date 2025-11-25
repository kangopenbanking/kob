import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Check, Store, Mail, Globe, Key, Lock, Webhook } from "lucide-react";

export default function WooCommerceMerchantRegister() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string>("");
  
  const [formData, setFormData] = useState({
    store_name: "",
    store_url: "",
    admin_email: "",
    plugin_version: "1.0.0"
  });

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to register your WooCommerce store",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase.functions.invoke('woocommerce-register-merchant', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`
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
      <div className="container max-w-4xl mx-auto py-12 px-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Check className="h-6 w-6" />
              Store Registered Successfully!
            </CardTitle>
            <CardDescription>
              Save these credentials securely. You'll need them to configure the plugin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertDescription className="text-yellow-800">
                ⚠️ <strong>Important:</strong> These credentials will only be shown once. Please copy and save them now.
              </AlertDescription>
            </Alert>

            {/* API Key */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={credentials.api_key} 
                  readOnly 
                  className="font-mono text-sm bg-white"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(credentials.api_key, "API Key")}
                >
                  {copiedField === "API Key" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Client Secret
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={credentials.client_secret} 
                  readOnly 
                  className="font-mono text-sm bg-white"
                  type="password"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(credentials.client_secret, "Client Secret")}
                >
                  {copiedField === "Client Secret" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhook Secret
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={credentials.webhook_secret} 
                  readOnly 
                  className="font-mono text-sm bg-white"
                  type="password"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(credentials.webhook_secret, "Webhook Secret")}
                >
                  {copiedField === "Webhook Secret" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Webhook URL
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={credentials.webhook_url} 
                  readOnly 
                  className="font-mono text-sm bg-white"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(credentials.webhook_url, "Webhook URL")}
                >
                  {copiedField === "Webhook URL" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                onClick={() => navigate("/integrations/woocommerce-docs")}
                className="flex-1"
              >
                View Installation Guide
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/admin/woocommerce-plugin")}
                className="flex-1"
              >
                Manage Integration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-6 w-6" />
            Register Your WooCommerce Store
          </CardTitle>
          <CardDescription>
            Connect your WooCommerce store to accept payments via Kang Open Banking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="store_name" className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                Store Name
              </Label>
              <Input
                id="store_name"
                placeholder="My Awesome Store"
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="store_url" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Store URL
              </Label>
              <Input
                id="store_url"
                type="url"
                placeholder="https://mystore.com"
                value={formData.store_url}
                onChange={(e) => setFormData({ ...formData, store_url: e.target.value })}
                required
              />
              <p className="text-sm text-muted-foreground">
                Your WooCommerce store's full URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Admin Email
              </Label>
              <Input
                id="admin_email"
                type="email"
                placeholder="admin@mystore.com"
                value={formData.admin_email}
                onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                required
              />
              <p className="text-sm text-muted-foreground">
                Email for important notifications and updates
              </p>
            </div>

            <Alert>
              <AlertDescription>
                After registration, you'll receive API credentials to configure the Woo for Kang plugin.
              </AlertDescription>
            </Alert>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registering..." : "Register Store"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
