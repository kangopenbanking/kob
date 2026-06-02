import { useNavigate } from "react-router-dom";
import { ChevronLeft, Phone, AlertTriangle, MessageCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function DriverSupport() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);

  const triggerSOS = async () => {
    if (!confirm("Trigger emergency SOS? Our safety team will be alerted immediately.")) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data: drv } = await supabase.from("ddn_drivers").select("id").eq("user_id", user.id).maybeSingle();

      // Best-effort geolocation — never blocks the SOS write.
      const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { timeout: 3000, maximumAge: 60000 },
        );
      });

      const { error } = await supabase.from("driver_sos_events").insert({
        driver_id: drv?.id ?? null,
        user_id: user.id,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        note: "Driver triggered SOS from app",
        status: "open",
      } as any);
      if (error) throw error;
      toast({ title: "SOS sent", description: "A safety agent will contact you shortly." });
    } catch (e: any) {
      toast({ title: "Could not send SOS", description: e?.message ?? "Please call support directly.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ChevronLeft className="size-5" /></Button>
        <h1 className="text-xl font-semibold">Support & Safety</h1>
      </header>

      <Card className="p-4 border-destructive bg-destructive/5 space-y-2">
        <div className="flex items-center gap-2"><ShieldAlert className="size-5 text-destructive" /><p className="font-semibold text-sm">Emergency SOS</p></div>
        <p className="text-xs text-muted-foreground">Use only in case of accident, theft, or threat to your safety.</p>
        <Button variant="destructive" className="w-full" onClick={triggerSOS} disabled={sending}>
          <AlertTriangle className="size-4 mr-1" /> Trigger SOS
        </Button>
      </Card>

      <Card className="divide-y">
        <a href="tel:+237000000000" className="flex items-center gap-3 p-4 hover:bg-accent">
          <Phone className="size-5 text-primary" />
          <div className="flex-1"><p className="text-sm font-medium">Call support</p><p className="text-xs text-muted-foreground">Available 24/7</p></div>
        </a>
        <button onClick={() => navigate("/app/support")} className="flex items-center gap-3 p-4 w-full text-left hover:bg-accent">
          <MessageCircle className="size-5 text-primary" />
          <div className="flex-1"><p className="text-sm font-medium">Chat with support</p><p className="text-xs text-muted-foreground">Typical reply &lt; 5 min</p></div>
        </button>
      </Card>
    </div>
  );
}
