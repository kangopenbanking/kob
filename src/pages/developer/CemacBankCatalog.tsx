import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

interface Preset {
  bank_code: string;
  bank_name: string;
  country: string;
  swift_bic: string | null;
  recommended_adapter_type: "rest" | "sql" | "file" | "soap";
  default_config_json: Record<string, unknown>;
  documentation_url: string | null;
  integration_notes: string | null;
  certified: boolean;
  certified_at: string | null;
}

const ADAPTER_LABELS: Record<string, string> = {
  rest: "REST API",
  sql: "SQL Gateway",
  file: "File Drop (CSV / pain.001 / MT940)",
  soap: "SOAP / WS-Security",
};

export default function CemacBankCatalog() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [adapter, setAdapter] = useState<string>("all");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_profile_presets")
        .select("*")
        .order("country", { ascending: true })
        .order("bank_name", { ascending: true });
      if (active) {
        if (!error && data) setPresets(data as Preset[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = presets.filter((p) => {
    if (country !== "all" && p.country !== country) return false;
    if (adapter !== "all" && p.recommended_adapter_type !== adapter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.bank_name.toLowerCase().includes(q) &&
        !p.bank_code.toLowerCase().includes(q) &&
        !(p.swift_bic ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const countries = Array.from(new Set(presets.map((p) => p.country))).sort();

  return (
    <div className="container mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary/40 text-primary">
          v4.16.0 — Bank Profile Catalog
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">CEMAC Bank Catalog</h1>
        <p className="max-w-3xl text-muted-foreground">
          A curated registry of CEMAC banks with recommended adapter type, endpoint templates,
          and integration notes. Use a preset to pre-fill the bank-onboarding wizard rather than
          building a configuration from scratch. Public data — no authentication required.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Search by bank name, code, or SWIFT/BIC.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={adapter} onValueChange={setAdapter}>
            <SelectTrigger><SelectValue placeholder="Adapter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All adapters</SelectItem>
              <SelectItem value="rest">REST</SelectItem>
              <SelectItem value="sql">SQL Gateway</SelectItem>
              <SelectItem value="file">File Drop</SelectItem>
              <SelectItem value="soap">SOAP</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))
          : filtered.map((p) => (
              <Card key={p.bank_code} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{p.bank_name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {p.bank_code} · {p.country} {p.swift_bic ? `· ${p.swift_bic}` : ""}
                      </CardDescription>
                    </div>
                    {p.certified ? (
                      <Badge className="gap-1" variant="default">
                        <ShieldCheck className="h-3 w-3" /> Certified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ShieldAlert className="h-3 w-3" /> Sandbox
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Recommended adapter: </span>
                    <span className="font-medium">{ADAPTER_LABELS[p.recommended_adapter_type]}</span>
                  </div>
                  {p.integration_notes && (
                    <p className="text-muted-foreground">{p.integration_notes}</p>
                  )}
                  {p.documentation_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={p.documentation_url} target="_blank" rel="noopener noreferrer">
                        Bank Developer Portal
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
      </section>

      {!loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No banks match your filters.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Programmatic access</CardTitle>
          <CardDescription>
            The catalog is also available as a public JSON endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-xs">
{`# List all presets
curl https://api.kangopenbanking.com/v1/bank-presets

# Filter by country and adapter
curl "https://api.kangopenbanking.com/v1/bank-presets?country=CM&adapter_type=rest"

# Fetch a single bank
curl "https://api.kangopenbanking.com/v1/bank-presets?bank_code=AFRILAND_CM"`}
          </pre>
          <p className="text-xs text-muted-foreground">
            Response schema: <code>{`{ count, presets[], meta }`}</code>. Cached for 5 minutes.
          </p>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
