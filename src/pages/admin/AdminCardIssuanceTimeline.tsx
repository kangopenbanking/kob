import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Clock, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TimelineStep {
  step: string;
  at: string;
  note?: string;
}

interface IssuanceRow {
  id: string;
  user_id: string;
  provider: string | null;
  form_factor: string | null;
  status: string | null;
  currency: string | null;
  last4: string | null;
  created_at: string;
  metadata: any;
}

export default function AdminCardIssuanceTimeline() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<IssuanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    const q = key.trim();
    if (!q) {
      toast.error("Enter an idempotency key, card id, or user id");
      return;
    }
    setLoading(true);
    let query = supabase
      .from("virtual_cards")
      .select("id,user_id,provider,form_factor,status,currency,last4,created_at,metadata")
      .order("created_at", { ascending: false })
      .limit(25);

    // Try idempotency_key filter first, fall back to id/user_id contains
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
    if (isUuid) {
      query = query.or(
        `id.eq.${q},user_id.eq.${q},metadata->>idempotency_key.eq.${q}`
      );
    } else {
      query = query.filter("metadata->>idempotency_key", "eq", q);
    }

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as any) ?? []);
    if (!data?.length) toast.info("No issuance matched that key");
  };

  return (
    <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" /> Card Issuance Timeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search by idempotency key, card id, or user id to see the full structured issuance timeline.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 flex gap-2">
            <Input
              placeholder="Idempotency key / card id / user id"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button onClick={search} disabled={loading}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </CardContent>
        </Card>

        {rows.map((row) => {
          const timeline: TimelineStep[] = row.metadata?.timeline ?? [];
          const idem = row.metadata?.idempotency_key ?? "—";
          return (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-mono truncate">{row.id}</span>
                  <div className="flex gap-2">
                    {row.form_factor && <Badge variant="outline">{row.form_factor}</Badge>}
                    <Badge>{row.status ?? "unknown"}</Badge>
                  </div>
                </CardTitle>
                <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <span>Idem: <span className="font-mono">{idem}</span></span>
                  <span>User: <span className="font-mono">{row.user_id}</span></span>
                  <span>Currency: {row.currency ?? "—"}</span>
                  <span>Last4: {row.last4 ?? "—"}</span>
                </div>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timeline recorded.</p>
                ) : (
                  <ol className="space-y-3">
                    {timeline.map((t, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <div className="mt-1"><Clock className="h-4 w-4 text-muted-foreground" /></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">{t.step}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(t.at), "MMM d, HH:mm:ss.SSS")}
                            </span>
                          </div>
                          {t.note && <p className="text-xs text-muted-foreground mt-1">{t.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
