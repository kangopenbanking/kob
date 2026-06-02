import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function DailyNeedsReview() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data: o } = await supabase
        .from("daily_needs_orders")
        .select("id, store_id, daily_needs_stores(name)")
        .eq("id", orderId).maybeSingle();
      setOrder(o);
      const { data: r } = await supabase
        .from("daily_needs_reviews")
        .select("*").eq("order_id", orderId).maybeSingle();
      if (r) {
        setExisting(r);
        setRating(r.rating);
        setComment(r.comment ?? "");
      }
    })();
  }, [orderId]);

  const submit = async () => {
    if (rating < 1) { toast({ title: "Please pick a rating", variant: "destructive" }); return; }
    if (!order) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      order_id: order.id, user_id: user!.id, store_id: order.store_id,
      rating, comment: comment.trim() || null,
    };
    const { error } = existing
      ? await supabase.from("daily_needs_reviews").update({ rating, comment: payload.comment }).eq("id", existing.id)
      : await supabase.from("daily_needs_reviews").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Submit failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: existing ? "Review updated" : "Thanks for your review" });
    navigate(`/app/daily-needs/orders/${order.id}`);
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-semibold">Rate your order</h1>
      </header>

      <Card className="p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground">Order from</p>
          <p className="font-medium">{order?.daily_needs_stores?.name ?? "—"}</p>
        </div>

        <div className="flex justify-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star`}
              role="radio"
              aria-checked={rating === n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star
                className={`size-9 transition-colors ${(hover || rating) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share details about your experience (optional)"
          rows={4}
        />

        <Button className="w-full" onClick={submit} disabled={saving || rating < 1}>
          {existing ? "Update review" : "Submit review"}
        </Button>
      </Card>
    </div>
  );
}
