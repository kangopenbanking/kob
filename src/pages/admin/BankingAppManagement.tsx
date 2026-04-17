import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Smartphone, Users, CreditCard, ArrowRightLeft, PiggyBank, Landmark,
  Search, Loader2, Building2, Wallet, Settings2, GripVertical, ArrowUp, ArrowDown,
  Eye, Send, QrCode, ArrowDownLeft, ChevronRight, BarChart3, Monitor,
  Plus, Trash2, Image, Video, BookOpen, Palette, Shield, UserCheck, Phone,
  Calendar, Type
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { toast } from "sonner";
import { detectProvider, type MediaSection } from "@/components/pwa/MediaBanner";
import type { SectionStyle, SectionStyles, CardSize, WalkthroughConfig, HomeSectionKey, LayoutStyle, CardColors, CardColorOverride } from "@/components/pwa/TenantProvider";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

// ─── Types ───
interface AppConfig {
  features: {
    cards: boolean;
    savings: boolean;
    loans: boolean;
    credit_score: boolean;
    mobile_money: boolean;
    qr_payments: boolean;
    bill_payments: boolean;
  };
  home_layout: {
    show_balance_card: boolean;
    show_account_carousel: boolean;
    show_financial_services: boolean;
    show_recent_transactions: boolean;
  };
  section_order: HomeSectionKey[];
  layout_style: LayoutStyle;
  section_styles: SectionStyles;
  media_sections: MediaSection[];
  walkthrough_config: WalkthroughConfig;
  card_colors: CardColors;
  support_phone: string;
  support_email: string;
  font_size_multiplier: number;
}

const defaultSectionOrder: HomeSectionKey[] = [
  'balance_card', 'account_carousel', 'quick_actions', 'financial_services', 'media_banner', 'recent_transactions',
];

const defaultAppConfig: AppConfig = {
  features: { cards: true, savings: true, loans: true, credit_score: true, mobile_money: true, qr_payments: true, bill_payments: true },
  home_layout: { show_balance_card: true, show_account_carousel: true, show_financial_services: true, show_recent_transactions: true },
  section_order: defaultSectionOrder,
  layout_style: 'modern',
  section_styles: {},
  media_sections: [],
  walkthrough_config: { skip_enabled: true },
  card_colors: {},
  support_phone: '',
  support_email: '',
  font_size_multiplier: 0.7,
};

