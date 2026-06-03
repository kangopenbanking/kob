import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function DriverRegister() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", address: "",
    vehicle_type: "motorbike" as "bike" | "scooter" | "motorbike" | "car" | "foot",
    vehicle_registration: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();
      if (data) navigate("/app/driver", { replace: true });
    })();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); toast.error("Please sign in"); return; }
    if (form.full_name.trim().length < 2 || form.phone.trim().length < 6) {
      setSubmitting(false); toast.error("Fill in your name and phone"); return;
    }
    const { error } = await supabase.from("ddn_drivers").insert({
      user_id: user.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || null,
      vehicle_type: form.vehicle_type,
      vehicle_registration: form.vehicle_registration.trim() || null,
      mode: "platform",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted — pending approval");
    navigate("/app/driver", { replace: true });
  };

  return (
    <div className="pb-24 animate-fade-in">
      <div className="relative bg-[hsl(220,75%,50%)] text-white px-4 pt-4 pb-5">

        <div className="relative flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"
            className="text-white hover:bg-white/15 hover:text-white -ml-2">
            <ChevronLeft />
          </Button>
          <h1 className="text-2xl font-bold">Driver registration</h1>
        </div>
        <div className="flex items-center gap-3 bg-white/15 rounded-2xl p-3 border border-white/20">
          <div className="size-10 rounded-2xl border-2 border-white/70 flex items-center justify-center shrink-0">
            <Truck className="size-5" strokeWidth={2} />
          </div>
          <p className="text-sm text-white/90">Tell us about you and your vehicle. Approval typically takes 24h.</p>
        </div>
      </div>

      <div className="px-4 mt-4 max-w-md mx-auto">
        <form className="space-y-3" onSubmit={submit}>
        <div className="space-y-1">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" maxLength={32} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="address">Address (optional)</Label>
          <Input id="address" maxLength={200} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="vehicle_type">Vehicle type</Label>
          <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v as any })}>
            <SelectTrigger id="vehicle_type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bike">Bike</SelectItem>
              <SelectItem value="scooter">Scooter</SelectItem>
              <SelectItem value="motorbike">Motorbike</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="foot">On foot</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vehicle_registration">Vehicle registration (optional)</Label>
          <Input id="vehicle_registration" maxLength={32} value={form.vehicle_registration} onChange={(e) => setForm({ ...form, vehicle_registration: e.target.value })} />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit application"}
        </Button>
      </form>
      </div>
    </div>
  );
}
