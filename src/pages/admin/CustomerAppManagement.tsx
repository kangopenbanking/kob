import { useState, useEffect } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Smartphone, Users, CreditCard, ArrowRightLeft, PiggyBank, Landmark,
  Search, Loader2, Building2, Wallet, Settings2, GripVertical, ArrowUp, ArrowDown,
  Eye, Send, QrCode, ScanLine, ChevronRight, BarChart3, Monitor, ExternalLink,
  Plus, Trash2, Image, Video, BookOpen, Palette, Shield, UserCheck, Phone,
  Home, Calendar, Receipt, Split, Link2, Banknote, RefreshCw, Gift, Lock, Upload, ImageIcon, Plane, Store, UtensilsCrossed
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { API_CONFIG } from "@/config/api";
import { detectProvider, type MediaSection } from "@/components/pwa/MediaBanner";
import type { WalkthroughConfig, LayoutStyle, CardColors, CardColorOverride } from "@/components/pwa/TenantProvider";
import { AdminStorefrontSlider } from "@/components/storefront/AdminStorefrontSlider";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { adminStorageUpload } from '@/lib/admin/adminStorageUpload';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

// ─── Types ───
interface RewardsConfig {
  cashback_enabled: boolean;
  cashback_min_transfer: number;
  cashback_rate: number;
  referral_enabled: boolean;
  referral_bonus: number;
  coupons: { name: string; description: string; code: string; active: boolean }[];
}

interface CustomerAppConfig {
  features: {
    qr_scan: boolean;
    transfer: boolean;
    request: boolean;
    bills: boolean;
    invoices: boolean;
    bank: boolean;
    split_bills: boolean;
    pay_links: boolean;
    cash_out: boolean;
    recurring: boolean;
    rewards: boolean;
    piggy_bank: boolean;
    njangi: boolean;
    rent_reporting: boolean;
    credit_score: boolean;
    cards: boolean;
  };
  section_order: CustomerSectionKey[];
  layout_style: LayoutStyle;
  media_sections: MediaSection[];
  walkthrough_config: WalkthroughConfig;
  card_colors: CardColors;
  support_phone: string;
  support_email: string;
  cashout_methods: {
    bank_transfer: boolean;
    mobile_money: boolean;
    paypal: boolean;
  };
  cashout_limits: {
    min_amount: number;
    max_amount: number;
    daily_limit: number;
    quick_amounts: number[];
  };
  rewards_config: RewardsConfig;
  hero_bg_color: string;
  hero_bg_image: string;
  hero_action_colors: {
    accounts: string;
    cash_out: string;
    request: string;
    pay_links: string;
  };
  hero_action_opacity: number;
  typography_config: TypographyConfig;
  travel_card_config: {
    enabled: boolean;
    bg_image: string;
    overlay_opacity: number;
    button_text: string;
    button_bg_color: string;
    button_size: 'sm' | 'md' | 'lg';
  };
  daily_needs_card_config: {
    enabled: boolean;
    bg_image: string;
    overlay_opacity: number;
    button_text: string;
    button_bg_color: string;
    button_size: 'sm' | 'md' | 'lg';
  };
  home_carousel_order: ('travel' | 'daily_needs')[];
}

interface SectionTypography {
  font_size_multiplier: number;
  heading_color: string;
  body_color: string;
}

interface TypographyConfig {
  global_font_size_multiplier: number;
  global_heading_color: string;
  global_body_color: string;
  sections: Record<string, SectionTypography>;
}

type CustomerSectionKey = 'balance_card' | 'quick_actions' | 'media_banner' | 'upcoming_bills' | 'spending_stats' | 'recent_activities';

const defaultSectionOrder: CustomerSectionKey[] = ['balance_card', 'quick_actions', 'upcoming_bills', 'spending_stats', 'media_banner', 'recent_activities'];

const defaultRewardsConfig: RewardsConfig = {
  cashback_enabled: true,
  cashback_min_transfer: 10000,
  cashback_rate: 1,
  referral_enabled: true,
  referral_bonus: 500,
  coupons: [],
};

const defaultConfig: CustomerAppConfig = {
  features: {
    qr_scan: true, transfer: true, request: true, bills: true, invoices: true,
    bank: true, split_bills: true, pay_links: true, cash_out: true, recurring: true,
    rewards: true, piggy_bank: true, njangi: true, rent_reporting: true,
    credit_score: true, cards: true,
  },
  section_order: defaultSectionOrder,
  layout_style: 'modern',
  media_sections: [],
  walkthrough_config: { skip_enabled: true },
  card_colors: {},
  support_phone: '',
  support_email: '',
  cashout_methods: { bank_transfer: true, mobile_money: true, paypal: true },
  cashout_limits: { min_amount: 0, max_amount: 0, daily_limit: 0, quick_amounts: [5000, 10000, 25000, 50000, 100000] },
  rewards_config: defaultRewardsConfig,
  hero_bg_color: '',
  hero_bg_image: '',
  hero_action_colors: {
    accounts: '#ffffff',
    cash_out: '#ffffff',
    request: '#ffffff',
    pay_links: '#ffffff',
  },
  hero_action_opacity: 0.8,
  typography_config: {
    global_font_size_multiplier: 1.3,
    global_heading_color: '#000000',
    global_body_color: '#000000',
    sections: {},
  },
  travel_card_config: {
    enabled: true,
    bg_image: '',
    overlay_opacity: 0.75,
    button_text: 'Book Now',
    button_bg_color: '#ffffff',
    button_size: 'md',
  },
  daily_needs_card_config: {
    enabled: true,
    bg_image: '',
    overlay_opacity: 0.75,
    button_text: 'Order Now',
    button_bg_color: '#ffffff',
    button_size: 'md',
  },
  home_carousel_order: ['travel', 'daily_needs'],
};