// ─── Hooks ───
function useInstitutions() {
  return useQuery({
    queryKey: ["admin-institutions-banking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, institution_name, institution_type, status, logo_url, primary_color, created_at, app_config")
        .order("institution_name");
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionAccounts(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-accounts", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*, account_balances(*)")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionTransactions(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-transactions", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("accounts").select("id").eq("institution_id", institutionId!);
      const accountIds = (accounts || []).map((a) => a.id);
      if (accountIds.length === 0) return [];
      const { data, error } = await supabase.from("transactions").select("*").in("account_id", accountIds).order("created_at", { ascending: false }).limit(100) as any;
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionSavings(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-savings", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("savings_accounts").select("*").eq("institution_id", institutionId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionLoans(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-loans", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("loan_applications").select("*, loan_product:loan_products(*)").eq("institution_id", institutionId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionFunding(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-funding", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funding_intents")
        .select("*")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionCustomers(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-customers", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("accounts").select("user_id").eq("institution_id", institutionId!);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name, created_at").in("id", userIds);
      const { data: kycs } = await supabase.from("kyc_verifications").select("user_id, status, verification_type, created_at").in("user_id", userIds).order("created_at", { ascending: false });
      const kycMap: Record<string, any> = {};
      (kycs || []).forEach(k => { if (!kycMap[k.user_id]) kycMap[k.user_id] = k; });
      const accountCounts: Record<string, number> = {};
      (accounts || []).forEach(a => { accountCounts[a.user_id] = (accountCounts[a.user_id] || 0) + 1; });
      return (profiles || []).map(p => ({
        ...p,
        kyc_status: kycMap[p.id]?.status || 'none',
        account_count: accountCounts[p.id] || 0,
      }));
    },
  });
}

function useInstitutionCards(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-cards", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("accounts").select("user_id").eq("institution_id", institutionId!);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];
      if (userIds.length === 0) return [];
      const { data, error } = await supabase.from("virtual_cards").select("*").in("user_id", userIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionCreditScores(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-inst-credit-scores", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: accounts } = await supabase.from("accounts").select("user_id").eq("institution_id", institutionId!);
      const userIds = [...new Set((accounts || []).map(a => a.user_id))];
      if (userIds.length === 0) return [];
      const { data, error } = await supabase.from("credit_scores").select("*").in("user_id", userIds).order("calculated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}


function useWalkthroughSlides(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-walkthrough-slides", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_walkthroughs")
        .select("*")
        .eq("institution_id", institutionId!)
        .order("slide_order");
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Stat Card ───
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Style Editor ───
function SectionStyleEditor({ sectionKey, style, onChange }: { sectionKey: string; style: SectionStyle; onChange: (s: SectionStyle) => void }) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-semibold capitalize">{sectionKey.replace(/_/g, ' ')}</p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Card Size</Label>
          <Select value={style.card_size || 'medium'} onValueChange={(v) => onChange({ ...style, card_size: v as CardSize })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(sectionKey === 'quick_actions' || sectionKey === 'financial_services') && (
          <div>
            <Label className="text-xs">Columns</Label>
            <Select value={String(style.columns || 'auto')} onValueChange={(v) => onChange({ ...style, columns: v === 'auto' ? undefined : Number(v) })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {sectionKey === 'quick_actions' && (
          <div>
            <Label className="text-xs">Icon Style</Label>
            <Select value={style.icon_style || 'rounded'} onValueChange={(v) => onChange({ ...style, icon_style: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Background Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={style.bg_color || '#ffffff'} onChange={(e) => onChange({ ...style, bg_color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border" />
            {style.bg_color && <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onChange({ ...style, bg_color: undefined })}>Clear</Button>}
          </div>
        </div>
        <div>
          <Label className="text-xs">Text Color</Label>
          <div className="flex items-center gap-2">
            <input type="color" value={style.text_color || '#000000'} onChange={(e) => onChange({ ...style, text_color: e.target.value })} className="h-8 w-8 cursor-pointer rounded border" />
            {style.text_color && <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => onChange({ ...style, text_color: undefined })}>Clear</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card Color Editor ───
const CARD_COLOR_KEYS = {
  quick_actions: [
    { key: 'quick_action_send', label: 'Send' },
    { key: 'quick_action_receive', label: 'Receive' },
    { key: 'quick_action_momo', label: 'MoMo' },
    { key: 'quick_action_qr pay', label: 'QR Pay' },
  ],
  financial_services: [
    { key: 'financial_savings', label: 'Savings' },
    { key: 'financial_loans', label: 'Loans' },
    { key: 'financial_credit', label: 'Credit Score' },
  ],
  account_carousel: [
    { key: 'account_XAF', label: 'XAF Account' },
    { key: 'account_EUR', label: 'EUR Account' },
    { key: 'account_USD', label: 'USD Account' },
    { key: 'account_GBP', label: 'GBP Account' },
  ],
};

function CardColorEditor({ cardColors, onChange }: { cardColors: CardColors; onChange: (c: CardColors) => void }) {
  const updateCard = (key: string, field: 'bg_color' | 'text_color', value: string | undefined) => {
    const existing = cardColors[key] || {};
    const updated = { ...existing, [field]: value };
    if (!updated.bg_color && !updated.text_color) {
      const { [key]: _, ...rest } = cardColors;
      onChange(rest);
    } else {
      onChange({ ...cardColors, [key]: updated });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Card Colors</CardTitle>
        <CardDescription>Set individual background and text colors for each card</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(CARD_COLOR_KEYS).map(([section, cards]) => (
          <div key={section} className="space-y-2">
            <p className="text-sm font-semibold capitalize">{section.replace(/_/g, ' ')}</p>
            <div className="grid gap-2">
              {cards.map(({ key, label }) => {
                const override = cardColors[key] || {};
                return (
                  <div key={key} className="flex items-center gap-3 rounded-lg border p-2">
                    <span className="text-xs font-medium flex-1 min-w-[80px]">{label}</span>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px]">BG</Label>
                      <input type="color" value={override.bg_color || '#ffffff'} onChange={(e) => updateCard(key, 'bg_color', e.target.value)} className="h-6 w-6 cursor-pointer rounded border" />
                      {override.bg_color && <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => updateCard(key, 'bg_color', undefined)}>✕</Button>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px]">Text</Label>
                      <input type="color" value={override.text_color || '#000000'} onChange={(e) => updateCard(key, 'text_color', e.target.value)} className="h-6 w-6 cursor-pointer rounded border" />
                      {override.text_color && <Button variant="ghost" size="sm" className="h-5 px-1 text-[9px]" onClick={() => updateCard(key, 'text_color', undefined)}>✕</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Media Section Manager ───
function MediaSectionManager({ mediaSections, onChange, onAutoAddToOrder }: { mediaSections: MediaSection[]; onChange: (s: MediaSection[]) => void; onAutoAddToOrder?: () => void }) {
  const [uploading, setUploading] = useState(false);

  const addMedia = (type: 'image' | 'video') => {
    const newItem: MediaSection = {
      id: crypto.randomUUID(),
      type,
      url: '',
      provider: type === 'video' ? 'youtube' : undefined,
      video_id: '',
      title: '',
      position: mediaSections.length,
      aspect: 'landscape',
    };
    onChange([...mediaSections, newItem]);
    onAutoAddToOrder?.();
  };

  const updateItem = (id: string, updates: Partial<MediaSection>) => {
    onChange(mediaSections.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const removeItem = (id: string) => onChange(mediaSections.filter(m => m.id !== id));

  const handleVideoUrl = (id: string, url: string) => {
    const { provider, video_id } = detectProvider(url);
    updateItem(id, { url, provider, video_id });
  };

  const handleImageUpload = async (id: string, file: File) => {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in.'); setUploading(false); return; }
    const path = `${user.id}/media/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('pwa-media').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('pwa-media').getPublicUrl(path);
    updateItem(id, { url: publicUrl });
    setUploading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" /> Media Banners</CardTitle>
        <CardDescription>Add image slides or embedded videos to the home screen. Supports multiple banners in a slide carousel.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mediaSections.map((item, idx) => (
          <div key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(item.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
            <Input placeholder="Title (optional)" value={item.title || ''} onChange={(e) => updateItem(item.id, { title: e.target.value })} className="h-8 text-xs" />
            
            {/* Aspect Ratio Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Dimension:</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={(!item.aspect || item.aspect === 'landscape') ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={() => updateItem(item.id, { aspect: 'landscape' })}
                >
                  <span className="inline-block w-4 h-2.5 border rounded-sm border-current" /> Landscape
                </Button>
                <Button
                  type="button"
                  variant={item.aspect === 'portrait' ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs gap-1 px-2"
                  onClick={() => updateItem(item.id, { aspect: 'portrait' })}
                >
                  <span className="inline-block w-2.5 h-4 border rounded-sm border-current" /> Portrait
                </Button>
              </div>
            </div>

            {item.type === 'image' ? (
              <div className="space-y-2">
                <Input placeholder="Image URL" value={item.url} onChange={(e) => updateItem(item.id, { url: e.target.value })} className="h-8 text-xs" />
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Or upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(item.id, e.target.files[0])} />
                </label>
                {item.url && <img src={item.url} alt="" className={`w-full rounded object-cover ${item.aspect === 'portrait' ? 'h-40' : 'h-20'}`} />}
              </div>
            ) : (
              <div className="space-y-2">
                <Input placeholder="Video URL (YouTube, Vimeo, Facebook, X, Instagram, LinkedIn)" value={item.url} onChange={(e) => handleVideoUrl(item.id, e.target.value)} className="h-8 text-xs" />
                {item.provider && <Badge variant="secondary" className="text-[10px]">{item.provider}</Badge>}
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Video className="h-3.5 w-3.5" /> Upload custom video
                  <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) { toast.error('Please sign in.'); setUploading(false); return; }
                    const path = `${user.id}/video/${Date.now()}_${file.name}`;
                    const { error } = await supabase.storage.from('pwa-media').upload(path, file);
                    if (error) { toast.error('Upload failed'); setUploading(false); return; }
                    const { data: { publicUrl } } = supabase.storage.from('pwa-media').getPublicUrl(path);
                    updateItem(item.id, { url: publicUrl, provider: 'custom' });
                    setUploading(false);
                  }} />
                </label>
              </div>
            )}
          </div>
        ))}
        {mediaSections.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {mediaSections.length} banner{mediaSections.length > 1 ? 's' : ''} configured — users can swipe between them on the home screen.
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addMedia('image')} className="gap-1"><Image className="h-3.5 w-3.5" /> Add Image</Button>
          <Button variant="outline" size="sm" onClick={() => addMedia('video')} className="gap-1"><Video className="h-3.5 w-3.5" /> Add Video</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Walkthrough Manager ───
function WalkthroughManager({ institutionId, walkthroughConfig, onConfigChange }: {
  institutionId: string;
  walkthroughConfig: WalkthroughConfig;
  onConfigChange: (c: WalkthroughConfig) => void;
}) {
  const queryClient = useQueryClient();
  const { data: slides = [], isLoading } = useWalkthroughSlides(institutionId);
  const [editSlide, setEditSlide] = useState<any>(null);

  const saveSlideMutation = useMutation({
    mutationFn: async (slide: any) => {
      if (slide.id && !slide.isNew) {
        const { error } = await supabase.from('institution_walkthroughs').update({
          title: slide.title,
          description: slide.description,
          media_type: slide.media_type,
          media_url: slide.media_url,
          icon_name: slide.icon_name,
          bg_color: slide.bg_color,
          text_color: slide.text_color,
          slide_order: slide.slide_order,
        }).eq('id', slide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('institution_walkthroughs').insert({
          institution_id: institutionId,
          title: slide.title,
          description: slide.description,
          media_type: slide.media_type || 'icon',
          media_url: slide.media_url,
          icon_name: slide.icon_name || 'Shield',
          bg_color: slide.bg_color,
          text_color: slide.text_color,
          slide_order: slide.slide_order || slides.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-walkthrough-slides", institutionId] });
      setEditSlide(null);
      toast.success("Slide saved");
    },
    onError: () => toast.error("Failed to save slide"),
  });

  const deleteSlideMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('institution_walkthroughs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-walkthrough-slides", institutionId] });
      toast.success("Slide deleted");
    },
  });

  const [uploading, setUploading] = useState(false);

  return (
    <div className="space-y-6">
      {/* Global Walkthrough Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Walkthrough Theme</CardTitle>
          <CardDescription>Customize colors and branding for the walkthrough screens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Background Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.bg_color || '#ffffff'} onChange={(e) => onConfigChange({ ...walkthroughConfig, bg_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                <span className="text-xs text-muted-foreground">{walkthroughConfig.bg_color || 'Default'}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.text_color || '#000000'} onChange={(e) => onConfigChange({ ...walkthroughConfig, text_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                <span className="text-xs text-muted-foreground">{walkthroughConfig.text_color || 'Default'}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">Accent Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.accent_color || '#3b82f6'} onChange={(e) => onConfigChange({ ...walkthroughConfig, accent_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                <span className="text-xs text-muted-foreground">{walkthroughConfig.accent_color || 'Default'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs">Logo Override URL</Label>
              <Input value={walkthroughConfig.logo_url || ''} onChange={(e) => onConfigChange({ ...walkthroughConfig, logo_url: e.target.value || null })} placeholder="https://..." className="h-8 text-xs mt-1" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch checked={walkthroughConfig.skip_enabled !== false} onCheckedChange={(v) => onConfigChange({ ...walkthroughConfig, skip_enabled: v })} />
              <Label className="text-xs">Allow Skip</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Slides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> Walkthrough Slides</CardTitle>
          <CardDescription>Manage onboarding slides for this institution</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : slides.length === 0 && !editSlide ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom slides — default walkthrough will be shown</p>
          ) : (
            slides.map((slide: any, idx: number) => (
              <div key={slide.id} className="flex items-center gap-3 rounded-lg border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{slide.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{slide.description}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{slide.media_type}</Badge>
                    {slide.icon_name && <Badge variant="secondary" className="text-[10px]">{slide.icon_name}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditSlide(slide)}>Edit</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSlideMutation.mutate(slide.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}

          {editSlide ? (
            <div className="rounded-lg border-2 border-primary/20 p-4 space-y-3">
              <p className="text-sm font-bold">{editSlide.isNew ? 'New Slide' : 'Edit Slide'}</p>
              <Input placeholder="Title" value={editSlide.title || ''} onChange={(e) => setEditSlide({ ...editSlide, title: e.target.value })} />
              <Textarea placeholder="Description" value={editSlide.description || ''} onChange={(e) => setEditSlide({ ...editSlide, description: e.target.value })} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Media Type</Label>
                  <Select value={editSlide.media_type || 'icon'} onValueChange={(v) => setEditSlide({ ...editSlide, media_type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="icon">Icon</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editSlide.media_type === 'icon' && (
                  <div>
                    <Label className="text-xs">Icon Name (Lucide)</Label>
                    <Input value={editSlide.icon_name || 'Shield'} onChange={(e) => setEditSlide({ ...editSlide, icon_name: e.target.value })} className="h-8 text-xs" placeholder="Shield, CreditCard, etc." />
                  </div>
                )}
                {(editSlide.media_type === 'image' || editSlide.media_type === 'video') && (
                  <div>
                    <Label className="text-xs">Media URL</Label>
                    <Input value={editSlide.media_url || ''} onChange={(e) => setEditSlide({ ...editSlide, media_url: e.target.value })} className="h-8 text-xs" />
                  </div>
                )}
              </div>
              {(editSlide.media_type === 'image') && (
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Upload image'}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const path = `walkthrough/${Date.now()}_${file.name}`;
                    const { error } = await supabase.storage.from('pwa-media').upload(path, file);
                    if (error) { toast.error('Upload failed'); setUploading(false); return; }
                    const { data: { publicUrl } } = supabase.storage.from('pwa-media').getPublicUrl(path);
                    setEditSlide((prev: any) => ({ ...prev, media_url: publicUrl }));
                    setUploading(false);
                  }} />
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Slide BG Color</Label>
                  <input type="color" value={editSlide.bg_color || '#ffffff'} onChange={(e) => setEditSlide({ ...editSlide, bg_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                </div>
                <div>
                  <Label className="text-xs">Slide Text Color</Label>
                  <input type="color" value={editSlide.text_color || '#000000'} onChange={(e) => setEditSlide({ ...editSlide, text_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveSlideMutation.mutate(editSlide)} disabled={saveSlideMutation.isPending}>
                  {saveSlideMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditSlide(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditSlide({ isNew: true, title: '', description: '', media_type: 'icon', icon_name: 'Shield', slide_order: slides.length })}>
              <Plus className="h-3.5 w-3.5" /> Add Slide
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Feature Config Panel ───
function FeatureConfigPanel({ institutionId, appConfig }: { institutionId: string; appConfig: AppConfig }) {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AppConfig>(appConfig);

  const mutation = useMutation({
    mutationFn: async (newConfig: AppConfig) => {
      const { error } = await (supabase as any).from("institutions").update({ app_config: newConfig }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-banking"] });
      toast.success("Feature configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  const toggleFeature = (key: keyof AppConfig["features"]) => {
    setConfig(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  };

  const toggleLayout = (key: keyof AppConfig["home_layout"]) => {
    setConfig(prev => ({ ...prev, home_layout: { ...prev.home_layout, [key]: !prev.home_layout[key] } }));
  };

  const featureLabels: Record<string, string> = {
    cards: "Virtual Cards", savings: "Savings Goals", loans: "Loan Applications",
    credit_score: "Credit Score (CrediQ)", mobile_money: "Mobile Money (MoMo)",
    qr_payments: "QR Payments", bill_payments: "Bill Payments",
  };

  const layoutLabels: Record<string, string> = {
    show_balance_card: "Balance Card", show_account_carousel: "Account Carousel",
    show_financial_services: "Financial Services Grid", show_recent_transactions: "Recent Transactions",
  };

  const sectionLabels: Record<HomeSectionKey, string> = {
    balance_card: 'Balance Card', account_carousel: 'Account Carousel', quick_actions: 'Quick Actions',
    financial_services: 'Financial Services', recent_transactions: 'Recent Transactions', media_banner: 'Media Banner',
  };

  const sectionOrder = config.section_order || defaultSectionOrder;
  const hasMediaBanner = sectionOrder.includes('media_banner');

  // Preview mockup helpers
  const getPreviewSectionStyle = (key: HomeSectionKey): React.CSSProperties => {
    const s = (config.section_styles || {})[key] || {};
    const styles: React.CSSProperties = {};
    if (s.bg_color) styles.backgroundColor = s.bg_color;
    if (s.text_color) styles.color = s.text_color;
    return styles;
  };

  const getPreviewSizeClass = (key: HomeSectionKey) => {
    const s = (config.section_styles || {})[key] || {};
    const size = s.card_size || 'medium';
    return { small: 'p-1', medium: 'p-2', large: 'p-3' }[size];
  };

  const getPreviewIconShape = () => {
    const s = (config.section_styles || {})['quick_actions'] || {};
    const shape = s.icon_style || 'rounded';
    return { rounded: 'rounded-md', circle: 'rounded-full', square: 'rounded-sm' }[shape];
  };

  const getPreviewCols = (key: HomeSectionKey, fallback: number) => {
    const s = (config.section_styles || {})[key] || {};
    return s.columns || fallback;
  };

  const renderPreviewSection = (key: HomeSectionKey) => {
    const style = config.layout_style || 'modern';
    const sectionStyle = getPreviewSectionStyle(key);
    const padClass = getPreviewSizeClass(key);

    switch (key) {
      case 'balance_card': {
        if (!config.home_layout.show_balance_card) return null;
        const balanceText = <><p className="text-[7px]" style={{ opacity: 0.7 }}>Total Balance</p><p className="text-[10px] font-bold">XAF 1,250,000</p></>;
        if (style === 'minimal') return <div key={key} className={`py-1 ${padClass}`} style={sectionStyle}><p className="text-[8px] uppercase tracking-wider text-muted-foreground">Total Balance</p><p className="text-sm font-light">XAF 1,250,000</p></div>;
        if (style === 'classic') return <div key={key} className={`rounded border bg-card ${padClass}`} style={sectionStyle}>{balanceText}</div>;
        if (style === 'bold') return <div key={key} className={`rounded-xl bg-primary ${padClass} shadow-md`} style={sectionStyle}><p className="text-[7px] font-semibold text-primary-foreground/70">Total Balance</p><p className="text-[10px] font-black text-primary-foreground">XAF 1,250,000</p></div>;
        if (style === 'gradient') return <div key={key} className={`rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent ${padClass}`} style={sectionStyle}><p className="text-[7px] text-primary-foreground/70">Total Balance</p><p className="text-[10px] font-bold text-primary-foreground">XAF 1,250,000</p></div>;
        return <div key={key} className={`rounded-lg bg-foreground ${padClass}`} style={sectionStyle}><p className="text-[7px] text-background/60">Total Balance</p><p className="text-[10px] font-bold text-background">XAF 1,250,000</p></div>;
      }
      case 'account_carousel': {
        if (!config.home_layout.show_account_carousel) return null;
        const cardSize = (config.section_styles?.account_carousel?.card_size) || 'medium';
        const cardW = { small: 'w-14', medium: 'w-16', large: 'w-20' }[cardSize];
        const cardH = { small: 'h-6', medium: 'h-8', large: 'h-10' }[cardSize];
        return (
          <div key={key} className="flex gap-1" style={sectionStyle}>
            <div className={`${cardH} ${cardW} rounded-md bg-[hsl(var(--chart-3))] p-1`}><p className="text-[6px] text-white">XAF</p><p className="text-[7px] font-bold text-white">1.2M</p></div>
            <div className={`${cardH} ${cardW} rounded-md bg-[hsl(var(--chart-4))] p-1`}><p className="text-[6px] text-white">EUR</p><p className="text-[7px] font-bold text-white">500</p></div>
          </div>
        );
      }
      case 'quick_actions': {
        const qaLabels = ['Send', 'Recv', 'QR', config.features.mobile_money && 'MoMo'].filter(Boolean) as string[];
        const cols = getPreviewCols('quick_actions', qaLabels.length);
        const iconShape = getPreviewIconShape();

        if (style === 'classic' || cols <= 3) {
          return (
            <div key={key} className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, 1fr)`, ...sectionStyle }}>
              {qaLabels.map(a => (
                <div key={a} className="flex items-center gap-1 rounded border bg-card p-1">
                  <div className={`h-4 w-4 ${iconShape} bg-primary`} />
                  <span className="text-[5px] font-semibold">{a}</span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={key} className="flex justify-between" style={sectionStyle}>
            {qaLabels.map(a => (
              <div key={a} className="flex flex-col items-center gap-0.5">
                <div className={`h-5 w-5 ${iconShape} bg-primary`} />
                <span className="text-[5px]">{a}</span>
              </div>
            ))}
          </div>
        );
      }
      case 'financial_services': {
        if (!config.home_layout.show_financial_services) return null;
        const services = [config.features.savings && 'Savings', config.features.loans && 'Loans', config.features.credit_score && 'Score'].filter(Boolean);
        if (services.length === 0) return null;
        const cols = getPreviewCols('financial_services', services.length);
        const fsPad = getPreviewSizeClass('financial_services');
        return (
          <div key={key} style={sectionStyle}>
            <p className="text-[7px] font-bold mb-0.5">Financial Services</p>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {services.map(s => (
                <div key={s} className={`rounded-md bg-accent ${fsPad} text-center`}>
                  <p className="text-[6px] font-bold">0</p>
                  <p className="text-[5px]">{s}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'recent_transactions': {
        if (!config.home_layout.show_recent_transactions) return null;
        return (
          <div key={key} style={sectionStyle}>
            <p className="text-[7px] font-bold mb-0.5">Recent Transactions</p>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-muted" />
                  <div><p className="text-[6px]">Payment</p><p className="text-[5px] text-muted-foreground">Today</p></div>
                </div>
                <span className="text-[6px] font-bold">-5,000</span>
              </div>
            ))}
          </div>
        );
      }
      case 'media_banner': {
        const media = config.media_sections || [];
        if (media.length === 0) {
          return (
            <div key={key} className="h-10 rounded-md bg-gradient-to-r from-primary/20 to-accent/20 flex items-center justify-center border border-dashed border-primary/30">
              <p className="text-[7px] text-muted-foreground">📸 Media Banner — Add banners below to display here</p>
            </div>
          );
        }
        const firstMedia = media[0];
        const bannerSize = (config.section_styles?.media_banner?.card_size) || 'medium';
        const isPortrait = firstMedia.aspect === 'portrait';
        const landscapeH = { small: 'h-6', medium: 'h-10', large: 'h-14' }[bannerSize];
        const portraitH = { small: 'h-14', medium: 'h-20', large: 'h-28' }[bannerSize];
        const bannerH = isPortrait ? portraitH : landscapeH;
        return (
          <div key={key} className={`${bannerH} rounded-md overflow-hidden relative`}>
            {firstMedia.type === 'image' && firstMedia.url ? (
              <img src={firstMedia.url} alt={firstMedia.title || ''} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-primary/30 to-accent/30 flex items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary/40 flex items-center justify-center">
                    <div className="h-0 w-0 border-l-[3px] border-l-white border-y-[2px] border-y-transparent ml-0.5" />
                  </div>
                  <p className="text-[5px] text-muted-foreground mt-0.5">{firstMedia.provider || 'Video'}</p>
                </div>
              </div>
            )}
            {firstMedia.title && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-1 py-0.5">
                <p className="text-[5px] text-white truncate">{firstMedia.title}</p>
              </div>
            )}
            {media.length > 1 && (
              <div className="absolute top-0.5 right-1 bg-black/50 rounded px-0.5">
                <p className="text-[5px] text-white">1/{media.length}</p>
              </div>
            )}
          </div>
        );
      }
      default: return null;
    }
  };

  // Walkthrough preview
  const renderWalkthroughPreview = () => {
    const wc = config.walkthrough_config || {};
    return (
      <div className="mt-2">
        <p className="text-[7px] font-bold mb-1 text-muted-foreground">Walkthrough Preview</p>
        <div className="rounded-lg border p-2 space-y-1" style={{ backgroundColor: wc.bg_color || undefined }}>
          {wc.logo_url && <img src={wc.logo_url} alt="" className="h-5 w-5 rounded mx-auto" />}
          <div className="h-6 w-6 mx-auto rounded-lg flex items-center justify-center" style={{ backgroundColor: wc.accent_color || 'hsl(var(--primary))' }}>
            <div className="h-3 w-3 rounded bg-white/20" />
          </div>
          <p className="text-[7px] font-bold text-center" style={{ color: wc.text_color || undefined }}>Welcome</p>
          <p className="text-[5px] text-center" style={{ color: wc.text_color || undefined, opacity: 0.6 }}>Onboarding slide</p>
          <div className="flex justify-center gap-0.5 pt-0.5">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-1 rounded-full ${i === 0 ? 'w-2' : 'w-1'}`} style={{ backgroundColor: wc.accent_color || 'hsl(var(--primary))', opacity: i === 0 ? 1 : 0.3 }} />
            ))}
          </div>
          {wc.skip_enabled !== false && <p className="text-[5px] text-center text-muted-foreground">Skip →</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        {/* Features */}
        <Card>
          <CardHeader><CardTitle className="text-base">App Features</CardTitle><CardDescription>Toggle which features are available</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(featureLabels).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`feat-${key}`} className="text-sm font-medium">{label}</Label>
                <Switch id={`feat-${key}`} checked={config.features[key as keyof AppConfig["features"]]} onCheckedChange={() => toggleFeature(key as keyof AppConfig["features"])} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Layout Style */}
        <Card>
          <CardHeader><CardTitle className="text-base">Layout Style</CardTitle><CardDescription>Choose a visual theme</CardDescription></CardHeader>
          <CardContent>
            <RadioGroup value={config.layout_style || 'modern'} onValueChange={(v) => setConfig(prev => ({ ...prev, layout_style: v as LayoutStyle }))} className="grid grid-cols-5 gap-2">
              {([
                { value: 'modern', label: 'Modern', desc: 'Bold dark hero' },
                { value: 'classic', label: 'Classic', desc: 'Clean borders' },
                { value: 'minimal', label: 'Minimal', desc: 'Typography-first' },
                { value: 'bold', label: 'Bold', desc: 'Large colorful' },
                { value: 'gradient', label: 'Gradient', desc: 'Gradient cards' },
              ] as const).map(style => (
                <label key={style.value} className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${config.layout_style === style.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                  <RadioGroupItem value={style.value} className="sr-only" />
                  <p className="text-xs font-bold">{style.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{style.desc}</p>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Home Layout */}
        <Card>
          <CardHeader><CardTitle className="text-base">Home Screen Layout</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(layoutLabels).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label className="text-sm font-medium">{label}</Label>
                <Switch checked={config.home_layout[key as keyof AppConfig["home_layout"]]} onCheckedChange={() => toggleLayout(key as keyof AppConfig["home_layout"])} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Section Order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Home Section Order</CardTitle>
            {!hasMediaBanner && (
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setConfig(prev => ({ ...prev, section_order: [...(prev.section_order || defaultSectionOrder), 'media_banner'] }))}>
                <Plus className="h-3.5 w-3.5" /> Add Media Banner
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {sectionOrder.map((key, idx) => (
              <div key={key} className="flex items-center gap-2 rounded-lg border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-sm font-medium">{sectionLabels[key] || key}</span>
                {key === 'media_banner' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfig(prev => ({ ...prev, section_order: prev.section_order.filter(k => k !== 'media_banner') }))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0}
                  onClick={() => {
                    const order = [...sectionOrder];
                    [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
                    setConfig(prev => ({ ...prev, section_order: order }));
                  }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === sectionOrder.length - 1}
                  onClick={() => {
                    const order = [...sectionOrder];
                    [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
                    setConfig(prev => ({ ...prev, section_order: order }));
                  }}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Per-Section Styles */}
        <Card>
          <CardHeader><CardTitle className="text-base">Section Styles</CardTitle><CardDescription>Customize card sizes, colors, and columns per section</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {['balance_card', 'account_carousel', 'quick_actions', 'financial_services', 'media_banner'].filter(k => sectionOrder.includes(k as HomeSectionKey)).map(key => (
              <SectionStyleEditor
                key={key}
                sectionKey={key}
                style={(config.section_styles || {})[key as HomeSectionKey] || {}}
                onChange={(s) => setConfig(prev => ({ ...prev, section_styles: { ...(prev.section_styles || {}), [key]: s } }))}
              />
            ))}
          </CardContent>
        </Card>

        {/* Support Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> Support Contact</CardTitle>
            <CardDescription>Phone number and email shown on the Help & Support page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Support Phone Number</Label>
              <Input
                placeholder="+237 233 000 000"
                value={config.support_phone || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, support_phone: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Support Email</Label>
              <Input
                placeholder="support@yourbank.com"
                value={config.support_email || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, support_email: e.target.value }))}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card Colors */}
        <CardColorEditor
          cardColors={config.card_colors || {}}
          onChange={(c) => setConfig(prev => ({ ...prev, card_colors: c }))}
        />

        {/* Media Sections */}
        <MediaSectionManager
          mediaSections={config.media_sections || []}
          onChange={(s) => setConfig(prev => ({ ...prev, media_sections: s }))}
          onAutoAddToOrder={() => {
            setConfig(prev => {
              const order = prev.section_order || defaultSectionOrder;
              if (order.includes('media_banner')) return prev;
              const txIdx = order.indexOf('recent_transactions');
              const newOrder = [...order];
              newOrder.splice(txIdx >= 0 ? txIdx : newOrder.length, 0, 'media_banner');
              return { ...prev, section_order: newOrder };
            });
          }}
        />

        <Button onClick={() => mutation.mutate(config)} disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Configuration
        </Button>
      </div>

      {/* Live Preview */}
      <div className="xl:col-span-1">
        <div className="sticky top-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Live Preview</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Style: <Badge variant="outline" className="text-[9px] ml-1 capitalize">{config.layout_style || 'modern'}</Badge>
              </p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="w-[200px] rounded-[24px] border-2 border-foreground/20 bg-background p-2.5 shadow-xl">
                {/* Status bar */}
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="text-[6px] font-semibold text-muted-foreground">9:41</span>
                  <div className="h-3 w-12 rounded-full bg-foreground/80 mx-auto" />
                  <div className="flex gap-0.5">
                    <div className="h-1.5 w-2.5 rounded-sm bg-muted-foreground/40" />
                    <div className="h-1.5 w-2.5 rounded-sm bg-muted-foreground/40" />
                  </div>
                </div>
                {/* Content */}
                <div className="flex flex-col gap-2 px-1 min-h-[260px]">
                  <p className="text-[8px] font-medium text-muted-foreground">Good afternoon</p>
                  {sectionOrder.map(key => renderPreviewSection(key))}
                </div>
                {/* Bottom nav */}
                <div className="mt-2 flex justify-between border-t pt-1.5 px-2">
                  {['Home', 'Pay', config.features.cards && 'Cards', 'History', 'More'].filter(Boolean).map((t, i) => (
                    <div key={t as string} className="flex flex-col items-center gap-0.5">
                      <div className={`h-2.5 w-2.5 rounded-sm ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      <span className={`text-[5px] ${i === 0 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{t}</span>
                    </div>
                  ))}
                </div>
                {/* Home indicator */}
                <div className="mt-1 mx-auto h-0.5 w-8 rounded-full bg-foreground/20" />
              </div>
            </CardContent>
          </Card>

          {/* Walkthrough Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-3.5 w-3.5" /> Walkthrough Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <div className="w-[200px] rounded-[24px] border-2 border-foreground/20 shadow-xl overflow-hidden">
                {(() => {
                  const wc = config.walkthrough_config || {};
                  return (
                    <div className="p-4 flex flex-col items-center gap-2 min-h-[160px] justify-center" style={{ backgroundColor: wc.bg_color || undefined }}>
                      {(wc.logo_url) ? (
                        <img src={wc.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: wc.accent_color || 'hsl(var(--primary))' }}>
                          <Building2 className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: wc.accent_color ? `${wc.accent_color}22` : 'hsl(var(--primary) / 0.1)' }}>
                        <div className="h-5 w-5 rounded-lg" style={{ backgroundColor: wc.accent_color || 'hsl(var(--primary))' }} />
                      </div>
                      <p className="text-[9px] font-bold text-center" style={{ color: wc.text_color || undefined }}>Welcome to Banking</p>
                      <p className="text-[7px] text-center opacity-60" style={{ color: wc.text_color || undefined }}>Manage your finances securely</p>
                      <div className="flex gap-1 mt-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className={`h-1 rounded-full ${i === 0 ? 'w-3' : 'w-1'}`} style={{ backgroundColor: wc.accent_color || 'hsl(var(--primary))', opacity: i === 0 ? 1 : 0.3 }} />
                        ))}
                      </div>
                      {wc.skip_enabled !== false && (
                        <p className="text-[6px] mt-1" style={{ color: wc.accent_color || 'hsl(var(--primary))' }}>Skip →</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Typography Panel ───
function TypographyPanel({ institutionId, appConfig }: { institutionId: string; appConfig: AppConfig }) {
  const queryClient = useQueryClient();
  const [multiplier, setMultiplier] = useState(appConfig.font_size_multiplier);

  useEffect(() => {
    setMultiplier(appConfig.font_size_multiplier);
  }, [appConfig.font_size_multiplier]);

  const mutation = useMutation({
    mutationFn: async (newMultiplier: number) => {
      // Merge into existing app_config
      const { data: inst } = await supabase
        .from("institutions")
        .select("app_config")
        .eq("id", institutionId)
        .single();
      const currentConfig = (inst as any)?.app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentConfig, font_size_multiplier: newMultiplier },
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-banking"] });
      toast.success("Font size saved");
    },
    onError: () => toast.error("Failed to save font size"),
  });

  const presets = [
    { label: "Compact", value: 0.6 },
    { label: "Small", value: 0.7 },
    { label: "Default", value: 0.85 },
    { label: "Medium", value: 1.0 },
    { label: "Large", value: 1.2 },
    { label: "Extra Large", value: 1.5 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" /> Font Size Management</CardTitle>
        <CardDescription>Control the global font size multiplier for this institution's banking app. Changes apply instantly for all users.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Slider + value */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Global Font Size Multiplier</Label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={multiplier}
              onChange={(e) => setMultiplier(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.05"
                min="0.5"
                max="2.0"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value) || 0.7)}
                className="h-9 w-20 text-center font-mono font-bold"
              />
              <span className="text-sm text-muted-foreground font-medium">×</span>
            </div>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Presets</Label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.value}
                variant={Math.abs(multiplier - p.value) < 0.01 ? "default" : "outline"}
                size="sm"
                onClick={() => setMultiplier(p.value)}
                className="text-xs"
              >
                {p.label} ({p.value}×)
              </Button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Preview</Label>
          <div className="rounded-xl border-2 border-dashed p-4 bg-muted/30 space-y-2">
            <p style={{ fontSize: `calc(0.75rem * ${multiplier})` }} className="text-muted-foreground">text-xs: Account details</p>
            <p style={{ fontSize: `calc(0.875rem * ${multiplier})` }}>text-sm: Transaction reference</p>
            <p style={{ fontSize: `calc(1rem * ${multiplier})` }} className="font-medium">text-base: Account name</p>
            <p style={{ fontSize: `calc(1.25rem * ${multiplier})` }} className="font-bold">text-xl: Section heading</p>
            <p style={{ fontSize: `calc(1.5rem * ${multiplier})` }} className="font-bold">text-2xl: Page title</p>
            <p style={{ fontSize: `calc(1.875rem * ${multiplier})` }} className="font-bold">text-3xl: Balance display</p>
          </div>
        </div>

        <Button
          onClick={() => mutation.mutate(multiplier)}
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Font Size
        </Button>
      </CardContent>
    </Card>
  );
}

export default function BankingAppManagement() {
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: institutions = [], isLoading: loadingInstitutions } = useInstitutions();
  const { data: accounts = [], isLoading: loadingAccounts } = useInstitutionAccounts(selectedInstitution);
  const { data: transactions = [], isLoading: loadingTxns } = useInstitutionTransactions(selectedInstitution);
  const { data: savings = [], isLoading: loadingSavings } = useInstitutionSavings(selectedInstitution);
  const { data: loans = [], isLoading: loadingLoans } = useInstitutionLoans(selectedInstitution);
  const { data: fundingIntents = [], isLoading: loadingFunding } = useInstitutionFunding(selectedInstitution);
  const { data: customers = [], isLoading: loadingCustomers } = useInstitutionCustomers(selectedInstitution);
  const { data: virtualCards = [], isLoading: loadingCards } = useInstitutionCards(selectedInstitution);
  const { data: creditScores = [], isLoading: loadingScores } = useInstitutionCreditScores(selectedInstitution);



  const selectedInst = institutions.find((i) => i.id === selectedInstitution) as any;

  const totalBalance = accounts.reduce((sum, acc) => {
    const bal = acc.account_balances?.[0]?.amount || 0;
    return sum + bal;
  }, 0);

  const filteredInstitutions = institutions.filter((i) =>
    i.institution_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAppConfig: AppConfig = (() => {
    const raw = selectedInst?.app_config || {};
    let sectionOrder: HomeSectionKey[] = raw.section_order || defaultSectionOrder;
    // Always ensure media_banner is present in section order
    if (!sectionOrder.includes('media_banner')) {
      const txIdx = sectionOrder.indexOf('recent_transactions');
      sectionOrder = [...sectionOrder];
      sectionOrder.splice(txIdx >= 0 ? txIdx : sectionOrder.length, 0, 'media_banner');
    }
    return selectedInst
      ? {
          ...defaultAppConfig,
          ...raw,
          features: { ...defaultAppConfig.features, ...(raw.features || {}) },
          home_layout: { ...defaultAppConfig.home_layout, ...(raw.home_layout || {}) },
          section_order: sectionOrder,
          layout_style: raw.layout_style || 'modern',
          section_styles: raw.section_styles || {},
          media_sections: raw.media_sections || [],
          walkthrough_config: raw.walkthrough_config || { skip_enabled: true },
          card_colors: raw.card_colors || {},
          font_size_multiplier: typeof raw.font_size_multiplier === 'number' ? raw.font_size_multiplier : 0.7,
        }
      : defaultAppConfig;
  })();

  // Walkthrough config state for the walkthrough tab
  const [walkthroughConfig, setWalkthroughConfig] = useState<WalkthroughConfig>(selectedAppConfig.walkthrough_config);
  useEffect(() => {
    setWalkthroughConfig(selectedAppConfig.walkthrough_config);
  }, [selectedInstitution]);

  const queryClient = useQueryClient();
  const saveWalkthroughConfig = useMutation({
    mutationFn: async () => {
      const currentConfig = selectedInst?.app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentConfig, walkthrough_config: walkthroughConfig }
      }).eq("id", selectedInstitution);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-banking"] });
      toast.success("Walkthrough config saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Smartphone} title="Banking App Management" description="Manage PWA banking application features and configurations" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Institution List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Institutions</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingInstitutions ? (
                <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredInstitutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-6">No institutions found</p>
              ) : (
                filteredInstitutions.map((inst) => (
                  <button key={inst.id} onClick={() => setSelectedInstitution(inst.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0 ${selectedInstitution === inst.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}>
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: inst.primary_color || "hsl(var(--primary))" }}>
                        {inst.institution_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inst.institution_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{inst.institution_type}</p>
                    </div>
                    <Badge variant={inst.status === "approved" ? "default" : "secondary"} className="text-[10px] shrink-0">{inst.status}</Badge>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedInstitution ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium">Select an Institution</h3>
                <p className="text-sm text-muted-foreground mt-1">Choose a banking institution from the left to view its app data</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Institution Header */}
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  {selectedInst?.logo_url ? (
                    <img src={selectedInst.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: selectedInst?.primary_color || "hsl(var(--primary))" }}>
                      {selectedInst?.institution_name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{selectedInst?.institution_name}</h2>
                    <p className="text-sm text-muted-foreground capitalize">{selectedInst?.institution_type} · Created {selectedInst?.created_at ? format(new Date(selectedInst.created_at), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <Badge variant={selectedInst?.status === "approved" ? "default" : "secondary"}>{selectedInst?.status}</Badge>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Accounts" value={accounts.length} color="bg-blue-500" />
                <StatCard icon={Wallet} label="Total Balance" value={`${totalBalance.toLocaleString()} XAF`} color="bg-emerald-500" />
                <StatCard icon={ArrowRightLeft} label="Transactions" value={transactions.length} color="bg-amber-500" />
                <StatCard icon={PiggyBank} label="Savings Goals" value={savings.length} color="bg-purple-500" />
                <StatCard icon={ArrowDownLeft} label="Funding Intents" value={fundingIntents.length} color="bg-teal-500" />
                <StatCard icon={UserCheck} label="Customers" value={customers.length} color="bg-indigo-500" />
                <StatCard icon={CreditCard} label="Virtual Cards" value={virtualCards.length} color="bg-pink-500" />
                <StatCard icon={BarChart3} label="Avg Credit Score" value={creditScores.length > 0 ? Math.round(creditScores.reduce((s: number, c: any) => s + c.score, 0) / creditScores.length) : '—'} color="bg-orange-500" />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start flex-wrap h-auto">
                  <TabsTrigger value="accounts" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Accounts</TabsTrigger>
                  <TabsTrigger value="transactions" className="gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> Transactions</TabsTrigger>
                  <TabsTrigger value="savings" className="gap-1.5"><PiggyBank className="h-3.5 w-3.5" /> Savings</TabsTrigger>
                  <TabsTrigger value="loans" className="gap-1.5"><Landmark className="h-3.5 w-3.5" /> Loans</TabsTrigger>
                  <TabsTrigger value="funding" className="gap-1.5"><ArrowDownLeft className="h-3.5 w-3.5" /> Funding</TabsTrigger>
                  <TabsTrigger value="customers" className="gap-1.5"><UserCheck className="h-3.5 w-3.5" /> Customers</TabsTrigger>
                  <TabsTrigger value="cards" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Cards</TabsTrigger>
                  <TabsTrigger value="credit-scores" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Credit Scores</TabsTrigger>
                  <TabsTrigger value="features" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Features</TabsTrigger>
                  <TabsTrigger value="typography" className="gap-1.5"><Type className="h-3.5 w-3.5" /> Typography</TabsTrigger>
                  <TabsTrigger value="walkthrough" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Walkthrough</TabsTrigger>
                </TabsList>

                {/* Accounts Tab */}
                <TabsContent value="accounts">
                  <Card>
                    <CardContent className="p-0">
                      {loadingAccounts ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : accounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No accounts found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Account Holder</TableHead><TableHead>Account ID</TableHead><TableHead>Type</TableHead><TableHead>Currency</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {accounts.map((acc) => (
                              <TableRow key={acc.id}>
                                <TableCell className="font-medium">{acc.account_holder_name}</TableCell>
                                <TableCell className="font-mono text-xs">{acc.account_id}</TableCell>
                                <TableCell><Badge variant="outline" className="capitalize text-xs">{acc.account_subtype}</Badge></TableCell>
                                <TableCell>{acc.currency}</TableCell>
                                <TableCell className="text-right font-medium">{(acc.account_balances?.[0]?.amount || 0).toLocaleString()}</TableCell>
                                <TableCell><Badge variant={acc.is_active ? "default" : "secondary"} className="text-xs">{acc.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                  <Card>
                    <CardContent className="p-0">
                      {loadingTxns ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : transactions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No transactions found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {transactions.map((txn) => (
                              <TableRow key={txn.id}>
                                <TableCell className="text-sm">{txn.booking_date ? format(new Date(txn.booking_date), "MMM d, yyyy") : "—"}</TableCell>
                                <TableCell className="font-mono text-xs">{txn.transaction_id?.slice(0, 12)}...</TableCell>
                                <TableCell className="max-w-[200px] truncate text-sm">{txn.transaction_information || "—"}</TableCell>
                                <TableCell><Badge variant={txn.credit_debit_indicator === "Credit" ? "default" : "secondary"} className="text-xs">{txn.credit_debit_indicator}</Badge></TableCell>
                                <TableCell className={`text-right font-medium ${txn.credit_debit_indicator === "Credit" ? "text-emerald-600" : "text-red-500"}`}>
                                  {txn.credit_debit_indicator === "Credit" ? "+" : "-"}{Number(txn.amount).toLocaleString()} {txn.currency}
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-xs capitalize">{txn.status}</Badge></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Savings Tab */}
                <TabsContent value="savings">
                  <Card>
                    <CardContent className="p-0">
                      {loadingSavings ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : savings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No savings accounts found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Name</TableHead><TableHead>Target</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {savings.map((s: any) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-medium">{s.account_name || "Savings"}</TableCell>
                                <TableCell>{s.target_amount ? `${Number(s.target_amount).toLocaleString()} XAF` : "—"}</TableCell>
                                <TableCell className="text-right font-medium">{Number(s.current_balance || 0).toLocaleString()} XAF</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs capitalize">{s.status}</Badge></TableCell>
                                <TableCell className="text-sm">{s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Loans Tab */}
                <TabsContent value="loans">
                  <Card>
                    <CardContent className="p-0">
                      {loadingLoans ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No loan applications found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Product</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Tenure</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead><TableHead>Applied</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {loans.map((loan: any) => (
                              <TableRow key={loan.id}>
                                <TableCell className="font-medium">{loan.loan_product?.product_name || "—"}</TableCell>
                                <TableCell className="text-right font-medium">{Number(loan.requested_amount).toLocaleString()} XAF</TableCell>
                                <TableCell>{loan.tenure_months} months</TableCell>
                                <TableCell className="max-w-[150px] truncate text-sm">{loan.purpose || "—"}</TableCell>
                                <TableCell><Badge variant={loan.status === "approved" ? "default" : loan.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">{loan.status}</Badge></TableCell>
                                <TableCell className="text-sm">{loan.created_at ? format(new Date(loan.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Funding Tab */}
                <TabsContent value="funding">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2"><ArrowDownLeft className="h-4 w-4" /> Account Funding History</CardTitle>
                      <CardDescription>View all funding intents for this institution's accounts (MoMo, Card, PayPal, Bank Transfer)</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {loadingFunding ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : fundingIntents.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No funding intents found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Currency</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {fundingIntents.map((fi: any) => (
                              <TableRow key={fi.id}>
                                <TableCell className="text-sm">{fi.created_at ? format(new Date(fi.created_at), "MMM d, yyyy HH:mm") : "—"}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs capitalize">{(fi.method || '').replace(/_/g, ' ')}</Badge></TableCell>
                                <TableCell className="text-right font-medium">{Number(fi.amount || 0).toLocaleString()}</TableCell>
                                <TableCell>{fi.currency || 'XAF'}</TableCell>
                                <TableCell>
                                  <Badge variant={fi.status === 'successful' ? 'default' : fi.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                                    {fi.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{fi.provider_ref || fi.id?.slice(0, 12)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Customers Tab */}
                <TabsContent value="customers">
                  <Card>
                    <CardContent className="p-0">
                      {loadingCustomers ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : customers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No customers found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>KYC Status</TableHead><TableHead>Accounts</TableHead><TableHead>Joined</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {customers.map((c: any) => (
                              <TableRow key={c.id}>
                                <TableCell className="font-medium">{c.full_name || '—'}</TableCell>
                                <TableCell className="text-sm">{c.email || '—'}</TableCell>
                                <TableCell>
                                  <Badge variant={c.kyc_status === 'approved' || c.kyc_status === 'verified' ? 'default' : c.kyc_status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs capitalize">
                                    {c.kyc_status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{c.account_count}</TableCell>
                                <TableCell className="text-sm">{c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Virtual Cards Tab */}
                <TabsContent value="cards">
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                        <CreditCard className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <Badge variant="secondary" className="mb-3 text-xs font-semibold">Dormant</Badge>
                      <h3 className="text-base font-semibold text-foreground mb-1">Virtual Cards — Coming Soon</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        The virtual cards integration is currently dormant and under development. This service will be activated in a future release.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Credit Scores Tab */}
                <TabsContent value="credit-scores">
                  <Card>
                    <CardContent className="p-0">
                      {loadingScores ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : creditScores.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">No credit scores found</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>User ID</TableHead><TableHead>Score</TableHead><TableHead>Model</TableHead><TableHead>Confidence</TableHead><TableHead>Status</TableHead><TableHead>Calculated</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {creditScores.map((cs: any) => (
                              <TableRow key={cs.id}>
                                <TableCell className="font-mono text-xs">{cs.user_id?.slice(0, 8)}...</TableCell>
                                <TableCell>
                                  <span className={`text-lg font-bold ${cs.score >= 700 ? 'text-emerald-600' : cs.score >= 500 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {cs.score}
                                  </span>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-xs">{cs.scoring_model}</Badge></TableCell>
                                <TableCell>{cs.confidence_level ? `${cs.confidence_level}%` : '—'}</TableCell>
                                <TableCell><Badge variant={cs.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{cs.status || 'active'}</Badge></TableCell>
                                <TableCell className="text-sm">{cs.calculated_at ? format(new Date(cs.calculated_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Features Tab */}
                <TabsContent value="features">
                  <FeatureConfigPanel key={selectedInstitution} institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Typography Tab */}
                <TabsContent value="typography">
                  <TypographyPanel key={selectedInstitution} institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>
                {/* Walkthrough Tab */}
                <TabsContent value="walkthrough">
                  <WalkthroughManager
                    key={selectedInstitution}
                    institutionId={selectedInstitution!}
                    walkthroughConfig={walkthroughConfig}
                    onConfigChange={setWalkthroughConfig}
                  />
                  <Button onClick={() => saveWalkthroughConfig.mutate()} disabled={saveWalkthroughConfig.isPending} className="w-full mt-4">
                    {saveWalkthroughConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Walkthrough Config
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
