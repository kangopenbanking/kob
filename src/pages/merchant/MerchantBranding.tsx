import { useState, useRef } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Palette, Type, Image as ImageIcon, Eye, Save, RotateCcw, Upload, X,
  Shield, ExternalLink, Code, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [branding, setBranding] = useState(defaultBranding);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

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

  const { isAdmin } = useIsAdmin();
  const isEnterprise = merchant?.plan_tier === "enterprise" || isAdmin;

  const updateField = (key: string, value: any) => {
    setBranding((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = async (file: File, field: "logo_url" | "favicon_url") => {
    if (!merchant?.id) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    const setter = field === "logo_url" ? setUploadingLogo : setUploadingFavicon;
    setter(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      // Storage RLS on `storefront-assets` requires the first folder segment to
      // equal auth.uid(); the merchant id nested inside keeps assets grouped.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to upload branding assets.");
      const path = `${user.id}/branding/${merchant.id}/${field.replace("_url", "")}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("storefront-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("storefront-assets").getPublicUrl(path);
      updateField(field, data.publicUrl);
      toast.success(`${field === "logo_url" ? "Logo" : "Favicon"} uploaded`);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Upload failed"));
    } finally {
      setter(false);
    }
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

  // Enterprise gate
  if (!isEnterprise) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Custom Branding</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customize your checkout, receipts, and payment pages
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Enterprise Feature</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Custom branding requires an Enterprise plan. Upgrade to apply your brand colors, fonts, and logo to checkout pages, receipts, and emails.
          </p>
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
            onClick={() => navigate("/biz/enterprise")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Upgrade to Enterprise
          </Button>
        </div>
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
          <Button variant="outline" size="sm" onClick={() => setBranding(defaultBranding)}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="colors"><Palette className="h-4 w-4 mr-1" /> Colors</TabsTrigger>
          <TabsTrigger value="typography"><Type className="h-4 w-4 mr-1" /> Typography</TabsTrigger>
          <TabsTrigger value="assets"><ImageIcon className="h-4 w-4 mr-1" /> Assets</TabsTrigger>
          <TabsTrigger value="advanced"><Code className="h-4 w-4 mr-1" /> Advanced</TabsTrigger>
          <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" /> Preview</TabsTrigger>
        </TabsList>

        {/* Colors Tab */}
        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Colors</CardTitle>
              <CardDescription>Define your color palette for checkout and receipts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { key: "primary_color", label: "Primary Color", desc: "Buttons, links, headings" },
                  { key: "secondary_color", label: "Secondary Color", desc: "Secondary actions, accents" },
                  { key: "accent_color", label: "Accent Color", desc: "Highlights, badges" },
                  { key: "text_color", label: "Text Color", desc: "Body text, labels" },
                  { key: "background_color", label: "Background Color", desc: "Page background" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
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

              <div className="mt-6 p-4 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-3 font-medium">Palette Preview</p>
                <div className="flex gap-2">
                  {["primary_color", "secondary_color", "accent_color", "text_color", "background_color"].map((key) => (
                    <div key={key} className="h-12 flex-1 rounded-lg border border-border" style={{ backgroundColor: (branding as any)[key] }} />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
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

        {/* Assets Tab */}
        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Brand Assets</CardTitle>
              <CardDescription>Upload logos and configure receipt content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Logo</Label>
                  {branding.logo_url ? (
                    <div className="relative w-full h-24 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden group">
                      <img src={branding.logo_url} alt="Logo" className="max-h-20 max-w-full object-contain" />
                      <button
                        onClick={() => updateField("logo_url", "")}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      {uploadingLogo ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload logo (max 2MB)</span>
                        </>
                      )}
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0], "logo_url"); e.target.value = ""; }}
                      />
                    </label>
                  )}
                  <Input
                    value={branding.logo_url}
                    onChange={(e) => updateField("logo_url", e.target.value)}
                    placeholder="Or paste URL: https://..."
                    className="text-xs"
                  />
                </div>

                {/* Favicon Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Favicon</Label>
                  {branding.favicon_url ? (
                    <div className="relative w-full h-24 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden group">
                      <img src={branding.favicon_url} alt="Favicon" className="max-h-16 max-w-full object-contain" />
                      <button
                        onClick={() => updateField("favicon_url", "")}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border/60 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                      {uploadingFavicon ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Upload favicon (max 2MB)</span>
                        </>
                      )}
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0], "favicon_url"); e.target.value = ""; }}
                      />
                    </label>
                  )}
                  <Input
                    value={branding.favicon_url}
                    onChange={(e) => updateField("favicon_url", e.target.value)}
                    placeholder="Or paste URL: https://..."
                    className="text-xs"
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

        {/* Advanced Tab (Custom CSS) */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Custom CSS</CardTitle>
              <CardDescription>
                Inject custom CSS into your checkout and payment pages for pixel-perfect branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">CSS Override</Label>
                <Textarea
                  value={branding.custom_css}
                  onChange={(e) => updateField("custom_css", e.target.value)}
                  placeholder={`.checkout-container {\n  border-radius: 16px;\n}\n\n.pay-button {\n  font-weight: 700;\n}`}
                  className="font-mono text-xs min-h-[200px] rounded-xl"
                  rows={10}
                />
                <p className="text-[10px] text-muted-foreground">
                  CSS is scoped to your branded checkout pages. Use browser DevTools to inspect available class names.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
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
                <h2 className="text-lg font-bold mb-1" style={{ color: branding.primary_color }}>
                  {branding.checkout_title || merchant?.business_name || "Checkout"}
                </h2>
                <p className="text-sm mb-6" style={{ color: branding.text_color }}>
                  Order #12345 — XAF 25,000
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

                <button className="w-full py-3 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: branding.primary_color }}>
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
