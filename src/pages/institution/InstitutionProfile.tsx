import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, Phone, MapPin, Save, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InstitutionProfile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [form, setForm] = useState({
    institution_name: "", phone: "", website: "", address: ""
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }

    const { data } = await supabase
      .from("institutions").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) { navigate('/register'); return; }

    setInstitution(data);
    setForm({
      institution_name: data.institution_name || "",
      phone: data.phone || "",
      website: data.website || "",
      address: data.address || "",
    });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institution) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("institutions").update({
          institution_name: form.institution_name,
          phone: form.phone,
          website: form.website,
          address: form.address,
          updated_at: new Date().toISOString(),
        }).eq("id", institution.id);

      if (error) throw error;
      toast({ title: "Profile Updated", description: "Institution details have been saved." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent></Card>;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Institution Profile</h1>
          <p className="text-muted-foreground">View and update your institution details</p>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Registration Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />{institution?.status}
                </Badge>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Type</p>
                <p className="font-semibold capitalize">{institution?.institution_type}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Registration #</p>
                <p className="font-semibold font-mono">{institution?.registration_number}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
            <CardDescription>Update your institution's contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name"><Building2 className="h-3 w-3 inline mr-1" />Institution Name</Label>
                <Input id="name" value={form.institution_name} onChange={e => setForm(prev => ({ ...prev, institution_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone"><Phone className="h-3 w-3 inline mr-1" />Phone</Label>
                <Input id="phone" value={form.phone} onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website"><Globe className="h-3 w-3 inline mr-1" />Website</Label>
                <Input id="website" value={form.website} onChange={e => setForm(prev => ({ ...prev, website: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address"><MapPin className="h-3 w-3 inline mr-1" />Address</Label>
                <Input id="address" value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Config */}
        <Card>
          <CardHeader>
            <CardTitle>Settlement Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Frequency</p>
                <p className="font-semibold capitalize">{institution?.settlement_frequency || 'Weekly'}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Min Amount</p>
                <p className="font-semibold">{Number(institution?.minimum_settlement_amount || 0).toLocaleString()} XAF</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">KOB Facilitated</p>
                <p className="font-semibold">{institution?.use_kob_flutterwave ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
