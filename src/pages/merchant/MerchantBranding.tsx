import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Palette, Type, Image, Eye, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const defaultBranding = {
  primary_color: "#6366f1",
  secondary_color: "#8b5cf6",
  accent_color: "#06b6d4",
  text_color: "#1e293b",
  background_color: "#ffffff",
  font_family: "Inter",
  logo_url: "",
  favicon_url: "",
  checkout_title: "",
  receipt_footer: "",
  show_powered_by: true,
  custom_css: "",
};

const fontOptions = [
  "Inter", "DM Sans", "Space Grotesk", "IBM Plex Sans", "Outfit",
  "Manrope", "Plus Jakarta Sans", "Nunito Sans",
];

export default function MerchantBranding() {
  const queryClient = useQueryClient();
  const [branding, setBranding] = useState(defaultBranding);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: merchant, isLoading } = useQuery({
    queryKey: ["merchant-branding"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name, branding_config, plan_tier")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data?.branding_config) {
        setBranding({ ...defaultBranding, ...data.branding_config });
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant found");
      const { error } = await (supabase as any)
        .from("gateway_merchants")
        .update({ branding_config: branding, updated_at: new Date().toISOString() })
        .eq("id", merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-branding"] });
      toast.success("Branding saved successfully");
    },
    onError: () => toast.error("Failed to save branding"),
  });

  const isEnterprise = merchant?.plan_tier === "enterprise";

  const updateField = (key: string, value: any) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Custom Branding</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize your checkout, receipts, and payment pages
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEnterprise && (
            <Badge variant="secondary" className="text-xs">Enterprise Feature</Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBranding(defaultBranding)}
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colors"><Palette className="h-4 w-4 mr-1" /> Colors</TabsTrigger>
          <TabsTrigger value="typography"><Type className="h-4 w-4 mr-1" /> Typography</TabsTrigger>
          <TabsTrigger value="assets"><Image className="h-4 w-4 mr-1" /> Assets</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" /> Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Colors</CardTitle>
              <CardDescription>Define your color palette for checkout and receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { key: "primary_color", label: "Primary Color" },
                  { key: "secondary_color", label: "Secondary Color" },
                  { key: "accent_color", label: "Accent Color" },
                  { key: "text_color", label: "Text Color" },
                  { key: "background_color", label: "Background Color" },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-sm font-medium">{label}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={(branding as any)[key]}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="h-10 w-14 rounded-lg border border-border cursor-pointer"
                      />
                      <Input
                        value={(branding as any)[key]}
                        onChange={(e) => updateField(key, e.target.value)}
                        className="font-mono text-sm"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Color palette preview */}
              <div className="mt-6 p-4 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Palette Preview</p>
                <div className="flex gap-2">
                  {["primary_color", "secondary_color", "accent_color", "text_color", "background_color"].map((key) => (
                    <div
                      key={key}
                      className="h-12 flex-1 rounded-lg border border-border"
                      style={{ backgroundColor: (branding as any)[key] }}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Typography</CardTitle>
              <CardDescription>Choose fonts for your branded payment pages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Primary Font Family</Label>
                <Select value={branding.font_family} onValueChange={(v) => updateField("font_family", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fontOptions.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-6 rounded-xl border border-border" style={{ fontFamily: branding.font_family }}>
                <h3 className="text-xl font-bold mb-2" style={{ color: branding.primary_color }}>
                  Sample Heading
                </h3>
                <p className="text-sm" style={{ color: branding.text_color }}>
                  This is how your branded text will appear on checkout pages and receipts.
                </p>
                <button
                  className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Pay Now
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Assets</CardTitle>
              <CardDescription>Upload logos and configure receipt content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={branding.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input
                    value={branding.favicon_url}
                    onChange={(e) => updateField("favicon_url", e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Checkout Page Title</Label>
                <Input
                  value={branding.checkout_title}
                  onChange={(e) => updateField("checkout_title", e.target.value)}
                  placeholder="Complete Your Payment"
                />
              </div>

              <div className="space-y-2">
                <Label>Receipt Footer Text</Label>
                <Input
                  value={branding.receipt_footer}
                  onChange={(e) => updateField("receipt_footer", e.target.value)}
                  placeholder="Thank you for your purchase!"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border">
                <div>
                  <p className="text-sm font-medium">Show "Powered by KANG" badge</p>
                  <p className="text-xs text-muted-foreground">Display platform attribution on checkout</p>
                </div>
                <Switch
                  checked={branding.show_powered_by}
                  onCheckedChange={(v) => updateField("show_powered_by", v)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Live Preview</CardTitle>
              <CardDescription>See how your branding looks on a checkout page</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-xl border border-border p-8 max-w-md mx-auto"
                style={{
                  backgroundColor: branding.background_color,
                  fontFamily: branding.font_family,
                }}
              >
                {branding.logo_url && (
                  <img src={branding.logo_url} alt="Logo" className="h-8 mb-4" />
                )}
                <h2
                  className="text-lg font-bold mb-1"
                  style={{ color: branding.primary_color }}
                >
                  {branding.checkout_title || merchant?.business_name || "Checkout"}
                </h2>
                <p className="text-sm mb-6" style={{ color: branding.text_color }}>
                  Order #12345 - XAF 25,000
                </p>

                <div className="space-y-3 mb-6">
                  <div className="h-10 rounded-lg border border-border/50 px-3 flex items-center text-xs" style={{ color: branding.text_color }}>
                    Card Number
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-10 rounded-lg border border-border/50 px-3 flex items-center text-xs" style={{ color: branding.text_color }}>
                      MM/YY
                    </div>
                    <div className="h-10 rounded-lg border border-border/50 px-3 flex items-center text-xs" style={{ color: branding.text_color }}>
                      CVV
                    </div>
                  </div>
                </div>

                <button
                  className="w-full py-3 rounded-lg text-white text-sm font-semibold"
                  style={{ backgroundColor: branding.primary_color }}
                >
                  Pay XAF 25,000
                </button>

                {branding.show_powered_by && (
                  <p className="text-center text-xs mt-4" style={{ color: branding.text_color + "80" }}>
                    Powered by KANG
                  </p>
                )}

                {branding.receipt_footer && (
                  <p className="text-center text-xs mt-2" style={{ color: branding.text_color + "60" }}>
                    {branding.receipt_footer}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