// ─── Hooks ───
function useInstitutions() {
  return useQuery({
    queryKey: ["admin-institutions-customer"],
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

function useLinkedAccounts(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-customer-linked", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      // Fetch linked accounts
      const { data: accounts, error } = await (supabase as any)
        .from("customer_linked_accounts")
        .select("*")
        .eq("institution_id", institutionId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!accounts || accounts.length === 0) return [];

      // Fetch profiles for each unique user_id
      const userIds = [...new Set(accounts.map((a: any) => a.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return accounts.map((a: any) => ({
        ...a,
        profiles: profileMap.get(a.user_id) || null,
      }));
    },
  });
}

function useInstitutionAccounts(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-cust-accounts", institutionId],
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
    queryKey: ["admin-cust-transactions", institutionId],
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

function useInstitutionPiggyBank(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-cust-piggybank", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("piggybank_plans").select("*, piggybank_payments(*)").eq("institution_id", institutionId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionNjangi(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-cust-njangi", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("njangi_groups").select("*, njangi_members(*), njangi_contributions(*)").eq("institution_id", institutionId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useInstitutionCards(institutionId: string | null) {
  return useQuery({
    queryKey: ["admin-cust-cards", institutionId],
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
    queryKey: ["admin-cust-credit", institutionId],
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
    queryKey: ["admin-cust-walkthrough", institutionId],
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

// ─── Media Section Manager ───
function MediaSectionManager({ mediaSections, onChange, onAutoAddToOrder }: { mediaSections: MediaSection[]; onChange: (s: MediaSection[]) => void; onAutoAddToOrder?: () => void }) {
  const tr = useHarvestedT('admin');
  const [uploading, setUploading] = useState(false);

  const addMedia = (type: 'image' | 'video') => {
    const newItem: MediaSection = { id: crypto.randomUUID(), type, url: '', provider: type === 'video' ? 'youtube' : undefined, video_id: '', title: '', position: mediaSections.length, aspect: 'landscape' };
    onChange([...mediaSections, newItem]);
    onAutoAddToOrder?.();
  };

  const updateItem = (id: string, updates: Partial<MediaSection>) => onChange(mediaSections.map(m => m.id === id ? { ...m, ...updates } : m));
  const removeItem = (id: string) => onChange(mediaSections.filter(m => m.id !== id));

  const handleVideoUrl = (id: string, url: string) => {
    const { provider, video_id } = detectProvider(url);
    updateItem(id, { url, provider, video_id });
  };

  const handleMediaFileUpload = async (id: string, file: File, kind: 'image' | 'video') => {
    const maxBytes = kind === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File too large. Max ${kind === 'video' ? '50MB' : '10MB'}.`);
      return;
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in.'); setUploading(false); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${user.id}/media/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('pwa-media').upload(path, file, {
      contentType: file.type || (kind === 'video' ? 'video/mp4' : 'image/png'),
      cacheControl: '3600',
      upsert: false,
    });
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('pwa-media').getPublicUrl(path);
    const patch: Partial<MediaSection> = { url: publicUrl };
    if (kind === 'video') { patch.provider = 'custom'; patch.video_id = ''; }
    updateItem(id, patch);
    toast.success(`${kind === 'video' ? 'Video' : 'Image'} uploaded`);
    setUploading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" /> {tr('Media Banners')}</CardTitle>
        <CardDescription>{tr('Add image slides or embedded videos to the home screen')}</CardDescription>
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
            <Input placeholder={tr('Title (optional)')} value={item.title || ''} onChange={(e) => updateItem(item.id, { title: e.target.value })} className="h-8 text-xs" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{tr('Dimension:')}</span>
              <div className="flex gap-1">
                <Button type="button" variant={(!item.aspect || item.aspect === 'landscape') ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => updateItem(item.id, { aspect: 'landscape' })}>
                  <span className="inline-block w-4 h-2.5 border rounded-sm border-current" /> Landscape
                </Button>
                <Button type="button" variant={item.aspect === 'portrait' ? 'default' : 'outline'} size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => updateItem(item.id, { aspect: 'portrait' })}>
                  <span className="inline-block w-2.5 h-4 border rounded-sm border-current" /> Portrait
                </Button>
              </div>
            </div>
            {item.type === 'image' ? (
              <div className="space-y-2">
                <Input placeholder={tr('Image URL')} value={item.url} onChange={(e) => updateItem(item.id, { url: e.target.value })} className="h-8 text-xs" />
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Image className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Or upload image from device'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMediaFileUpload(item.id, e.target.files[0], 'image')} />
                </label>
                {item.url && <img src={item.url} alt="" className={`w-full rounded object-cover ${item.aspect === 'portrait' ? 'h-40' : 'h-20'}`} />}
              </div>
            ) : (
              <div className="space-y-2">
                <Input placeholder={tr('Video URL (YouTube, Facebook, X, etc.) or upload below')} value={item.url} onChange={(e) => handleVideoUrl(item.id, e.target.value)} className="h-8 text-xs" />
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Video className="h-3.5 w-3.5" /> {uploading ? 'Uploading...' : 'Or upload video from device (MP4, WebM, max 50MB)'}
                  <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleMediaFileUpload(item.id, e.target.files[0], 'video')} />
                </label>
                {item.provider && <Badge variant="secondary" className="text-[10px]">{item.provider === 'custom' ? 'uploaded file' : item.provider}</Badge>}
                {item.url && item.provider === 'custom' && (
                  <video src={item.url} className={`w-full rounded object-cover ${item.aspect === 'portrait' ? 'h-40' : 'h-24'}`} muted playsInline controls preload="metadata" />
                )}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => addMedia('image')} className="gap-1"><Image className="h-3.5 w-3.5" /> {tr('Add Image')}</Button>
          <Button variant="outline" size="sm" onClick={() => addMedia('video')} className="gap-1"><Video className="h-3.5 w-3.5" /> {tr('Add Video')}</Button>
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
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const { data: slides = [], isLoading } = useWalkthroughSlides(institutionId);
  const [editSlide, setEditSlide] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const saveSlideMutation = useMutation({
    mutationFn: async (slide: any) => {
      if (slide.id && !slide.isNew) {
        const { error } = await supabase.from('institution_walkthroughs').update({
          title: slide.title, description: slide.description, media_type: slide.media_type,
          media_url: slide.media_url, icon_name: slide.icon_name, bg_color: slide.bg_color,
          text_color: slide.text_color, slide_order: slide.slide_order,
        }).eq('id', slide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('institution_walkthroughs').insert({
          institution_id: institutionId, title: slide.title, description: slide.description,
          media_type: slide.media_type || 'icon', media_url: slide.media_url,
          icon_name: slide.icon_name || 'Shield', bg_color: slide.bg_color,
          text_color: slide.text_color, slide_order: slide.slide_order || slides.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-cust-walkthrough", institutionId] });
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
      queryClient.invalidateQueries({ queryKey: ["admin-cust-walkthrough", institutionId] });
      toast.success("Slide deleted");
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> {tr('Walkthrough Theme')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">{tr('Background Color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.bg_color || '#ffffff'} onChange={(e) => onConfigChange({ ...walkthroughConfig, bg_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
                <span className="text-xs text-muted-foreground">{walkthroughConfig.bg_color || 'Default'}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">{tr('Text Color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.text_color || '#000000'} onChange={(e) => onConfigChange({ ...walkthroughConfig, text_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{tr('Accent Color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={walkthroughConfig.accent_color || '#3b82f6'} onChange={(e) => onConfigChange({ ...walkthroughConfig, accent_color: e.target.value })} className="h-8 w-8 rounded border cursor-pointer" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs">{tr('Logo Override URL')}</Label>
              <Input value={walkthroughConfig.logo_url || ''} onChange={(e) => onConfigChange({ ...walkthroughConfig, logo_url: e.target.value || null })} placeholder="https://..." className="h-8 text-xs mt-1" />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <Switch checked={walkthroughConfig.skip_enabled !== false} onCheckedChange={(v) => onConfigChange({ ...walkthroughConfig, skip_enabled: v })} />
              <Label className="text-xs">{tr('Allow Skip')}</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4" /> {tr('Walkthrough Slides')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : slides.length === 0 && !editSlide ? (
            <p className="text-sm text-muted-foreground text-center py-4">{tr('No custom slides')}</p>
          ) : (
            slides.map((slide: any) => (
              <div key={slide.id} className="flex items-center gap-3 rounded-lg border p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{slide.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{slide.description}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditSlide(slide)}>{tr('Edit')}</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSlideMutation.mutate(slide.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))
          )}
          {editSlide ? (
            <div className="rounded-lg border-2 border-primary/20 p-4 space-y-3">
              <p className="text-sm font-bold">{editSlide.isNew ? 'New Slide' : 'Edit Slide'}</p>
              <Input placeholder={tr('Title')} value={editSlide.title || ''} onChange={(e) => setEditSlide({ ...editSlide, title: e.target.value })} />
              <Textarea placeholder={tr('Description')} value={editSlide.description || ''} onChange={(e) => setEditSlide({ ...editSlide, description: e.target.value })} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{tr('Media Type')}</Label>
                  <Select value={editSlide.media_type || 'icon'} onValueChange={(v) => setEditSlide({ ...editSlide, media_type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="icon">{tr('Icon')}</SelectItem>
                      <SelectItem value="image">{tr('Image')}</SelectItem>
                      <SelectItem value="video">{tr('Video')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editSlide.media_type === 'icon' && (
                  <div>
                    <Label className="text-xs">{tr('Icon Name (Lucide)')}</Label>
                    <Input value={editSlide.icon_name || 'Shield'} onChange={(e) => setEditSlide({ ...editSlide, icon_name: e.target.value })} className="h-8 text-xs" />
                  </div>
                )}
                {(editSlide.media_type === 'image' || editSlide.media_type === 'video') && (
                  <div>
                    <Label className="text-xs">{tr('Media URL')}</Label>
                    <Input value={editSlide.media_url || ''} onChange={(e) => setEditSlide({ ...editSlide, media_url: e.target.value })} className="h-8 text-xs" />
                  </div>
                )}
              </div>
              {(editSlide.media_type === 'image' || editSlide.media_type === 'video') && (
                <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed p-2 text-xs text-muted-foreground hover:bg-accent/50">
                  <Image className="h-3.5 w-3.5" />
                  {uploading
                    ? 'Uploading...'
                    : editSlide.media_type === 'video'
                      ? 'Upload video from device'
                      : 'Upload image from device'}
                  <input
                    type="file"
                    accept={editSlide.media_type === 'video' ? 'video/*' : 'image/*'}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const maxBytes = editSlide.media_type === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
                      if (file.size > maxBytes) {
                        toast.error(`File too large. Max ${editSlide.media_type === 'video' ? '50MB' : '10MB'}.`);
                        return;
                      }
                      setUploading(true);
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) { toast.error('Please sign in.'); setUploading(false); return; }
                      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                      const path = `${user.id}/walkthrough/${Date.now()}_${safeName}`;
                      const { error } = await supabase.storage.from('pwa-media').upload(path, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: file.type,
                      });
                      if (error) { toast.error('Upload failed'); setUploading(false); return; }
                      const { data: { publicUrl } } = supabase.storage.from('pwa-media').getPublicUrl(path);
                      setEditSlide((prev: any) => ({ ...prev, media_url: publicUrl }));
                      setUploading(false);
                      toast.success(`${editSlide.media_type === 'video' ? 'Video' : 'Image'} uploaded`);
                    }}
                  />
                </label>
              )}
              {editSlide.media_url && editSlide.media_type === 'image' && (
                <div className="rounded border overflow-hidden bg-muted aspect-video">
                  <img src={editSlide.media_url} alt="preview" className="h-full w-full object-cover" />
                </div>
              )}
              {editSlide.media_url && editSlide.media_type === 'video' && (
                <div className="rounded border overflow-hidden bg-muted aspect-video">
                  <video src={editSlide.media_url} className="h-full w-full object-cover" muted playsInline controls />
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveSlideMutation.mutate(editSlide)} disabled={saveSlideMutation.isPending}>
                  {saveSlideMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditSlide(null)}>{tr('Cancel')}</Button>
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
function FeatureConfigPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<CustomerAppConfig>(appConfig);

  const mutation = useMutation({
    mutationFn: async (newConfig: CustomerAppConfig) => {
      // Save under customer_app_config key in app_config JSONB
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentAppConfig, customer_app_config: newConfig }
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Customer app configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  const toggleFeature = (key: keyof CustomerAppConfig["features"]) => {
    setConfig(prev => ({ ...prev, features: { ...prev.features, [key]: !prev.features[key] } }));
  };

  const featureLabels: Record<string, string> = {
    qr_scan: "QR Scanner", transfer: "Send Money", request: "Request Money",
    bills: "Bill Payments", invoices: "Invoices", bank: "Bank Management",
    split_bills: "Split Bills", pay_links: "Pay Links", cash_out: "Cash Out",
    recurring: "Recurring Payments", rewards: "Rewards", piggy_bank: "Piggy Bank",
    njangi: "Njangi Groups", rent_reporting: "Rent Reporting",
    credit_score: "Credit Score", cards: "Virtual Cards",
  };

  const sectionLabels: Record<CustomerSectionKey, string> = {
    balance_card: 'Balance Card', quick_actions: 'Quick Actions',
    media_banner: 'Media Banner', upcoming_bills: 'Upcoming Bills',
    spending_stats: 'Spending Stats', recent_activities: 'Recent Activities',
  };

  const sectionOrder = config.section_order || defaultSectionOrder;
  const hasMediaBanner = sectionOrder.includes('media_banner');

  // ─── Phone Preview Mockup ───
  const renderPreview = () => (
    <div className="sticky top-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {tr('Live Preview')}</p>
      <div className="mx-auto w-[180px] rounded-[20px] border-[3px] border-foreground/20 bg-background p-2 shadow-lg">
        {/* Status bar */}
        <div className="flex justify-between px-1 mb-1">
          <span className="text-[6px] text-muted-foreground">9:41</span>
          <span className="text-[6px] text-muted-foreground">100%</span>
        </div>
        {/* Content */}
        <div className="space-y-1.5 pb-6">
          {sectionOrder.map(key => renderPreviewSection(key))}
        </div>
        {/* Bottom Nav */}
        <div className="flex items-end justify-around border-t pt-1 mt-1 relative">
          <div className="flex flex-col items-center"><div className="h-2.5 w-2.5 rounded bg-primary" /><span className="text-[4px]">{tr('Home')}</span></div>
          <div className="flex flex-col items-center"><div className="h-2.5 w-2.5 rounded bg-muted" /><span className="text-[4px]">{tr('Activity')}</span></div>
          <div className="flex flex-col items-center -mt-2">
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow"><ScanLine className="h-2.5 w-2.5 text-primary-foreground" /></div>
            <span className="text-[4px] font-bold text-primary">{tr('Scan')}</span>
          </div>
          <div className="flex flex-col items-center"><div className="h-2.5 w-2.5 rounded bg-muted" /><span className="text-[4px]">{tr('Cards')}</span></div>
          <div className="flex flex-col items-center"><div className="h-2.5 w-2.5 rounded bg-muted" /><span className="text-[4px]">{tr('More')}</span></div>
        </div>
      </div>
    </div>
  );

  const renderPreviewSection = (key: CustomerSectionKey) => {
    switch (key) {
      case 'balance_card':
        return <div key={key} className="rounded-lg bg-[hsl(225,50%,22%)] p-2"><p className="text-[6px] text-white/60">{tr('Total Balance')}</p><p className="text-[9px] font-bold text-white">{tr('XAF 485,000')}</p><p className="text-[5px] text-emerald-400">{tr('+12,500 today')}</p></div>;
      case 'quick_actions':
        return (
          <div key={key} className="flex justify-between px-1">
            {['Send', 'Recv', 'Add'].map(a => (
              <div key={a} className="flex flex-col items-center gap-0.5">
                <div className="h-5 w-5 rounded-md bg-[hsl(210,80%,93%)]" />
                <span className="text-[5px]">{a}</span>
              </div>
            ))}
          </div>
        );
      case 'media_banner': {
        const media = config.media_sections || [];
        if (media.length === 0) return <div key={key} className="h-8 rounded-md border border-dashed border-primary/30 flex items-center justify-center"><p className="text-[5px] text-muted-foreground">{tr('Media Banner')}</p></div>;
        const first = media[0];
        return (
          <div key={key} className="h-8 rounded-md overflow-hidden">
            {first.type === 'image' && first.url ? <img src={first.url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-accent/30 flex items-center justify-center"><span className="text-[5px]">{first.provider || 'Video'}</span></div>}
          </div>
        );
      }
      case 'upcoming_bills':
        return (
          <div key={key}>
            <p className="text-[6px] font-bold mb-0.5">{tr('Upcoming Bills')}</p>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-orange-100" /><p className="text-[5px]">Bill #{i}</p></div>
                <span className="text-[5px] font-bold text-orange-600">15,000</span>
              </div>
            ))}
          </div>
        );
      case 'spending_stats':
        return (
          <div key={key}>
            <p className="text-[6px] font-bold mb-0.5">{tr('Spending Stats')}</p>
            <div className="flex gap-1">
              {[60, 40, 80, 30].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full rounded-sm bg-primary/30" style={{ height: `${h / 10}px` }} />
                  <span className="text-[4px] text-muted-foreground">W{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'recent_activities':
        return (
          <div key={key}>
            <p className="text-[6px] font-bold mb-0.5">{tr('Recent Activities')}</p>
            {[1, 2].map(i => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1"><div className="h-3 w-3 rounded bg-muted" /><div><p className="text-[5px]">{tr('Payment')}</p></div></div>
                <span className="text-[5px] font-bold">-5,000</span>
              </div>
            ))}
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        {/* Features */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('App Features')}</CardTitle><CardDescription>{tr('Toggle which features are available in the customer app')}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(featureLabels).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <Label htmlFor={`feat-${key}`} className="text-sm font-medium">{label}</Label>
                <Switch id={`feat-${key}`} checked={config.features[key as keyof CustomerAppConfig["features"]]} onCheckedChange={() => toggleFeature(key as keyof CustomerAppConfig["features"])} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cash Out Methods */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('Cash Out Methods')}</CardTitle><CardDescription>{tr('Activate or deactivate cash out options for customers')}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {([
              { key: 'bank_transfer', label: 'Bank Transfer', desc: 'Withdraw to bank account' },
              { key: 'mobile_money', label: 'Mobile Money', desc: 'Withdraw to MoMo wallet' },
              { key: 'paypal', label: 'PayPal', desc: 'Withdraw to PayPal account' },
            ] as const).map(m => (
              <div key={m.key} className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{m.label}</Label>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
                <Switch
                  checked={config.cashout_methods?.[m.key] ?? true}
                  onCheckedChange={() => setConfig(prev => ({
                    ...prev,
                    cashout_methods: { ...prev.cashout_methods, [m.key]: !(prev.cashout_methods?.[m.key] ?? true) }
                  }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Cash Out Limits */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('Cash Out Limits')}</CardTitle><CardDescription>{tr('Set withdrawal limits (0 = no limit). All limits are enforced on the frontend.')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{tr('Min Amount (XAF)')}</Label>
                <Input type="number" value={config.cashout_limits?.min_amount || 0}
                  onChange={e => setConfig(prev => ({ ...prev, cashout_limits: { ...prev.cashout_limits, min_amount: Number(e.target.value) || 0 } }))} />
                <p className="text-[10px] text-muted-foreground mt-1">{tr('0 = no minimum')}</p>
              </div>
              <div>
                <Label className="text-xs">{tr('Max Amount (XAF)')}</Label>
                <Input type="number" value={config.cashout_limits?.max_amount || 0}
                  onChange={e => setConfig(prev => ({ ...prev, cashout_limits: { ...prev.cashout_limits, max_amount: Number(e.target.value) || 0 } }))} />
                <p className="text-[10px] text-muted-foreground mt-1">{tr('0 = no maximum')}</p>
              </div>
              <div>
                <Label className="text-xs">{tr('Daily Limit (XAF)')}</Label>
                <Input type="number" value={config.cashout_limits?.daily_limit || 0}
                  onChange={e => setConfig(prev => ({ ...prev, cashout_limits: { ...prev.cashout_limits, daily_limit: Number(e.target.value) || 0 } }))} />
                <p className="text-[10px] text-muted-foreground mt-1">{tr('0 = unlimited')}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs">{tr('Quick Amounts (comma-separated)')}</Label>
              <Input value={(config.cashout_limits?.quick_amounts || [5000, 10000, 25000, 50000, 100000]).join(', ')}
                onChange={e => setConfig(prev => ({ ...prev, cashout_limits: { ...prev.cashout_limits, quick_amounts: e.target.value.split(',').map(v => Number(v.trim())).filter(v => v > 0) } }))} />
              <p className="text-[10px] text-muted-foreground mt-1">{tr('Shortcut amounts shown to users')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Rewards Configuration */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Gift className="h-4 w-4" /> {tr('Rewards Configuration')}</CardTitle><CardDescription>{tr('Manage cashback thresholds, referral bonuses, and coupons')}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label className="text-sm font-medium">{tr('Cashback Enabled')}</Label><p className="text-xs text-muted-foreground">{tr('Earn cashback on qualifying transfers')}</p></div>
              <Switch checked={config.rewards_config?.cashback_enabled ?? true}
                onCheckedChange={() => setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, cashback_enabled: !(prev.rewards_config?.cashback_enabled ?? true) } }))} />
            </div>
            {(config.rewards_config?.cashback_enabled ?? true) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{tr('Min Transfer Amount (XAF)')}</Label>
                  <Input type="number" value={config.rewards_config?.cashback_min_transfer || 10000}
                    onChange={e => setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, cashback_min_transfer: parseInt(e.target.value) || 10000 } }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{tr('Cashback Rate (%)')}</Label>
                  <Input type="number" value={config.rewards_config?.cashback_rate || 1} min={0} max={100} step={0.1}
                    onChange={e => setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, cashback_rate: parseFloat(e.target.value) || 1 } }))} className="mt-1" />
                </div>
              </div>
            )}
            <div className="border-t pt-3 flex items-center justify-between">
              <div><Label className="text-sm font-medium">{tr('Referral Program')}</Label><p className="text-xs text-muted-foreground">{tr('Earn bonus for referring friends')}</p></div>
              <Switch checked={config.rewards_config?.referral_enabled ?? true}
                onCheckedChange={() => setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, referral_enabled: !(prev.rewards_config?.referral_enabled ?? true) } }))} />
            </div>
            {(config.rewards_config?.referral_enabled ?? true) && (
              <div>
                <Label className="text-xs">{tr('Referral Bonus (XAF)')}</Label>
                <Input type="number" value={config.rewards_config?.referral_bonus || 500}
                  onChange={e => setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, referral_bonus: parseInt(e.target.value) || 500 } }))} className="mt-1" />
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">{tr('Coupons')}</Label>
                <Button variant="outline" size="sm" className="gap-1 h-7" onClick={() => setConfig(prev => ({
                  ...prev, rewards_config: {
                    ...prev.rewards_config,
                    coupons: [...(prev.rewards_config?.coupons || []), { name: '', description: '', code: '', active: true }]
                  }
                }))}><Plus className="h-3 w-3" /> {tr('Add Coupon')}</Button>
              </div>
              {(config.rewards_config?.coupons || []).map((coupon: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-3 mb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input placeholder={tr('Coupon name')} value={coupon.name} className="h-8 text-xs flex-1 mr-2"
                      onChange={e => { const c = [...(config.rewards_config?.coupons || [])]; c[idx] = { ...c[idx], name: e.target.value }; setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, coupons: c } })); }} />
                    <Switch checked={coupon.active} onCheckedChange={() => {
                      const c = [...(config.rewards_config?.coupons || [])]; c[idx] = { ...c[idx], active: !c[idx].active };
                      setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, coupons: c } }));
                    }} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={() => {
                      const c = (config.rewards_config?.coupons || []).filter((_: any, i: number) => i !== idx);
                      setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, coupons: c } }));
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                  <Input placeholder={tr('Description')} value={coupon.description} className="h-8 text-xs"
                    onChange={e => { const c = [...(config.rewards_config?.coupons || [])]; c[idx] = { ...c[idx], description: e.target.value }; setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, coupons: c } })); }} />
                  <Input placeholder={tr('Code (e.g. WELCOME10)')} value={coupon.code} className="h-8 text-xs font-mono"
                    onChange={e => { const c = [...(config.rewards_config?.coupons || [])]; c[idx] = { ...c[idx], code: e.target.value.toUpperCase() }; setConfig(prev => ({ ...prev, rewards_config: { ...prev.rewards_config, coupons: c } })); }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Layout Style */}
        <Card>
          <CardHeader><CardTitle className="text-base">{tr('Layout Style')}</CardTitle></CardHeader>
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

        {/* Section Order */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tr('Home Section Order')}</CardTitle>
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
                  onClick={() => { const order = [...sectionOrder]; [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]]; setConfig(prev => ({ ...prev, section_order: order })); }}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === sectionOrder.length - 1}
                  onClick={() => { const order = [...sectionOrder]; [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]]; setConfig(prev => ({ ...prev, section_order: order })); }}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Support Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4" /> {tr('Support Contact')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">{tr('Support Phone Number')}</Label>
              <Input placeholder="+237 233 000 000" value={config.support_phone || ''} onChange={(e) => setConfig(prev => ({ ...prev, support_phone: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">{tr('Support Email')}</Label>
              <Input placeholder="support@yourbank.com" value={config.support_email || ''} onChange={(e) => setConfig(prev => ({ ...prev, support_email: e.target.value }))} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Media Sections */}
        <MediaSectionManager
          mediaSections={config.media_sections || []}
          onChange={(s) => setConfig(prev => ({ ...prev, media_sections: s }))}
          onAutoAddToOrder={() => {
            setConfig(prev => {
              const order = prev.section_order || defaultSectionOrder;
              if (order.includes('media_banner')) return prev;
              const actIdx = order.indexOf('recent_activities');
              const newOrder = [...order];
              newOrder.splice(actIdx >= 0 ? actIdx : newOrder.length, 0, 'media_banner');
              return { ...prev, section_order: newOrder };
            });
          }}
        />

        <Button onClick={() => mutation.mutate(config)} disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Configuration
        </Button>
      </div>

      {/* Preview Column */}
      <div className="hidden xl:block">{renderPreview()}</div>
    </div>
  );
}

// ─── Hero Section Panel ───
function HeroSectionPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [bgColor, setBgColor] = useState(appConfig.hero_bg_color || '');
  const [bgImage, setBgImage] = useState(appConfig.hero_bg_image || '');
  const [uploading, setUploading] = useState(false);

  const [isVideo, setIsVideo] = useState(false);
  const [actionColors, setActionColors] = useState(appConfig.hero_action_colors || { accounts: '#ffffff', cash_out: '#ffffff', request: '#ffffff', pay_links: '#ffffff' });
  const [actionOpacity, setActionOpacity] = useState(appConfig.hero_action_opacity ?? 0.8);
  const [mediaType, setMediaType] = useState<'image' | 'video' | ''>('');

  // Detect if URL is a video — check extension OR stored media type
  useEffect(() => {
    const extensionMatch = bgImage ? /\.(mp4|webm|ogg)(\?|$)/i.test(bgImage) : false;
    setIsVideo(extensionMatch || mediaType === 'video');
  }, [bgImage, mediaType]);

  useEffect(() => {
    setBgColor(appConfig.hero_bg_color || '');
    setBgImage(appConfig.hero_bg_image || '');
    setMediaType((appConfig as any).hero_media_type || '');
    setActionColors(appConfig.hero_action_colors || { accounts: '#ffffff', cash_out: '#ffffff', request: '#ffffff', pay_links: '#ffffff' });
    setActionOpacity(appConfig.hero_action_opacity ?? 0.8);
  }, [appConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: {
          ...currentAppConfig,
          customer_app_config: {
            ...customerConfig,
            hero_bg_color: bgColor,
            hero_bg_image: bgImage,
            hero_media_type: mediaType,
            hero_action_colors: actionColors,
            hero_action_opacity: actionOpacity,
          },
        },
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Hero section updated");
    },
    onError: () => toast.error("Failed to save hero section"),
  });

  const MAX_VIDEO_SIZE_MB = 300;

  const handleMediaUpload = async (file: File) => {
    // Validate video file size
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in.'); setUploading(false); return; }
      const fileName = `${user.id}/hero-bg-${institutionId}-${Date.now()}.${ext}`;
      const { publicUrl } = await adminStorageUpload({
        bucket: 'institution-assets',
        path: fileName,
        file,
        contentType: file.type,
        upsert: true,
      });
      const newUrl = publicUrl;
      const uploadedIsVideo = file.type.startsWith('video/');
      const newMediaType = uploadedIsVideo ? 'video' : 'image';

      // Update local state
      setBgImage(newUrl);
      setMediaType(newMediaType);

      // Auto-save to DB immediately after upload
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error: saveError } = await (supabase as any).from("institutions").update({
        app_config: {
          ...currentAppConfig,
          customer_app_config: {
            ...customerConfig,
            hero_bg_color: bgColor,
            hero_bg_image: newUrl,
            hero_media_type: newMediaType,
            hero_action_colors: actionColors,
            hero_action_opacity: actionOpacity,
          },
        },
      }).eq("id", institutionId);
      if (saveError) throw saveError;

      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success(`${uploadedIsVideo ? 'Video' : 'Image'} uploaded & saved`);
    } catch (err: any) {
      console.error('Hero media upload error:', err);
      toast.error(extractEdgeFunctionError(err, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> {tr('Hero Section Appearance')}</CardTitle>
        <CardDescription>{tr('Customize the hero background on the Customer App home screen')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div>
          <Label className="text-sm font-medium mb-2 block">{tr('Preview')}</Label>
          <div
            className="rounded-2xl h-40 flex items-end p-4 relative overflow-hidden"
            style={{
              ...(bgImage && !isVideo ? {
                backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.35)), url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : !bgImage ? {
                background: bgColor || 'hsl(var(--primary))',
              } : {}),
            }}
          >
            {isVideo && bgImage && (
              <>
                <video src={bgImage} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 to-black/35" />
              </>
            )}
            <div className="relative text-white z-10">
              <p className="text-xs opacity-80">{tr('Getting funds')}</p>
              <p className="text-2xl font-bold">{tr('1,250,000 XAF')}</p>
            </div>
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <Label>{tr('Background Color')}</Label>
          <p className="text-xs text-muted-foreground">{tr('CSS color value (e.g. #1a3a5c, hsl(217 91% 35%), linear-gradient(...)). Used when no image/video is set.')}</p>
          <div className="flex gap-2">
            <Input value={bgColor} onChange={e => setBgColor(e.target.value)} placeholder={tr('e.g. #1a3a5c or hsl(217, 91%, 35%)')} />
            {bgColor && (
              <div className="h-10 w-10 rounded-lg border shrink-0" style={{ background: bgColor }} />
            )}
          </div>
        </div>

        {/* Background Image / Video */}
        <div className="space-y-2">
          <Label>{tr('Background Image or Video')}</Label>
          <p className="text-xs text-muted-foreground">Upload an image (JPG, PNG, WebP) or video (MP4, WebM, max {MAX_VIDEO_SIZE_MB}MB). Overrides the color when set.</p>
          {bgImage && (
            <div className="relative w-full max-w-sm rounded-lg border overflow-hidden bg-muted">
              {isVideo ? (
                <video src={bgImage} autoPlay loop muted playsInline className="w-full h-32 object-cover" crossOrigin="anonymous" />
              ) : (
                <img src={bgImage} alt={tr('Hero background')} className="w-full h-32 object-cover" />
              )}
              <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => { setBgImage(''); setMediaType(''); }}>
                <Trash2 className="h-3 w-3 mr-1" /> Remove
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={bgImage} onChange={e => setBgImage(e.target.value)} placeholder={tr('Image/Video URL or upload below')} />
            <label className="cursor-pointer">
              <input type="file" accept="image/*,video/mp4,video/webm,video/ogg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f); }} />
              <Button variant="outline" size="icon" asChild disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
              </Button>
            </label>
          </div>
          {bgImage && (
            <div className="flex items-center gap-2 pt-1">
              <Label className="text-xs">{tr('Media type:')}</Label>
              <select
                value={mediaType || (isVideo ? 'video' : 'image')}
                onChange={e => setMediaType(e.target.value as 'image' | 'video')}
                className="text-xs border rounded px-2 py-1 bg-background"
              >
                <option value="image">{tr('Image')}</option>
                <option value="video">{tr('Video')}</option>
              </select>
              <p className="text-xs text-muted-foreground">{tr('Set this if using a URL that doesn\'t end in .mp4/.webm')}</p>
            </div>
          )}
        </div>

        {/* Hero Action Icon Background Colors */}
        <div className="space-y-3">
          <Label>{tr('Action Button Icon Backgrounds')}</Label>
          <p className="text-xs text-muted-foreground">{tr('Set the background color of hero action circles (Accounts, Cash Out, Request, Pay Links).')}</p>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'accounts', label: 'Accounts' },
              { key: 'cash_out', label: 'Cash Out' },
              { key: 'request', label: 'Request' },
              { key: 'pay_links', label: 'Pay Links' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={actionColors[key] || '#ffffff'}
                  onChange={e => setActionColors(prev => ({ ...prev, [key]: e.target.value }))}
                  className="h-8 w-8 rounded border cursor-pointer"
                />
                <div className="flex-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={actionColors[key] || '#ffffff'}
                    onChange={e => setActionColors(prev => ({ ...prev, [key]: e.target.value }))}
                    className="h-7 text-xs mt-0.5"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Action Button Opacity */}
        <div className="space-y-3">
          <Label>{tr('Action Button Opacity')}</Label>
          <p className="text-xs text-muted-foreground">{tr('Control the background opacity of hero action circles (0% transparent – 100% solid).')}</p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(actionOpacity * 100)}
              onChange={e => setActionOpacity(Number(e.target.value) / 100)}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12 text-right">{Math.round(actionOpacity * 100)}%</span>
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Hero Section
        </Button>
      </CardContent>
    </Card>
  );
}

const TYPOGRAPHY_SECTIONS = [
  { key: 'hero', label: 'Hero Section' },
  { key: 'money_movement', label: 'Money Movement' },
  { key: 'payments_bills', label: 'Payments & Bills' },
  { key: 'savings_goals', label: 'Savings & Goals' },
  { key: 'financial_health', label: 'Financial Health' },
  { key: 'recent_activities', label: 'Recent Activities' },
  { key: 'bottom_nav', label: 'Bottom Navigation' },
] as const;

// ─── Typography Panel ───
function TypographyPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [typoConfig, setTypoConfig] = useState<TypographyConfig>(appConfig.typography_config || defaultConfig.typography_config);

  useEffect(() => {
    setTypoConfig(appConfig.typography_config || defaultConfig.typography_config);
  }, [appConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentAppConfig, customer_app_config: { ...customerConfig, typography_config: typoConfig } }
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Typography settings saved");
    },
    onError: () => toast.error("Failed to save typography"),
  });

  const updateSection = (key: string, field: keyof SectionTypography, value: string | number) => {
    setTypoConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [key]: { ...(prev.sections[key] || { font_size_multiplier: 1, heading_color: '#000000', body_color: '#000000' }), [field]: value },
      },
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> {tr('Typography & Colors')}</CardTitle>
        <CardDescription>{tr('Control font sizes and text colors across the Consumer & Banking apps')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global Settings */}
        <div className="space-y-4 rounded-xl border p-4">
          <h4 className="text-sm font-bold">{tr('Global Defaults')}</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">{tr('Font Size Multiplier')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number" step="0.1" min="0.5" max="3"
                  value={typoConfig.global_font_size_multiplier}
                  onChange={e => setTypoConfig(prev => ({ ...prev, global_font_size_multiplier: parseFloat(e.target.value) || 1 }))}
                  className="h-8"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{typoConfig.global_font_size_multiplier}x</span>
              </div>
            </div>
            <div>
              <Label className="text-xs">{tr('Heading Color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={typoConfig.global_heading_color} onChange={e => setTypoConfig(prev => ({ ...prev, global_heading_color: e.target.value }))} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={typoConfig.global_heading_color} onChange={e => setTypoConfig(prev => ({ ...prev, global_heading_color: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{tr('Body Text Color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={typoConfig.global_body_color} onChange={e => setTypoConfig(prev => ({ ...prev, global_body_color: e.target.value }))} className="h-8 w-8 rounded border cursor-pointer" />
                <Input value={typoConfig.global_body_color} onChange={e => setTypoConfig(prev => ({ ...prev, global_body_color: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Per-Section Overrides */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold">{tr('Per-Section Overrides')}</h4>
          <p className="text-xs text-muted-foreground">{tr('Override global settings for specific sections. Leave blank to use global defaults.')}</p>
          <div className="space-y-2">
            {TYPOGRAPHY_SECTIONS.map(({ key, label }) => {
              const sec = typoConfig.sections[key] || { font_size_multiplier: 0, heading_color: '', body_color: '' };
              return (
                <div key={key} className="grid grid-cols-4 gap-3 items-center rounded-lg border p-3">
                  <span className="text-xs font-semibold">{label}</span>
                  <div className="flex items-center gap-1">
                    <Input type="number" step="0.1" min="0" max="3" placeholder={tr('Global')} value={sec.font_size_multiplier || ''} onChange={e => updateSection(key, 'font_size_multiplier', parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
                    <span className="text-[10px] text-muted-foreground">x</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="color" value={sec.heading_color || typoConfig.global_heading_color} onChange={e => updateSection(key, 'heading_color', e.target.value)} className="h-6 w-6 rounded border cursor-pointer shrink-0" />
                    <Input value={sec.heading_color || ''} onChange={e => updateSection(key, 'heading_color', e.target.value)} placeholder={tr('Global')} className="h-7 text-xs" />
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="color" value={sec.body_color || typoConfig.global_body_color} onChange={e => updateSection(key, 'body_color', e.target.value)} className="h-6 w-6 rounded border cursor-pointer shrink-0" />
                    <Input value={sec.body_color || ''} onChange={e => updateSection(key, 'body_color', e.target.value)} placeholder={tr('Global')} className="h-7 text-xs" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Typography Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Card Previews (mirror customer home design) ───
function TravelCardPreview({ config }: { config: CustomerAppConfig['travel_card_config'] }) {
  const bg = config.bg_image || 'https://wdzkzeahdtxlynetndqw.supabase.co/storage/v1/object/public/homepage-hero/travel-card/fallback.jpg';
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Live Preview</Label>
      <div className="mt-2 mx-auto w-full max-w-[340px] aspect-[340/280] relative overflow-hidden rounded-3xl shadow-lg bg-muted">
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${config.overlay_opacity})` }} />
        <div className="relative z-10 p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Transport & Tourism</p>
          <h3 className="mt-1 text-lg font-extrabold">Travel & Tourism</h3>
          <p className="mt-2 text-xs text-white/70 pr-12">Book buses, tours & more — all from your wallet.</p>
          <div className="mt-4 inline-flex items-center gap-3 rounded-2xl px-3 py-2" style={{ backgroundColor: config.button_bg_color || 'rgba(255,255,255,0.1)' }}>
            <span className="text-xs font-bold text-white">{config.button_text || 'Book Now'}</span>
            <ChevronRight className="h-3.5 w-3.5 text-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DailyNeedsCardPreview({ config }: { config: CustomerAppConfig['daily_needs_card_config'] }) {
  const bg = config.bg_image || 'https://wdzkzeahdtxlynetndqw.supabase.co/storage/v1/object/public/homepage-hero/daily-needs-card/fallback.jpg';
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Live Preview</Label>
      <div className="mt-2 mx-auto w-full max-w-[340px] aspect-[340/280] relative overflow-hidden rounded-3xl shadow-lg bg-muted">
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${config.overlay_opacity})` }} />
        <div className="relative z-10 p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Food & Essentials</p>
          <h3 className="mt-1 text-lg font-extrabold">Daily Needs</h3>
          <p className="mt-2 text-xs text-white/70 pr-12">Order food, pharmacy & groceries — delivered fast.</p>
          <div className="mt-4 inline-flex items-center gap-3 rounded-2xl px-3 py-2" style={{ backgroundColor: config.button_bg_color || 'rgba(255,255,255,0.1)' }}>
            <span className="text-xs font-bold text-white">{config.button_text || 'Order Now'}</span>
            <ChevronRight className="h-3.5 w-3.5 text-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Carousel Order Panel ───
function CarouselOrderPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<('travel' | 'daily_needs')[]>(
    Array.isArray(appConfig.home_carousel_order) && appConfig.home_carousel_order.length > 0
      ? appConfig.home_carousel_order
      : ['travel', 'daily_needs']
  );

  useEffect(() => {
    setOrder(
      Array.isArray(appConfig.home_carousel_order) && appConfig.home_carousel_order.length > 0
        ? appConfig.home_carousel_order
        : ['travel', 'daily_needs']
    );
  }, [appConfig]);

  const labels: Record<'travel' | 'daily_needs', { name: string; icon: React.ElementType }> = {
    travel: { name: 'Travel & Tourism', icon: Plane },
    daily_needs: { name: 'Daily Needs', icon: UtensilsCrossed },
  };

  const move = (idx: number, delta: number) => {
    const next = [...order];
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setOrder(next);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: inst } = await supabase.from('institutions').select('app_config').eq('id', institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error } = await (supabase as any).from('institutions').update({
        app_config: { ...currentAppConfig, customer_app_config: { ...customerConfig, home_carousel_order: order } }
      }).eq('id', institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-institutions-customer'] });
      toast.success('Carousel order saved');
    },
    onError: () => toast.error('Failed to save carousel order'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tr('Home Carousel Order')}</CardTitle>
        <CardDescription>{tr('Reorder the slides shown on the customer home page')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {order.map((key, idx) => {
            const Icon = labels[key].icon;
            return (
              <div key={key} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Icon className="h-4 w-4 text-primary" />
                <span className="flex-1 text-sm font-medium">{idx + 1}. {labels[key].name}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => move(idx, -1)}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === order.length - 1} onClick={() => move(idx, 1)}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Carousel Order
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Travel Card Panel ───
function TravelCardPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(appConfig.travel_card_config || defaultConfig.travel_card_config);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setConfig(appConfig.travel_card_config || defaultConfig.travel_card_config);
  }, [appConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentAppConfig, customer_app_config: { ...customerConfig, travel_card_config: config } }
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Travel card configuration saved");
    },
    onError: () => toast.error("Failed to save travel card configuration"),
  });

  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const FALLBACK_BG = 'https://wdzkzeahdtxlynetndqw.supabase.co/storage/v1/object/public/homepage-hero/travel-card/fallback.jpg';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { toast.error('Use PNG, JPG, WEBP or GIF'); return; }
    if (file.size > MAX_BYTES) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `travel-card/${institutionId}-${Date.now()}.${ext}`;
      const { publicUrl } = await adminStorageUpload({
        bucket: 'homepage-hero',
        path,
        file,
        contentType: file.type,
        upsert: true,
      });
      setConfig(prev => ({ ...prev, bg_image: publicUrl }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed — using fallback image");
      setConfig(prev => ({ ...prev, bg_image: FALLBACK_BG }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tr('Travel & Tourism Card')}</CardTitle>
        <CardDescription>{tr('Customize the travel card appearance on the customer home page')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">{tr('Show Travel card')}</Label>
            <p className="text-xs text-muted-foreground">{tr('Disable to hide the slide for this tenant')}</p>
          </div>
          <Switch checked={config.enabled !== false} onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))} />
        </div>

        <TravelCardPreview config={config} />
        {/* Background Image */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Background Image')}</Label>
          {config.bg_image && (
            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
              <img src={config.bg_image} alt={tr('Travel card bg')} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${config.overlay_opacity})` }} />
              <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setConfig(prev => ({ ...prev, bg_image: '' }))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" size="sm" className="w-full gap-1.5" asChild disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload Image</span>
              </Button>
            </label>
          </div>
        </div>

        {/* Overlay Opacity */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Dark Overlay Opacity: {Math.round(config.overlay_opacity * 100)}%</Label>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(config.overlay_opacity * 100)}
            onChange={(e) => setConfig(prev => ({ ...prev, overlay_opacity: Number(e.target.value) / 100 }))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tr('0% (transparent)')}</span>
            <span>{tr('100% (opaque)')}</span>
          </div>
        </div>

        {/* Button Text */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Text')}</Label>
          <Input value={config.button_text} onChange={(e) => setConfig(prev => ({ ...prev, button_text: e.target.value }))} placeholder={tr('Book Now')} />
        </div>

        {/* Button Background Color */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Background Color')}</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={config.button_bg_color} onChange={(e) => setConfig(prev => ({ ...prev, button_bg_color: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer" />
            <Input value={config.button_bg_color} onChange={(e) => setConfig(prev => ({ ...prev, button_bg_color: e.target.value }))} className="flex-1 font-mono text-sm" />
          </div>
        </div>

        {/* Button Size */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Size')}</Label>
          <RadioGroup value={config.button_size} onValueChange={(v) => setConfig(prev => ({ ...prev, button_size: v as 'sm' | 'md' | 'lg' }))}>
            <div className="flex gap-4">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <RadioGroupItem value={s} id={`btn-size-${s}`} />
                  <Label htmlFor={`btn-size-${s}`} className="text-sm capitalize">{s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Travel Card Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Daily Needs Card Panel ───
function DailyNeedsCardPanel({ institutionId, appConfig }: { institutionId: string; appConfig: CustomerAppConfig }) {
  const tr = useHarvestedT('admin');
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(appConfig.daily_needs_card_config || defaultConfig.daily_needs_card_config);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setConfig(appConfig.daily_needs_card_config || defaultConfig.daily_needs_card_config);
  }, [appConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: inst } = await supabase.from("institutions").select("app_config").eq("id", institutionId).single();
      const currentAppConfig = (inst as any)?.app_config || {};
      const customerConfig = currentAppConfig.customer_app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentAppConfig, customer_app_config: { ...customerConfig, daily_needs_card_config: config } }
      }).eq("id", institutionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Daily Needs card configuration saved");
    },
    onError: () => toast.error("Failed to save Daily Needs card configuration"),
  });

  const MAX_BYTES = 5 * 1024 * 1024;
  const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  const FALLBACK_BG = 'https://wdzkzeahdtxlynetndqw.supabase.co/storage/v1/object/public/homepage-hero/daily-needs-card/fallback.jpg';

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED.includes(file.type)) { toast.error('Use PNG, JPG, WEBP or GIF'); return; }
    if (file.size > MAX_BYTES) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `daily-needs-card/${institutionId}-${Date.now()}.${ext}`;
      const { publicUrl } = await adminStorageUpload({
        bucket: 'homepage-hero',
        path,
        file,
        contentType: file.type,
        upsert: true,
      });
      setConfig(prev => ({ ...prev, bg_image: publicUrl }));
      toast.success("Image uploaded");
    } catch {
      toast.error("Upload failed — using fallback image");
      setConfig(prev => ({ ...prev, bg_image: FALLBACK_BG }));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{tr('Daily Needs Card')}</CardTitle>
        <CardDescription>{tr('Customize the Daily Needs card appearance on the customer home page')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label className="text-sm font-medium">{tr('Show Daily Needs card')}</Label>
            <p className="text-xs text-muted-foreground">{tr('Disable to hide the slide for this tenant')}</p>
          </div>
          <Switch checked={config.enabled !== false} onCheckedChange={(v) => setConfig(prev => ({ ...prev, enabled: v }))} />
        </div>

        {/* Live preview */}
        <DailyNeedsCardPreview config={config} />
        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Background Image')}</Label>
          {config.bg_image && (
            <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
              <img src={config.bg_image} alt={tr('Daily Needs card bg')} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${config.overlay_opacity})` }} />
              <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setConfig(prev => ({ ...prev, bg_image: '' }))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <Button variant="outline" size="sm" className="w-full gap-1.5" asChild disabled={uploading}>
                <span>{uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload Image</span>
              </Button>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Dark Overlay Opacity: {Math.round(config.overlay_opacity * 100)}%</Label>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(config.overlay_opacity * 100)}
            onChange={(e) => setConfig(prev => ({ ...prev, overlay_opacity: Number(e.target.value) / 100 }))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tr('0% (transparent)')}</span>
            <span>{tr('100% (opaque)')}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Text')}</Label>
          <Input value={config.button_text} onChange={(e) => setConfig(prev => ({ ...prev, button_text: e.target.value }))} placeholder={tr('Order Now')} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Background Color')}</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={config.button_bg_color} onChange={(e) => setConfig(prev => ({ ...prev, button_bg_color: e.target.value }))} className="h-9 w-12 rounded border border-border cursor-pointer" />
            <Input value={config.button_bg_color} onChange={(e) => setConfig(prev => ({ ...prev, button_bg_color: e.target.value }))} className="flex-1 font-mono text-sm" />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">{tr('Button Size')}</Label>
          <RadioGroup value={config.button_size} onValueChange={(v) => setConfig(prev => ({ ...prev, button_size: v as 'sm' | 'md' | 'lg' }))}>
            <div className="flex gap-4">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <div key={s} className="flex items-center gap-1.5">
                  <RadioGroupItem value={s} id={`dn-btn-size-${s}`} />
                  <Label htmlFor={`dn-btn-size-${s}`} className="text-sm capitalize">{s === 'sm' ? 'Small' : s === 'md' ? 'Medium' : 'Large'}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
          {saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Daily Needs Card Settings
        </Button>
      </CardContent>
    </Card>
  );
}



// ─── Main Component ───
export default function CustomerAppManagement() {
  const tr = useHarvestedT('admin');
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: institutions = [], isLoading: loadingInstitutions } = useInstitutions();
  const { data: linkedAccounts = [], isLoading: loadingLinked } = useLinkedAccounts(selectedInstitution);
  const { data: accounts = [], isLoading: loadingAccounts } = useInstitutionAccounts(selectedInstitution);
  const { data: transactions = [], isLoading: loadingTxns } = useInstitutionTransactions(selectedInstitution);
  const { data: piggyPlans = [], isLoading: loadingPiggy } = useInstitutionPiggyBank(selectedInstitution);
  const { data: njangiGroups = [], isLoading: loadingNjangi } = useInstitutionNjangi(selectedInstitution);
  const { data: virtualCards = [], isLoading: loadingCards } = useInstitutionCards(selectedInstitution);
  const { data: creditScores = [], isLoading: loadingCredit } = useInstitutionCreditScores(selectedInstitution);

  const filteredInstitutions = institutions.filter((i: any) =>
    i.institution_name?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedInst = institutions.find((i: any) => i.id === selectedInstitution) as any;

  const totalBalance = accounts.reduce((sum: number, acc: any) => sum + (acc.account_balances?.[0]?.amount || 0), 0);

  const selectedAppConfig = (() => {
    const raw = selectedInst?.app_config?.customer_app_config || {};
    return selectedInst
      ? {
          ...defaultConfig,
          ...raw,
          features: { ...defaultConfig.features, ...(raw.features || {}) },
          section_order: Array.isArray(raw.section_order) ? raw.section_order : defaultSectionOrder,
          layout_style: raw.layout_style || 'modern',
          media_sections: raw.media_sections || [],
          walkthrough_config: raw.walkthrough_config || { skip_enabled: true },
          card_colors: raw.card_colors || {},
          cashout_methods: { ...defaultConfig.cashout_methods, ...(raw.cashout_methods || {}) },
          cashout_limits: { ...defaultConfig.cashout_limits, ...(raw.cashout_limits || {}) },
          rewards_config: { ...defaultRewardsConfig, ...(raw.rewards_config || {}) },
          typography_config: { ...defaultConfig.typography_config, ...(raw.typography_config || {}), sections: { ...defaultConfig.typography_config.sections, ...(raw.typography_config?.sections || {}) } },
        }
      : defaultConfig;
  })();

  const [walkthroughConfig, setWalkthroughConfig] = useState<WalkthroughConfig>(selectedAppConfig.walkthrough_config);
  useEffect(() => { setWalkthroughConfig(selectedAppConfig.walkthrough_config); }, [selectedInstitution]);

  const queryClient = useQueryClient();
  const saveWalkthroughConfig = useMutation({
    mutationFn: async () => {
      const currentConfig = selectedInst?.app_config || {};
      const customerConfig = currentConfig.customer_app_config || {};
      const { error } = await (supabase as any).from("institutions").update({
        app_config: { ...currentConfig, customer_app_config: { ...customerConfig, walkthrough_config: walkthroughConfig } }
      }).eq("id", selectedInstitution);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-institutions-customer"] });
      toast.success("Walkthrough config saved");
    },
    onError: () => toast.error("Failed to save"),
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Users} title={tr('Customer App Management')} description={tr('Monitor customer accounts, features, and app activity')} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Institution List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('Institutions')}</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder={tr('Search...')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingInstitutions ? (
                <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredInstitutions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-6">{tr('No institutions found')}</p>
              ) : (
                filteredInstitutions.map((inst: any) => (
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
                <h3 className="text-lg font-medium">{tr('Select an Institution')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{tr('Choose an institution from the left to manage its customer app')}</p>
              </CardContent>
            </Card>
          ) : (
            <>
               {/* Institution Header */}
              <Card className="border-primary/20 bg-primary/5">
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
                    <p className="text-xs font-medium text-primary">{tr('Customer Mobile App Configuration')}</p>
                    <p className="text-sm text-muted-foreground capitalize">{selectedInst?.institution_type} · Created {selectedInst?.created_at ? format(new Date(selectedInst.created_at), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.open(`${API_CONFIG.SITE_URL}/app/${selectedInstitution}/home`, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5" /> Open Customer App
                  </Button>
                  <Badge variant={selectedInst?.status === "approved" ? "default" : "secondary"}>{selectedInst?.status}</Badge>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label={tr('Active Customers')} value={linkedAccounts.filter((a: any) => a.account_type !== 'none').length} color="bg-blue-500" />
                <StatCard icon={Phone} label={tr('MoMo Orange Users')} value={linkedAccounts.filter((a: any) => a.account_type === 'momo_orange').length} color="bg-orange-500" />
                <StatCard icon={Phone} label={tr('MoMo MTN Users')} value={linkedAccounts.filter((a: any) => a.account_type === 'momo_mtn').length} color="bg-amber-500" />
                <StatCard icon={Landmark} label={tr('Bank-Linked Users')} value={linkedAccounts.filter((a: any) => a.account_type === 'bank').length} color="bg-emerald-500" />
                <StatCard icon={Lock} label={tr('View-Only Users')} value={linkedAccounts.filter((a: any) => a.account_type === 'none').length} color="bg-slate-500" />
                <StatCard icon={Home} label={tr('Piggy Plans')} value={piggyPlans.length} color="bg-emerald-600" />
                <StatCard icon={Users} label={tr('Njangi Groups')} value={njangiGroups.length} color="bg-violet-600" />
                <StatCard icon={BarChart3} label={tr('Avg Credit Score')} value={creditScores.length > 0 ? Math.round(creditScores.reduce((s: number, c: any) => s + c.score, 0) / creditScores.length) : '—'} color="bg-pink-500" />
              </div>

              {/* Tabs */}
              <Tabs defaultValue="linked">
                <TabsList className="w-full justify-start flex-wrap h-auto">
                  <TabsTrigger value="linked" className="gap-1.5"><UserCheck className="h-3.5 w-3.5" /> {tr('Linked Accounts')}</TabsTrigger>
                  <TabsTrigger value="accounts" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {tr('Customer Accounts')}</TabsTrigger>
                  <TabsTrigger value="transactions" className="gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> {tr('Customer Transactions')}</TabsTrigger>
                  <TabsTrigger value="piggybank" className="gap-1.5"><PiggyBank className="h-3.5 w-3.5" /> {tr('Piggy Bank')}</TabsTrigger>
                  <TabsTrigger value="njangi" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {tr('Njangi')}</TabsTrigger>
                  <TabsTrigger value="cards" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> {tr('Customer Cards')}</TabsTrigger>
                  <TabsTrigger value="credit" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> {tr('Credit Scores')}</TabsTrigger>
                  <TabsTrigger value="features" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> {tr('Features')}</TabsTrigger>
                  <TabsTrigger value="walkthrough" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {tr('Walkthrough')}</TabsTrigger>
                  <TabsTrigger value="hero" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> {tr('Hero Section')}</TabsTrigger>
                  <TabsTrigger value="typography" className="gap-1.5"><Palette className="h-3.5 w-3.5" /> {tr('Typography')}</TabsTrigger>
                  <TabsTrigger value="travel-card" className="gap-1.5"><Plane className="h-3.5 w-3.5" /> {tr('Travel Card')}</TabsTrigger>
                  <TabsTrigger value="daily-needs-card" className="gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5" /> {tr('Daily Needs Card')}</TabsTrigger>
                  <TabsTrigger value="carousel-order" className="gap-1.5"><GripVertical className="h-3.5 w-3.5" /> {tr('Carousel Order')}</TabsTrigger>
                  <TabsTrigger value="storefront" className="gap-1.5"><Store className="h-3.5 w-3.5" /> {tr('Storefronts')}</TabsTrigger>
                </TabsList>

                {/* Linked Accounts Tab */}
                <TabsContent value="linked">
                  <Card>
                    <CardContent className="p-0">
                      {loadingLinked ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : linkedAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <UserCheck className="h-10 w-10 text-muted-foreground/40 mb-3" />
                          <p className="text-sm font-medium">{tr('No customers have linked accounts yet')}</p>
                          <p className="text-xs text-muted-foreground mt-1 max-w-sm">{tr('Share your customer app link to get started:')}</p>
                          <code className="mt-2 rounded bg-muted px-3 py-1.5 text-xs font-mono text-primary select-all">{API_CONFIG.SITE_URL}/app/{selectedInstitution}/home</code>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Customer')}</TableHead><TableHead>{tr('Phone')}</TableHead><TableHead>{tr('Account Type')}</TableHead><TableHead>{tr('Account Number')}</TableHead><TableHead>{tr('Status')}</TableHead><TableHead>{tr('Linked')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {linkedAccounts.map((la: any) => (
                              <TableRow key={la.id}>
                                <TableCell className="font-medium">{la.profiles?.full_name || la.profiles?.email || '—'}</TableCell>
                                <TableCell className="text-sm">{la.profiles?.phone_number || '—'}</TableCell>
                                <TableCell>
                                  <Badge variant={la.account_type === 'none' ? 'secondary' : 'default'} className="text-xs capitalize">
                                    {la.account_type === 'momo_orange' ? 'Orange Money' : la.account_type === 'momo_mtn' ? 'MTN MoMo' : la.account_type === 'none' ? 'View Only' : la.account_type?.replace('_', ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{la.account_number || '—'}</TableCell>
                                <TableCell><Badge variant={la.is_active ? "default" : "secondary"} className="text-xs">{la.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                                <TableCell className="text-sm">{la.created_at ? format(new Date(la.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Accounts Tab */}
                <TabsContent value="accounts">
                  <Card>
                    <CardContent className="p-0">
                      {loadingAccounts ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
                          <p className="text-sm font-medium">{tr('No customer accounts found')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{tr('Customer accounts will appear here once users link their accounts via the customer app.')}</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Account Holder')}</TableHead><TableHead>{tr('Account ID')}</TableHead><TableHead>{tr('Type')}</TableHead><TableHead>{tr('Currency')}</TableHead><TableHead className="text-right">{tr('Balance')}</TableHead><TableHead>{tr('Status')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {accounts.map((acc: any) => (
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
                        <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                          <ArrowRightLeft className="h-10 w-10 text-muted-foreground/40 mb-3" />
                          <p className="text-sm font-medium">{tr('No customer transactions found')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{tr('Transactions from customer app users will appear here.')}</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Date')}</TableHead><TableHead>{tr('Reference')}</TableHead><TableHead>{tr('Description')}</TableHead><TableHead>{tr('Type')}</TableHead><TableHead className="text-right">{tr('Amount')}</TableHead><TableHead>{tr('Status')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {transactions.map((txn: any) => (
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

                {/* Piggy Bank Tab */}
                <TabsContent value="piggybank">
                  <Card>
                    <CardContent className="p-0">
                      {loadingPiggy ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : piggyPlans.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">{tr('No piggy bank plans found')}</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Plan Name')}</TableHead><TableHead className="text-right">{tr('Target')}</TableHead><TableHead className="text-right">{tr('Saved')}</TableHead><TableHead>{tr('Frequency')}</TableHead><TableHead>{tr('Status')}</TableHead><TableHead>{tr('Created')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {piggyPlans.map((plan: any) => (
                              <TableRow key={plan.id}>
                                <TableCell className="font-medium">{plan.plan_name || 'Unnamed'}</TableCell>
                                <TableCell className="text-right">{Number(plan.target_amount || 0).toLocaleString()} XAF</TableCell>
                                <TableCell className="text-right font-medium">{Number(plan.current_amount || 0).toLocaleString()} XAF</TableCell>
                                <TableCell className="capitalize text-sm">{plan.frequency || '—'}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs capitalize">{plan.status}</Badge></TableCell>
                                <TableCell className="text-sm">{plan.created_at ? format(new Date(plan.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Njangi Tab */}
                <TabsContent value="njangi">
                  <Card>
                    <CardContent className="p-0">
                      {loadingNjangi ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : njangiGroups.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">{tr('No Njangi groups found')}</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Group Name')}</TableHead><TableHead>{tr('Members')}</TableHead><TableHead className="text-right">{tr('Contribution')}</TableHead><TableHead>{tr('Frequency')}</TableHead><TableHead>{tr('Status')}</TableHead><TableHead>{tr('Created')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {njangiGroups.map((group: any) => (
                              <TableRow key={group.id}>
                                <TableCell className="font-medium">{group.group_name}</TableCell>
                                <TableCell>{group.njangi_members?.length || 0}</TableCell>
                                <TableCell className="text-right">{Number(group.contribution_amount || 0).toLocaleString()} XAF</TableCell>
                                <TableCell className="capitalize text-sm">{group.frequency || '—'}</TableCell>
                                <TableCell><Badge variant="outline" className="text-xs capitalize">{group.status}</Badge></TableCell>
                                <TableCell className="text-sm">{group.created_at ? format(new Date(group.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Cards Tab */}
                <TabsContent value="cards">
                  <Card>
                    <CardContent className="p-0">
                      {loadingCards ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : virtualCards.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">{tr('No virtual cards found')}</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('Card Number')}</TableHead><TableHead>{tr('Type')}</TableHead><TableHead>{tr('Provider')}</TableHead><TableHead>{tr('Status')}</TableHead><TableHead>{tr('Created')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {virtualCards.map((card: any) => (
                              <TableRow key={card.id}>
                                <TableCell className="font-mono text-sm">**** {card.last_four || card.card_number?.slice(-4) || '****'}</TableCell>
                                <TableCell className="capitalize text-sm">{card.card_type || '—'}</TableCell>
                                <TableCell className="capitalize text-sm">{card.provider || '—'}</TableCell>
                                <TableCell><Badge variant={card.status === 'active' ? "default" : "secondary"} className="text-xs capitalize">{card.status}</Badge></TableCell>
                                <TableCell className="text-sm">{card.created_at ? format(new Date(card.created_at), "MMM d, yyyy") : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Credit Scores Tab */}
                <TabsContent value="credit">
                  <Card>
                    <CardContent className="p-0">
                      {loadingCredit ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : creditScores.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-8">{tr('No credit scores found')}</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>{tr('User ID')}</TableHead><TableHead>{tr('Score')}</TableHead><TableHead>{tr('Category')}</TableHead><TableHead>{tr('Change')}</TableHead><TableHead>{tr('Calculated')}</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {creditScores.map((cs: any) => (
                              <TableRow key={cs.id}>
                                <TableCell className="font-mono text-xs">{cs.user_id?.slice(0, 8)}...</TableCell>
                                <TableCell className="font-bold text-lg">{cs.score}</TableCell>
                                <TableCell><Badge variant={cs.score >= 700 ? "default" : cs.score >= 500 ? "secondary" : "destructive"} className="text-xs capitalize">{cs.category || (cs.score >= 700 ? 'Good' : cs.score >= 500 ? 'Fair' : 'Poor')}</Badge></TableCell>
                                <TableCell className={cs.score_change > 0 ? 'text-emerald-600' : cs.score_change < 0 ? 'text-red-500' : ''}>
                                  {cs.score_change > 0 ? '+' : ''}{cs.score_change || 0}
                                </TableCell>
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
                  <FeatureConfigPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Walkthrough Tab */}
                <TabsContent value="walkthrough">
                  <WalkthroughManager
                    institutionId={selectedInstitution!}
                    walkthroughConfig={walkthroughConfig}
                    onConfigChange={setWalkthroughConfig}
                  />
                  <Button onClick={() => saveWalkthroughConfig.mutate()} disabled={saveWalkthroughConfig.isPending} className="mt-4 w-full">
                    {saveWalkthroughConfig.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Walkthrough Config
                  </Button>
                </TabsContent>

                {/* Hero Section Tab */}
                <TabsContent value="hero">
                  <HeroSectionPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Typography Tab */}
                <TabsContent value="typography">
                  <TypographyPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Travel Card Tab */}
                <TabsContent value="travel-card">
                  <TravelCardPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Daily Needs Card Tab */}
                <TabsContent value="daily-needs-card">
                  <DailyNeedsCardPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>

                {/* Carousel Order Tab */}
                <TabsContent value="carousel-order">
                  <CarouselOrderPanel institutionId={selectedInstitution!} appConfig={selectedAppConfig} />
                </TabsContent>




                {/* Storefront Tab */}
                <TabsContent value="storefront">
                  <AdminStorefrontSlider />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
