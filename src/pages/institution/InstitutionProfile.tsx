import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, Phone, MapPin, Save, CheckCircle2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

export default function InstitutionProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [form, setForm] = useState({ institution_name: "", phone: "", website: "", address: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    // Owner gets full editing; staff gets read-only view
    const { data } = await supabase.from("institutions").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setInstitution(data);
      setForm({ institution_name: data.institution_name || "", phone: data.phone || "", website: data.website || "", address: data.address || "" });
    } else {
      const staffInstId = await resolveInstitutionId(user.id);
      if (!staffInstId) { navigate('/register'); return; }
      const { data: staffInst } = await supabase.from("institutions").select("*").eq("id", staffInstId).maybeSingle();
      if (staffInst) {
        setInstitution({ ...staffInst, _readOnly: true });
        setForm({ institution_name: staffInst.institution_name || "", phone: staffInst.phone || "", website: staffInst.website || "", address: staffInst.address || "" });
      }
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institution || institution._readOnly) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("institutions").update({
        institution_name: form.institution_name, phone: form.phone, website: form.website, address: form.address,
        updated_at: new Date().toISOString(),
      }).eq("id", institution.id);
      if (error) throw error;
      toast({ title: "Profile Updated", description: "Institution details have been saved." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const isReadOnly = institution?._readOnly;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-blue/10 border border-fi-blue/20">
          <Building2 className="h-5 w-5 text-fi-blue" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institution Profile</h1>
          <p className="text-sm text-muted-foreground">View and update institution details</p>
        </div>
      </motion.div>

      {/* Registration Details */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
        <Card className="border-border/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-fi-blue to-fi-teal" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-blue/10 border border-fi-blue/20"><Building2 className="h-4 w-4 text-fi-blue" /></div>
              <CardTitle className="text-sm font-semibold">Registration Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
                <Badge variant="default" className="text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />{institution?.status}</Badge>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Type</p>
                <p className="text-sm font-semibold capitalize">{institution?.institution_type}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Registration #</p>
                <p className="text-sm font-semibold font-mono">{institution?.registration_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Form */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Edit Profile</CardTitle>
            <CardDescription className="text-xs">{isReadOnly ? "Staff view — contact the owner to edit" : "Update your institution's contact information"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold"><Building2 className="h-3 w-3 inline mr-1" />Institution Name</Label>
                <Input value={form.institution_name} onChange={e => setForm(prev => ({ ...prev, institution_name: e.target.value }))} disabled={isReadOnly} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold"><Phone className="h-3 w-3 inline mr-1" />Phone</Label>
                <Input value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} disabled={isReadOnly} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold"><Globe className="h-3 w-3 inline mr-1" />Website</Label>
                <Input value={form.website} onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))} disabled={isReadOnly} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold"><MapPin className="h-3 w-3 inline mr-1" />Address</Label>
                <Input value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} disabled={isReadOnly} className="h-10" />
              </div>
            </div>
            {!isReadOnly && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Settlement Config */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-amber/10 border border-fi-amber/20"><Settings className="h-4 w-4 text-fi-amber" /></div>
              <CardTitle className="text-sm font-semibold">Settlement Configuration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Frequency</p>
                <p className="text-sm font-semibold capitalize">{institution?.settlement_frequency || 'Weekly'}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Min Amount</p>
                <p className="text-sm font-semibold">{Number(institution?.minimum_settlement_amount || 0).toLocaleString()} XAF</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">KOB Facilitated</p>
                <p className="text-sm font-semibold">{institution?.use_kob_flutterwave ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
