import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { translations as staticTranslations } from "@/lib/i18n/translations";
import { scanAllSourceStrings, type ScanReport } from "@/lib/i18n/sourceStringScanner";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Languages,
  Loader2,
  Pencil,
  Trash2,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Filter,
  ScanSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface TranslationString {
  id: string;
  string_key: string;
  category: string;
  default_value: string;
  description: string | null;
  context: string | null;
  created_at: string;
  updated_at: string;
}

interface TranslationValue {
  id: string;
  string_id: string;
  language: string;
  value: string;
  is_auto_translated: boolean;
  translated_at: string;
}

const CATEGORIES = [
  "general",
  "navigation",
  "auth",
  "dashboard",
  "crediq",
  "payments",
  "settings",
  "errors",
  "notifications",
  "admin",
  "forms",
  "landing",
  "profile",
  "kyc",
  "njangi",
  "merchant",
  "compliance",
  "openbanking",
  "investor",
  "staff",
  "postiq",
  "finance",
];

export default function TranslationManager() {
  const { toast } = useToast();
  const [strings, setStrings] = useState<TranslationString[]>([]);
  const [translations, setTranslations] = useState<TranslationValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingString, setEditingString] = useState<TranslationString | null>(null);
  const [translatingIds, setTranslatingIds] = useState<Set<string>>(new Set());
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [scanning, setScanning] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formDefaultValue, setFormDefaultValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContext, setFormContext] = useState("");
  const [formFrenchValue, setFormFrenchValue] = useState("");

  // Inline editing
  const [editingTranslation, setEditingTranslation] = useState<{
    stringId: string;
    language: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchAllRows = async (tableName: string, buildQuery: () => any) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      // Build a fresh query each iteration to avoid mutating the same builder
      const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (data) allData = allData.concat(data);
      hasMore = data && data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    return allData;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [stringsData, valuesData] = await Promise.all([
        fetchAllRows("translation_strings", () =>
          supabase.from("translation_strings").select("*").order("category").order("string_key")
        ),
        fetchAllRows("translation_values", () =>
          supabase.from("translation_values").select("*")
        ),
      ]);
      setStrings((stringsData as TranslationString[]) || []);
      setTranslations((valuesData as TranslationValue[]) || []);
    } catch (e) {
      console.error("Failed to fetch translation data:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getTranslation = (stringId: string, language: string) =>
    translations.find(
      (t) => t.string_id === stringId && t.language === language
    );

  const filteredStrings = useMemo(() => {
    return strings.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.string_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.default_value.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" || s.category === categoryFilter;
      if (statusFilter === "all") return matchesSearch && matchesCategory;
      const hasFr = !!getTranslation(s.id, "fr");
      if (statusFilter === "translated") return matchesSearch && matchesCategory && hasFr;
      if (statusFilter === "untranslated") return matchesSearch && matchesCategory && !hasFr;
      return matchesSearch && matchesCategory;
    });
  }, [strings, searchQuery, categoryFilter, statusFilter, translations]);

  const stats = useMemo(() => {
    const total = strings.length;
    const translated = strings.filter((s) => getTranslation(s.id, "fr")).length;
    const autoTranslated = translations.filter(
      (t) => t.language === "fr" && t.is_auto_translated
    ).length;
    return { total, translated, untranslated: total - translated, autoTranslated };
  }, [strings, translations]);

  const handleSaveString = async () => {
    if (!formKey || !formDefaultValue) {
      toast({ title: "Required fields", description: "Key and default value are required", variant: "destructive" });
      return;
    }

    if (editingString) {
      const { error } = await supabase
        .from("translation_strings")
        .update({
          string_key: formKey,
          category: formCategory,
          default_value: formDefaultValue,
          description: formDescription || null,
          context: formContext || null,
        })
        .eq("id", editingString.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase.from("translation_strings").insert({
        string_key: formKey,
        category: formCategory,
        default_value: formDefaultValue,
        description: formDescription || null,
        context: formContext || null,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    // Save French translation if provided
    if (formFrenchValue.trim()) {
      const targetId = editingString?.id;
      if (targetId) {
        await supabase.from("translation_values").upsert(
          { string_id: targetId, language: "fr", value: formFrenchValue.trim(), is_auto_translated: false },
          { onConflict: "string_id,language" }
        );
      } else {
        // For new strings, fetch the newly created string id
        const { data: newStr } = await supabase
          .from("translation_strings")
          .select("id")
          .eq("string_key", formKey)
          .maybeSingle();
        if (newStr) {
          await supabase.from("translation_values").upsert(
            { string_id: newStr.id, language: "fr", value: formFrenchValue.trim(), is_auto_translated: false },
            { onConflict: "string_id,language" }
          );
        }
      }
    }

    toast({ title: "Saved" });
    resetForm();
    setShowAddDialog(false);
    setEditingString(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("translation_strings").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted" });
      fetchData();
    }
  };

  const handleTranslateOne = async (str: TranslationString) => {
    setTranslatingIds((prev) => new Set(prev).add(str.id));
    try {
      const { data, error } = await supabase.functions.invoke("translate-strings", {
        body: {
          strings: [{ key: str.string_key, value: str.default_value }],
          target_language: "fr",
        },
      });
      if (error) throw error;
      const translated = data?.translations?.[str.string_key];
      if (translated) {
        await supabase.from("translation_values").upsert(
          {
            string_id: str.id,
            language: "fr",
            value: translated,
            is_auto_translated: true,
            translated_at: new Date().toISOString(),
          },
          { onConflict: "string_id,language" }
        );
        toast({ title: "Translated", description: `"${str.string_key}" → French` });
        fetchData();
      }
    } catch (e: any) {
      toast({ title: "Translation failed", description: e.message, variant: "destructive" });
    } finally {
      setTranslatingIds((prev) => {
        const next = new Set(prev);
        next.delete(str.id);
        return next;
      });
    }
  };

  const handleBulkTranslate = async () => {
    const untranslated = strings.filter((s) => !getTranslation(s.id, "fr"));
    if (!untranslated.length) {
      toast({ title: "All translated", description: "All strings already have French translations" });
      return;
    }

    setBulkTranslating(true);
    setBulkProgress({ done: 0, total: untranslated.length });
    let totalTranslated = 0;
    let totalFailed = 0;

    try {
      const batchSize = 15;
      const delayBetweenBatches = 2500; // 2.5s delay to avoid rate limits

      for (let i = 0; i < untranslated.length; i += batchSize) {
        const batch = untranslated.slice(i, i + batchSize);
        
        // Retry logic: up to 3 attempts per batch
        let attempts = 0;
        let success = false;
        
        while (attempts < 3 && !success) {
          attempts++;
          try {
            const { data, error } = await supabase.functions.invoke("translate-strings", {
              body: {
                strings: batch.map((s) => ({ key: s.string_key, value: s.default_value })),
                target_language: "fr",
              },
            });

            if (error) {
              // Check for rate limit
              if (error.message?.includes("429") || error.message?.includes("Rate limit")) {
                console.warn(`Rate limited on batch ${i / batchSize + 1}, waiting 10s...`);
                await new Promise((r) => setTimeout(r, 10000));
                continue;
              }
              throw error;
            }

            const translated = data?.translations || {};
            const upserts = batch
              .filter((s) => translated[s.string_key])
              .map((s) => ({
                string_id: s.id,
                language: "fr",
                value: translated[s.string_key],
                is_auto_translated: true,
                translated_at: new Date().toISOString(),
              }));

            if (upserts.length) {
              await supabase
                .from("translation_values")
                .upsert(upserts, { onConflict: "string_id,language" });
              totalTranslated += upserts.length;
            }
            totalFailed += batch.length - upserts.length;
            success = true;
          } catch (batchErr: any) {
            if (attempts >= 3) {
              console.error(`Batch ${i / batchSize + 1} failed after 3 attempts:`, batchErr);
              totalFailed += batch.length;
            } else {
              await new Promise((r) => setTimeout(r, 5000));
            }
          }
        }

        setBulkProgress({ done: Math.min(i + batchSize, untranslated.length), total: untranslated.length });

        // Delay between batches to respect rate limits
        if (i + batchSize < untranslated.length) {
          await new Promise((r) => setTimeout(r, delayBetweenBatches));
        }
      }

      toast({
        title: "Bulk translation complete",
        description: `${totalTranslated} translated, ${totalFailed} failed out of ${untranslated.length}`,
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "Bulk translation failed", description: e.message, variant: "destructive" });
    } finally {
      setBulkTranslating(false);
      setBulkProgress({ done: 0, total: 0 });
    }
  };

  const handleScanAllStrings = async () => {
    setScanning(true);
    setScanReport(null);
    try {
      // ---------- Stage 1: scan static dictionary --------------------------
      const enStrings = staticTranslations.en;
      const dictBatch = (Object.keys(enStrings) as (keyof typeof enStrings)[]).map((key) => {
        const keyStr = String(key);
        const category = keyStr.includes('.') ? keyStr.split('.')[0] : inferCategory(keyStr);
        return { key: keyStr, default_value: enStrings[key], category };
      });

      // ---------- Stage 2: deep-scan source code (every .tsx/.ts) ----------
      const report = scanAllSourceStrings();
      const sourceBatch = report.strings.map((s) => ({
        key: s.key,
        default_value: s.default_value,
        category: s.category,
        context: s.context,
      }));

      const allBatch = [...dictBatch, ...sourceBatch];

      // ---------- Stage 3: register in chunks of 50 ------------------------
      let totalRegistered = 0;
      const chunkSize = 50;
      for (let i = 0; i < allBatch.length; i += chunkSize) {
        const chunk = allBatch.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke('register-translation-strings', {
          body: { strings: chunk },
        });
        if (error) {
          console.error("Register batch error:", error);
          continue; // keep going on partial failure
        }
        totalRegistered += data?.registered || 0;
      }

      // ---------- Stage 4: surface a useful report -------------------------
      setScanReport(report);
      toast({
        title: "Scan & Sync Complete",
        description: `${totalRegistered} new strings registered. Scanned ${report.filesScanned} files, found ${report.uniqueStrings} unique source strings. Auto-translation runs in the background.`,
      });
      fetchData();
    } catch (e: any) {
      console.error("Scan error:", e);
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  // Infer category from key name
  function inferCategory(key: string): string {
    const k = key.toLowerCase();
    if (/^(home|about|developer|contact|dashboard|admin|fiPortal|signIn|signOut|menu|more|overview|help|alerts|scan|wallet)$/i.test(key)) return 'navigation';
    if (/^(hero|getStarted|viewDocs|footerTagline|quickLinks|legal|privacy|terms|cookies|copyright|allRightsReserved|poweredBy|followUs|newsletter|subscribe)$/i.test(key)) return 'landing';
    if (/^(email|password|confirmPassword|forgotPassword|resetPassword|createAccount|signUp|signIn|verifyEmail|login|logout|twoFactor|enterCode|biometric|fingerprint|faceId|pin|changePassword|currentPassword|newPassword|rememberMe|staySignedIn|welcomeBack)$/i.test(key)) return 'auth';
    if (k.includes('credit') || k.includes('score') || k.includes('crediq') || k.includes('factor') || k.includes('onboarding') || k.includes('improvement')) return 'crediq';
    if (k.includes('transfer') || k.includes('payment') || k.includes('mobile') || k.includes('bank') || k.includes('card') || k.includes('invoice') || k.includes('refund') || k.includes('checkout')) return 'payments';
    if (k.includes('kyc') || k.includes('verification') || k.includes('document') || k.includes('identity') || k.includes('selfie')) return 'kyc';
    if (k.includes('njangi') || k.includes('group') || k.includes('contribution')) return 'njangi';
    if (k.includes('merchant') || k.includes('gateway') || k.includes('pos') || k.includes('woocommerce') || k.includes('shopify')) return 'merchant';
    if (k.includes('aml') || k.includes('sanction') || k.includes('pep') || k.includes('suspicious') || k.includes('compliance') || k.includes('risk')) return 'compliance';
    if (k.includes('consent') || k.includes('openBanking') || k.includes('tpp') || k.includes('client') || k.includes('token') || k.includes('scope')) return 'openbanking';
    if (k.includes('investor') || k.includes('revenue') || k.includes('growth') || k.includes('funding') || k.includes('valuation') || k.includes('market')) return 'investor';
    if (k.includes('setting') || k.includes('theme') || k.includes('appearance') || k.includes('notification') || k.includes('preference') || k.includes('language') || k.includes('dark') || k.includes('light')) return 'settings';
    if (k.includes('error') || k.includes('failed') || k.includes('denied') || k.includes('notFound') || k.includes('serverError') || k.includes('somethingWent')) return 'errors';
    if (k.includes('notification') || k.includes('toast') || k.includes('alert') || k.includes('saved') || k.includes('deleted') || k.includes('created') || k.includes('updated')) return 'notifications';
    if (k.includes('profile') || k.includes('firstName') || k.includes('lastName') || k.includes('phone') || k.includes('address') || k.includes('gender') || k.includes('nationality')) return 'profile';
    if (k.includes('staff') || k.includes('department') || k.includes('payroll') || k.includes('attendance')) return 'staff';
    if (k.includes('admin') || k.includes('manage') || k.includes('system') || k.includes('maintenance') || k.includes('approval')) return 'admin';
    if (k.includes('dashboard') || k.includes('balance') || k.includes('spending') || k.includes('savings') || k.includes('budget') || k.includes('netWorth')) return 'dashboard';
    if (k.includes('postiq') || k.includes('postal') || k.includes('geolocation') || k.includes('mapView')) return 'postiq';
    if (k.includes('exchange') || k.includes('currency') || k.includes('xaf') || k.includes('usd') || k.includes('eur') || k.includes('interest') || k.includes('principal')) return 'finance';
    return 'general';
  }

  const handleSaveInlineTranslation = async () => {
    if (!editingTranslation) return;
    const { stringId, language } = editingTranslation;
    await supabase.from("translation_values").upsert(
      {
        string_id: stringId,
        language,
        value: editValue,
        is_auto_translated: false,
        translated_at: new Date().toISOString(),
      },
      { onConflict: "string_id,language" }
    );
    setEditingTranslation(null);
    fetchData();
  };

  const resetForm = () => {
    setFormKey("");
    setFormCategory("general");
    setFormDefaultValue("");
    setFormDescription("");
    setFormContext("");
    setFormFrenchValue("");
  };

  const openEdit = (str: TranslationString) => {
    setEditingString(str);
    setFormKey(str.string_key);
    setFormCategory(str.category);
    setFormDefaultValue(str.default_value);
    setFormDescription(str.description || "");
    setFormContext(str.context || "");
    const existingFr = getTranslation(str.id, "fr");
    setFormFrenchValue(existingFr?.value || "");
    setShowAddDialog(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
      <AdminPageHeader icon={Languages} title="Translation Manager" description="Manage multilingual content and translation workflows" />
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary"  />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleScanAllStrings}
            disabled={scanning}
            className="gap-2"
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="h-4 w-4" />
            )}
            {scanning ? "Scanning..." : "Scan & Sync All Strings"}
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkTranslate}
            disabled={bulkTranslating}
            className="gap-2"
          >
            {bulkTranslating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {bulkTranslating && bulkProgress.total > 0
              ? `Translating ${bulkProgress.done}/${bulkProgress.total}...`
              : "Translate All to French"}
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(o) => { setShowAddDialog(o); if (!o) { resetForm(); setEditingString(null); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add String
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingString ? "Edit String" : "Add New String"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>String Key *</Label>
                  <Input
                    placeholder="e.g. nav.dashboard"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Value (English) *</Label>
                  <Textarea
                    placeholder="The English text"
                    value={formDefaultValue}
                    onChange={(e) => setFormDefaultValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    placeholder="Where is this string used?"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Context</Label>
                  <Input
                    placeholder="e.g. button label, page title"
                    value={formContext}
                    onChange={(e) => setFormContext(e.target.value)}
                  />
                </div>
                <div>
                  <Label>French Translation</Label>
                  <Textarea
                    placeholder="Traduction française"
                    value={formFrenchValue}
                    onChange={(e) => setFormFrenchValue(e.target.value)}
                  />
                </div>
                <Button onClick={handleSaveString} className="w-full">
                  {editingString ? "Update" : "Add"} String
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Strings", value: stats.total, icon: Languages, color: "text-primary" },
          { label: "Translated (FR)", value: stats.translated, icon: CheckCircle2, color: "text-green-500" },
          { label: "Untranslated", value: stats.untranslated, icon: AlertCircle, color: "text-amber-500" },
          { label: "Auto-Translated", value: stats.autoTranslated, icon: Wand2, color: "text-blue-500" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <span className="text-2xl font-bold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keys or values…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="translated">Translated</SelectItem>
              <SelectItem value="untranslated">Untranslated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Key</TableHead>
                <TableHead>English (Default)</TableHead>
                <TableHead>French</TableHead>
                <TableHead className="w-[100px]">Category</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStrings.map((str) => {
                const frTranslation = getTranslation(str.id, "fr");
                const isTranslating = translatingIds.has(str.id);
                const isEditingThis =
                  editingTranslation?.stringId === str.id &&
                  editingTranslation?.language === "fr";

                return (
                  <TableRow key={str.id}>
                    <TableCell>
                      <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {str.string_key}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      {str.default_value}
                    </TableCell>
                    <TableCell>
                      {isEditingThis ? (
                        <div className="flex gap-1">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveInlineTranslation();
                              if (e.key === "Escape") setEditingTranslation(null);
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={handleSaveInlineTranslation}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : frTranslation ? (
                        <div
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => {
                            setEditingTranslation({ stringId: str.id, language: "fr" });
                            setEditValue(frTranslation.value);
                          }}
                        >
                          <span className="text-sm max-w-[200px] truncate">
                            {frTranslation.value}
                          </span>
                          {frTranslation.is_auto_translated && (
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              AI
                            </Badge>
                          )}
                          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Not translated
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {str.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleTranslateOne(str)}
                          disabled={isTranslating}
                          title="AI Translate"
                        >
                          {isTranslating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(str)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(str.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredStrings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    {strings.length === 0
                      ? "No translation strings yet. Add your first string to get started."
                      : "No strings match your filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
