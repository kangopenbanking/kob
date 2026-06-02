import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "missing_items", label: "Items missing" },
  { value: "wrong_items", label: "Wrong items delivered" },
  { value: "damaged", label: "Damaged or spoiled" },
  { value: "late", label: "Arrived very late" },
  { value: "driver", label: "Driver issue" },
  { value: "other", label: "Other" },
];

export default function DailyNeedsReportIssue() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("missing_items");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!orderId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("daily_needs_issue_reports").insert({
      order_id: orderId, user_id: user!.id, category,
      description: description.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: "Submission failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Report submitted", description: "Our support team will follow up shortly." });
    navigate(`/app/daily-needs/orders/${orderId}`);
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold">Report an issue</h1>
      </header>

      <Card className="p-4 space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-muted p-3">
          <AlertTriangle className="size-5 text-amber-500 mt-0.5" />
          <p className="text-xs text-muted-foreground">Tell us what went wrong. Our team will review and may issue a refund.</p>
        </div>

        <div>
          <Label className="text-sm font-medium">What happened?</Label>
          <RadioGroup value={category} onValueChange={setCategory} className="mt-2 space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c.value} className="flex items-center gap-2">
                <RadioGroupItem value={c.value} id={c.value} />
                <Label htmlFor={c.value} className="font-normal">{c.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div>
          <Label>Details</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Describe the issue in detail…" />
        </div>

        <Button className="w-full" onClick={submit} disabled={saving}>Submit report</Button>
      </Card>
    </div>
  );
}
