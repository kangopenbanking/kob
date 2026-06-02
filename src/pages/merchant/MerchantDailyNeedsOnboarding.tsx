import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Upload, ShieldCheck,
  Store as StoreIcon, Pill, UtensilsCrossed, FileText, MapPin, Clock,
} from "lucide-react";

type Vertical = "food" | "pharmacy";

interface StoreDraft {
  id?: string;
  merchant_id: string;
  vertical: Vertical;
  name: string;
  slug: string;
  description: string;
  contact_phone: string;
  address: string;
  delivery_radius_km: number;
  preparation_time_min: number;
  delivery_modes: ("delivery" | "pickup")[];
  service_areas: string[];

  // pharmacy-only
  pharmacy_license_number: string;
  pharmacy_license_url: string;
  pharmacy_license_expires_on: string;
  pharmacist_in_charge_name: string;
  pharmacist_in_charge_license: string;
  pharmacist_in_charge_phone: string;
  otc_enabled: boolean;
  rx_enabled: boolean;
  controlled_substances_allowed: boolean;
  cold_chain_capable: boolean;
}

const empty = (merchantId: string, vertical: Vertical): StoreDraft => ({
  merchant_id: merchantId,
  vertical,
  name: "",
  slug: "",
  description: "",
  contact_phone: "",
  address: "",
  delivery_radius_km: 5,
  preparation_time_min: 20,
  delivery_modes: ["delivery"],
  service_areas: [],
  pharmacy_license_number: "",
  pharmacy_license_url: "",
  pharmacy_license_expires_on: "",
  pharmacist_in_charge_name: "",
  pharmacist_in_charge_license: "",
  pharmacist_in_charge_phone: "",
  otc_enabled: true,
  rx_enabled: false,
  controlled_substances_allowed: false,
  cold_chain_capable: false,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function MerchantDailyNeedsOnboarding() {
  const navigate = useNavigate();
  const params = useParams<{ storeId?: string }>();
  const [search] = useSearchParams();
  const { user } = useAuthenticatedUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string>("pending");
  const [areaInput, setAreaInput] = useState("");

  const isPharmacy = draft?.vertical === "pharmacy";
  const steps = useMemo(
    () => (isPharmacy
      ? ["Storefront", "Location & hours", "Pharmacy capabilities", "Pharmacist-in-charge", "License & review"]
      : ["Storefront", "Location & hours", "Service & delivery", "Review"]),
    [isPharmacy],
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: merchants } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user.id).limit(1);
      const mid = merchants?.[0]?.id;
      if (!mid) {
        toast({ title: "Merchant account required", description: "Complete KYB before opening a Daily Needs store." });
        navigate("/merchant/daily-needs");
        return;
      }
      setMerchantId(mid);

      if (params.storeId) {
        const { data: store } = await supabase
          .from("daily_needs_stores").select("*").eq("id", params.storeId).maybeSingle();
        if (store) {
          setDraft({
            id: store.id,
            merchant_id: store.merchant_id,
            vertical: store.vertical,
            name: store.name ?? "",
            slug: store.slug ?? "",
            description: store.description ?? "",
            contact_phone: store.contact_phone ?? "",
            address: store.address ?? "",
            delivery_radius_km: Number(store.delivery_radius_km ?? 5),
            preparation_time_min: store.preparation_time_min ?? 20,
            delivery_modes: (store.delivery_modes ?? ["delivery"]) as any,
            service_areas: store.service_areas ?? [],
            pharmacy_license_number: store.pharmacy_license_number ?? "",
            pharmacy_license_url: store.pharmacy_license_url ?? "",
            pharmacy_license_expires_on: store.pharmacy_license_expires_on ?? "",
            pharmacist_in_charge_name: store.pharmacist_in_charge_name ?? "",
            pharmacist_in_charge_license: store.pharmacist_in_charge_license ?? "",
            pharmacist_in_charge_phone: store.pharmacist_in_charge_phone ?? "",
            otc_enabled: store.otc_enabled ?? true,
            rx_enabled: store.rx_enabled ?? false,
            controlled_substances_allowed: store.controlled_substances_allowed ?? false,
            cold_chain_capable: store.cold_chain_capable ?? false,
          });
          setStep(store.onboarding_step ?? 0);
          setVerificationStatus(store.verification_status ?? "pending");
        }
      } else {
        const v = (search.get("vertical") as Vertical) ?? "food";
        setDraft(empty(mid, v));
      }
      setLoading(false);
    })();
  }, [user, params.storeId, search, navigate]);

  const update = (patch: Partial<StoreDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const validateStep = (): string | null => {
    if (!draft) return "Loading";
    if (step === 0) {
      if (draft.name.trim().length < 2) return "Store name is required (min 2 chars).";
      if (!/^[a-z0-9-]{2,60}$/.test(draft.slug)) return "Slug must be 2–60 chars, lowercase letters, numbers, hyphens only.";
    }
    if (step === 1) {
      if (!draft.address.trim()) return "Address is required.";
      if (!draft.contact_phone.trim()) return "Contact phone is required.";
    }
    if (isPharmacy && step === 2) {
      if (!draft.otc_enabled && !draft.rx_enabled) return "Enable at least OTC or Prescription dispensing.";
    }
    if (isPharmacy && step === 3) {
      if (!draft.pharmacist_in_charge_name.trim()) return "Pharmacist-in-charge name is required.";
      if (!draft.pharmacist_in_charge_license.trim()) return "Pharmacist license number is required.";
    }
    if (isPharmacy && step === 4) {
      if (!draft.pharmacy_license_number.trim()) return "Pharmacy license number is required.";
      if (!draft.pharmacy_license_url) return "Upload the pharmacy license document.";
    }
    return null;
  };

  const handleUploadLicense = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${user.id}/pharmacy-license/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("daily-needs-prescriptions").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("daily-needs-prescriptions").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) update({ pharmacy_license_url: signed.signedUrl });
      toast({ title: "License uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveDraft = async (opts?: { submit?: boolean; advance?: boolean }) => {
    if (!draft) return;
    const err = validateStep();
    if (err) { toast({ title: "Please fix", description: err, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-needs-store-upsert", {
        body: { ...draft, onboarding_step: step, submit_for_verification: opts?.submit ?? false },
      });
      if (error) throw error;
      const savedId = data?.store?.id;
      if (savedId && !draft.id) update({ id: savedId });
      if (opts?.submit) {
        setVerificationStatus("pending");
        toast({ title: "Submitted for verification", description: "Our compliance team will review within 1–3 business days." });
        navigate("/merchant/daily-needs");
        return;
      }
      if (opts?.advance) setStep((s) => Math.min(steps.length - 1, s + 1));
      toast({ title: "Saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const pct = Math.round(((step + 1) / steps.length) * 100);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/daily-needs")} className="-ml-2">
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {isPharmacy ? <Pill className="size-6" /> : <UtensilsCrossed className="size-6" />}
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {draft.id ? "Edit store" : `Open a ${isPharmacy ? "Pharmacy" : "Food"} store`}
              </h1>
              <p className="text-sm text-muted-foreground">
                Step {step + 1} of {steps.length} · {steps[step]}
              </p>
            </div>
          </div>
          {draft.id && (
            <Badge variant={verificationStatus === "approved" ? "default" : "secondary"} className="capitalize">
              <ShieldCheck className="size-3 mr-1" /> {verificationStatus.replace("_", " ")}
            </Badge>
          )}
        </div>
        <Progress value={pct} className="h-1.5" />
      </header>

      <Card className="p-6 space-y-6">
        {step === 0 && (
          <section className="space-y-4">
            <SectionHeader icon={<StoreIcon className="size-4" />} title="Storefront basics" />
            <FieldRow>
              <Field label="Store name">
                <Input
                  value={draft.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    update({ name, slug: draft.slug || slugify(name) });
                  }}
                  placeholder={isPharmacy ? "Pharmacie du Centre" : "Le Bistrot Douala"}
                />
              </Field>
              <Field label="Public URL slug">
                <Input
                  value={draft.slug}
                  onChange={(e) => update({ slug: slugify(e.target.value) })}
                  placeholder="pharmacie-centre"
                />
              </Field>
            </FieldRow>
            <Field label="Short description">
              <Textarea
                value={draft.description}
                onChange={(e) => update({ description: e.target.value.slice(0, 1000) })}
                placeholder={isPharmacy
                  ? "24/7 pharmacy with prescription dispensing and home delivery."
                  : "Cameroonian comfort food, ready in 20 minutes."}
                rows={3}
              />
            </Field>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <SectionHeader icon={<MapPin className="size-4" />} title="Location & contact" />
            <Field label="Street address">
              <Input value={draft.address} onChange={(e) => update({ address: e.target.value })} placeholder="123 Avenue de la République, Douala" />
            </Field>
            <FieldRow>
              <Field label="Contact phone">
                <Input value={draft.contact_phone} onChange={(e) => update({ contact_phone: e.target.value })} placeholder="+237 6 90 00 00 00" />
              </Field>
              <Field label="Preparation time (min)" icon={<Clock className="size-3" />}>
                <Input type="number" min={5} max={240}
                  value={draft.preparation_time_min}
                  onChange={(e) => update({ preparation_time_min: parseInt(e.target.value) || 20 })} />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Delivery radius (km)">
                <Input type="number" min={1} max={50} step={0.5}
                  value={draft.delivery_radius_km}
                  onChange={(e) => update({ delivery_radius_km: parseFloat(e.target.value) || 5 })} />
              </Field>
              <Field label="Add a service area (neighborhood)">
                <div className="flex gap-2">
                  <Input value={areaInput} onChange={(e) => setAreaInput(e.target.value)} placeholder="Bonanjo" />
                  <Button type="button" variant="outline" onClick={() => {
                    const v = areaInput.trim(); if (!v) return;
                    update({ service_areas: Array.from(new Set([...draft.service_areas, v])) });
                    setAreaInput("");
                  }}>Add</Button>
                </div>
              </Field>
            </FieldRow>
            {draft.service_areas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draft.service_areas.map((a) => (
                  <Badge key={a} variant="secondary" className="cursor-pointer"
                    onClick={() => update({ service_areas: draft.service_areas.filter((x) => x !== a) })}>
                    {a} ×
                  </Badge>
                ))}
              </div>
            )}
          </section>
        )}

        {!isPharmacy && step === 2 && (
          <section className="space-y-4">
            <SectionHeader icon={<StoreIcon className="size-4" />} title="Service & delivery" />
            <ToggleRow label="Home delivery" checked={draft.delivery_modes.includes("delivery")}
              onChange={(v) => update({ delivery_modes: toggle(draft.delivery_modes, "delivery", v) })} />
            <ToggleRow label="In-store pickup" checked={draft.delivery_modes.includes("pickup")}
              onChange={(v) => update({ delivery_modes: toggle(draft.delivery_modes, "pickup", v) })} />
          </section>
        )}

        {isPharmacy && step === 2 && (
          <section className="space-y-4">
            <SectionHeader icon={<Pill className="size-4" />} title="Pharmacy capabilities" />
            <ToggleRow label="Over-the-counter (OTC) products"
              hint="Vitamins, hygiene, first-aid — no prescription needed."
              checked={draft.otc_enabled} onChange={(v) => update({ otc_enabled: v })} />
            <ToggleRow label="Prescription (Rx) dispensing"
              hint="Customers upload a prescription that your pharmacist reviews before fulfillment."
              checked={draft.rx_enabled} onChange={(v) => update({ rx_enabled: v })} />
            <ToggleRow label="Controlled substances"
              hint="Requires additional regulatory authorization. Subject to enhanced review."
              checked={draft.controlled_substances_allowed} onChange={(v) => update({ controlled_substances_allowed: v })} />
            <ToggleRow label="Cold-chain capable"
              hint="Refrigerated storage (2–8°C) for insulin, vaccines, biologics."
              checked={draft.cold_chain_capable} onChange={(v) => update({ cold_chain_capable: v })} />
            <Separator />
            <SectionHeader icon={<StoreIcon className="size-4" />} title="Fulfillment" />
            <ToggleRow label="Home delivery" checked={draft.delivery_modes.includes("delivery")}
              onChange={(v) => update({ delivery_modes: toggle(draft.delivery_modes, "delivery", v) })} />
            <ToggleRow label="In-store pickup" checked={draft.delivery_modes.includes("pickup")}
              onChange={(v) => update({ delivery_modes: toggle(draft.delivery_modes, "pickup", v) })} />
          </section>
        )}

        {isPharmacy && step === 3 && (
          <section className="space-y-4">
            <SectionHeader icon={<ShieldCheck className="size-4" />} title="Pharmacist-in-charge" />
            <p className="text-sm text-muted-foreground">
              The licensed pharmacist responsible for reviewing prescriptions on this storefront.
            </p>
            <FieldRow>
              <Field label="Full name">
                <Input value={draft.pharmacist_in_charge_name}
                  onChange={(e) => update({ pharmacist_in_charge_name: e.target.value })} placeholder="Dr. Jean Kamga" />
              </Field>
              <Field label="Pharmacist license #">
                <Input value={draft.pharmacist_in_charge_license}
                  onChange={(e) => update({ pharmacist_in_charge_license: e.target.value })} placeholder="ONPC-2025-12345" />
              </Field>
            </FieldRow>
            <Field label="Direct phone">
              <Input value={draft.pharmacist_in_charge_phone}
                onChange={(e) => update({ pharmacist_in_charge_phone: e.target.value })} placeholder="+237 6 90 00 00 00" />
            </Field>
          </section>
        )}

        {isPharmacy && step === 4 && (
          <section className="space-y-4">
            <SectionHeader icon={<FileText className="size-4" />} title="Pharmacy license & review" />
            <FieldRow>
              <Field label="Pharmacy license #">
                <Input value={draft.pharmacy_license_number}
                  onChange={(e) => update({ pharmacy_license_number: e.target.value })} placeholder="MOH-CM-2025-0001" />
              </Field>
              <Field label="Expires on">
                <Input type="date" value={draft.pharmacy_license_expires_on}
                  onChange={(e) => update({ pharmacy_license_expires_on: e.target.value })} />
              </Field>
            </FieldRow>
            <Field label="License document (PDF or image, max 8 MB)">
              <label className="flex flex-col items-center justify-center gap-2 border border-dashed rounded-md p-6 cursor-pointer hover:border-foreground/40 transition-colors">
                <Upload className="size-5 text-muted-foreground" />
                <span className="text-sm">{draft.pharmacy_license_url ? "Replace document" : "Click to upload"}</span>
                <input type="file" className="hidden" accept="application/pdf,image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 8 * 1024 * 1024) { toast({ title: "File too large", variant: "destructive" }); return; }
                      handleUploadLicense(f);
                    }
                  }} />
              </label>
              {draft.pharmacy_license_url && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <CheckCircle2 className="size-4 text-primary" /> Document attached
                </div>
              )}
            </Field>
            <Separator />
            <ReviewSummary draft={draft} />
          </section>
        )}

        {!isPharmacy && step === 3 && <ReviewSummary draft={draft} />}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" disabled={step === 0 || saving}
          onClick={() => setStep((s) => Math.max(0, s - 1))}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveDraft()} disabled={saving || uploading}>
            Save draft
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => saveDraft({ advance: true })} disabled={saving || uploading}>
              Next <ArrowRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => saveDraft({ submit: true })} disabled={saving || uploading}>
              <ShieldCheck className="size-4 mr-1" /> Submit for verification
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function toggle<T extends string>(arr: T[], v: T, on: boolean): T[] {
  return on ? Array.from(new Set([...arr, v])) : arr.filter((x) => x !== v);
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
      {icon}<span>{title}</span>
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">{icon}{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }:
  { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ReviewSummary({ draft }: { draft: StoreDraft }) {
  const isPharmacy = draft.vertical === "pharmacy";
  return (
    <div className="space-y-3">
      <SectionHeader icon={<CheckCircle2 className="size-4" />} title="Review" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <SummaryItem k="Vertical" v={isPharmacy ? "Pharmacy" : "Food"} />
        <SummaryItem k="Store" v={draft.name || "—"} />
        <SummaryItem k="Slug" v={draft.slug || "—"} />
        <SummaryItem k="Phone" v={draft.contact_phone || "—"} />
        <SummaryItem k="Address" v={draft.address || "—"} />
        <SummaryItem k="Delivery radius" v={`${draft.delivery_radius_km} km`} />
        <SummaryItem k="Prep time" v={`${draft.preparation_time_min} min`} />
        <SummaryItem k="Fulfillment" v={draft.delivery_modes.join(", ") || "—"} />
        {isPharmacy && (
          <>
            <SummaryItem k="OTC" v={draft.otc_enabled ? "Yes" : "No"} />
            <SummaryItem k="Prescription" v={draft.rx_enabled ? "Yes" : "No"} />
            <SummaryItem k="Controlled substances" v={draft.controlled_substances_allowed ? "Yes" : "No"} />
            <SummaryItem k="Cold chain" v={draft.cold_chain_capable ? "Yes" : "No"} />
            <SummaryItem k="Pharmacist" v={draft.pharmacist_in_charge_name || "—"} />
            <SummaryItem k="License #" v={draft.pharmacy_license_number || "—"} />
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground pt-2">
        Submitting for verification locks the storefront as <span className="font-medium">pending</span>.
        Our compliance team reviews within 1–3 business days.
      </p>
    </div>
  );
}

function SummaryItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-right truncate max-w-[60%]">{v}</dd>
    </div>
  );
}
