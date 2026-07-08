/**
 * Customer Profile — dedicated page for completing the CrediQ "basic check"
 * fields (full name, date of birth, country, phone verification, KYC).
 *
 * Reached from `BasicCheckChecklist` on the credit-score screen and from
 * anywhere that surfaces the "complete your profile" prompt. Every KYC
 * launch goes through `submitIdentityKyc` — Didit-first policy.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, User, Calendar, Globe, Phone, ShieldCheck,
  CheckCircle2, Loader2, Save, ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProfileRow {
  id: string;
  full_name: string | null;
  date_of_birth: string | null;
  country_code: string | null;
  phone_number: string | null;
  phone_verified: boolean | null;
}

const COUNTRIES: { code: string; name: string }[] = [
  { code: "CM", name: "Cameroon" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "SN", name: "Senegal" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "FR", name: "France" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

const SectionCard: React.FC<{
  id: string;
  icon: React.ElementType;
  title: string;
  done: boolean;
  highlight?: boolean;
  children: React.ReactNode;
}> = ({ id, icon: Icon, title, done, highlight, children }) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`rounded-3xl border p-5 ${
      done ? "bg-[hsl(150,40%,95%)] border-[hsl(150,40%,70%)]" :
      highlight ? "bg-[hsl(210,80%,96%)] border-[hsl(210,60%,60%)]" :
      "bg-card border-border"
    }`}
  >
    <div className="flex items-start gap-3 mb-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{title}</p>
        {done && (
          <div className="flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(150,60%,35%)]" strokeWidth={2} />
            <span className="text-[11px] font-semibold text-[hsl(150,60%,35%)]">Completed</span>
          </div>
        )}
      </div>
    </div>
    {children}
  </motion.section>
);

const CustomerProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCustomerAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["customer-profile-full", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, date_of_birth, country_code, phone_number, phone_verified")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileRow) ?? null;
    },
  });

  const { data: kycRow } = useQuery({
    queryKey: ["customer-kyc-status", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("id, status, verification_type, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as unknown) as { id: string; status: string; verification_type: string | null; created_at: string } | null;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setDob(profile.date_of_birth || "");
    setCountry(profile.country_code || "");
    setPhone(profile.phone_number || "");
  }, [profile]);

  // Scroll to hash section after load
  useEffect(() => {
    if (!isLoading && location.hash) {
      const el = document.querySelector(location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    }
  }, [isLoading, location.hash]);

  const nameDone = useMemo(() => {
    const n = (profile?.full_name || "").trim();
    return n.length >= 3 && n.includes(" ");
  }, [profile]);
  const dobDone = !!profile?.date_of_birth;
  const countryDone = !!profile?.country_code;
  const phoneDone = profile?.phone_verified === true;
  const kycDone = ["approved", "verified"].includes((kycRow?.status || "").toLowerCase());

  const highlight = location.hash?.replace("#", "");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["customer-profile-full", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["customer-credit-score", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["customer-profile", user?.id] });
  };

  const saveField = async (payload: Partial<ProfileRow>, successMsg: string) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(payload as never)
        .eq("id", user.id);
      if (error) throw error;
      toast.success(successMsg);
      await refetch();
      invalidate();
    } catch (err) {
      toast.error(extractEdgeFunctionError(err, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = () => {
    const n = fullName.trim();
    if (n.length < 3 || !n.includes(" ")) {
      toast.error("Please enter your first and last name");
      return;
    }
    saveField({ full_name: n }, "Name saved");
  };

  const handleSaveDob = () => {
    if (!dob) return toast.error("Please pick your date of birth");
    saveField({ date_of_birth: dob }, "Date of birth saved");
  };

  const handleSaveCountry = () => {
    if (!country) return toast.error("Please select your country");
    saveField({ country_code: country }, "Country saved");
  };

  const handleSendOtp = async () => {
    const trimmed = phone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      toast.error("Enter phone in international format, e.g. +237612345678");
      return;
    }
    setSendingOtp(true);
    try {
      // Persist number so verify-otp can match this profile.
      await supabase.from("profiles").update({ phone_number: trimmed } as never).eq("id", user!.id);
      const { error } = await supabase.functions.invoke("phone-auth-send-otp", {
        body: { phone_number: trimmed, otp_type: "verification", delivery_method: "auto" },
      });
      if (error) throw error;
      setShowOtp(true);
      toast.success("Verification code sent");
    } catch (err) {
      toast.error(extractEdgeFunctionError(err, "Could not send code"));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return toast.error("Enter the 6-digit code");
    setVerifyingOtp(true);
    try {
      const { error } = await supabase.functions.invoke("phone-auth-verify-otp", {
        body: { phone_number: phone.trim(), otp_code: otp, otp_type: "verification" },
      });
      if (error) throw error;
      // verify-otp sets phone_verified=true server-side when the profile matches;
      // update the flag defensively for the current user as well.
      await supabase
        .from("profiles")
        .update({ phone_verified: true, phone_verified_at: new Date().toISOString() } as never)
        .eq("id", user!.id);
      toast.success("Phone verified");
      setShowOtp(false);
      setOtp("");
      await refetch();
      invalidate();
    } catch (err) {
      toast.error(extractEdgeFunctionError(err, "Invalid or expired code"));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const completedCount = [nameDone, dobDone, countryDone, phoneDone, kycDone].filter(Boolean).length;
  const totalCount = 5;
  const pct = Math.round((completedCount / totalCount) * 100);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
          <h1 className="text-xl font-bold text-foreground">Complete Profile</h1>
        </div>
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-28">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Complete your profile</h1>
      </div>

      {/* Progress */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-2">
          <span>{completedCount} of {totalCount} complete</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Completing these steps unlocks your CrediQ score and access to credit-based products.
        </p>
      </div>

      {/* Full name */}
      <SectionCard id="full_name" icon={User} title="Legal full name" done={nameDone} highlight={highlight === "full_name"}>
        {nameDone ? (
          <p className="text-xs text-muted-foreground">{profile?.full_name}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="fname" className="text-xs">First and last name (as on your ID)</Label>
            <Input id="fname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Amina Njie" />
            <Button size="sm" onClick={handleSaveName} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Save name</>}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Date of birth */}
      <SectionCard id="date_of_birth" icon={Calendar} title="Date of birth" done={dobDone} highlight={highlight === "date_of_birth"}>
        {dobDone ? (
          <p className="text-xs text-muted-foreground">{profile?.date_of_birth}</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="dob" className="text-xs">You must be 18 or older</Label>
            <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
            <Button size="sm" onClick={handleSaveDob} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Save date of birth</>}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Country */}
      <SectionCard id="country" icon={Globe} title="Country" done={countryDone} highlight={highlight === "country"}>
        {countryDone ? (
          <p className="text-xs text-muted-foreground">
            {COUNTRIES.find((c) => c.code === profile?.country_code)?.name || profile?.country_code}
          </p>
        ) : (
          <div className="space-y-2">
            <Label className="text-xs">Country of residence</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSaveCountry} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Save country</>}
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Phone verification */}
      <SectionCard id="phone_verification" icon={Phone} title="Phone verification" done={phoneDone} highlight={highlight === "phone_verification"}>
        {phoneDone ? (
          <p className="text-xs text-muted-foreground">Verified: {profile?.phone_number}</p>
        ) : (
          <div className="space-y-2">
            {!showOtp ? (
              <>
                <Label htmlFor="phone" className="text-xs">Phone in international format</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237612345678" />
                <Button size="sm" onClick={handleSendOtp} disabled={sendingOtp} className="w-full">
                  {sendingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send verification code"}
                </Button>
              </>
            ) : (
              <>
                <Label className="text-xs">Enter the 6-digit code sent to {phone}</Label>
                <InputOTP value={otp} onChange={setOtp} maxLength={6}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setShowOtp(false); setOtp(""); }} className="flex-1">Change number</Button>
                  <Button size="sm" onClick={handleVerifyOtp} disabled={verifyingOtp || otp.length !== 6} className="flex-1">
                    {verifyingOtp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      {/* KYC (Didit) */}
      <SectionCard id="kyc" icon={ShieldCheck} title="Identity verification (Didit)" done={kycDone} highlight={highlight === "kyc"}>
        {kycDone ? (
          <p className="text-xs text-muted-foreground">
            Verified via {kycRow?.provider || "Didit"} — no further action required.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              We use Didit to verify your ID and a live selfie. This is the only accepted identity verification path.
            </p>
            <Button
              size="sm"
              onClick={() => navigate(kycRow ? "/app/kyc/resume" : "/app/kyc")}
              className="w-full"
            >
              {kycRow ? "Resume Didit verification" : "Start Didit verification"}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </SectionCard>

      {completedCount === totalCount && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl bg-[hsl(150,40%,92%)] border border-[hsl(150,40%,60%)] p-5 text-center">
          <CheckCircle2 className="h-8 w-8 text-[hsl(150,60%,35%)] mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">Basic check complete</p>
          <p className="text-[11px] text-muted-foreground mt-1">Your CrediQ score will unlock shortly.</p>
          <Button size="sm" onClick={() => navigate("/app/credit")} className="mt-3">
            View my credit score
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default CustomerProfile;
