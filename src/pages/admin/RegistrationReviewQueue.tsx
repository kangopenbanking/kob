/**
 * Unified Admin Review Queue for all registration types.
 * Reads from kyc_verifications, business_kyc, institutions, tpp_registrations
 * and joins recent audit_logs for correlation status and step-up denial reasons.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink } from "lucide-react";

type AccountType = "personal" | "business" | "institution" | "developer";

type Row = {
  id: string;
  account_type: AccountType;
  entity_id: string;
  display_name: string;
  status: string;
  institution_id: string | null;
  correlation_status: "matched" | "unmatched" | "manual_review" | "none";
  step_up_denial?: string;
  updated_at: string;
  review_path: string;
};

const ACCOUNT_OPTIONS: { value: AccountType | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "institution", label: "Institution" },
  { value: "developer", label: "Developer" },
];

const STATUS_OPTIONS = ["all", "pending", "under_review", "info_requested", "approved", "rejected"];

const CORRELATION_OPTIONS = ["all", "matched", "unmatched", "manual_review", "none"];

async function fetchQueue(): Promise<Row[]> {
  const rows: Row[] = [];

  // 1. Personal — kyc_verifications
  const { data: kyc } = await supabase
    .from("kyc_verifications" as any)
    .select("id,user_id,status,institution_id,updated_at,full_name,correlation_status")
    .in("status", ["pending", "under_review", "info_requested"])
    .order("updated_at", { ascending: false })
    .limit(100);
  for (const r of (kyc as any[]) ?? []) {
    rows.push({
      id: `kyc:${r.id}`,
      account_type: "personal",
      entity_id: r.user_id ?? r.id,
      display_name: r.full_name ?? r.user_id ?? r.id,
      status: r.status,
      institution_id: r.institution_id ?? null,
      correlation_status: (r.correlation_status as Row["correlation_status"]) ?? "none",
      updated_at: r.updated_at,
      review_path: `/admin/kyc-review/${r.id}`,
    });
  }

  // 2. Business — business_kyc
  const { data: biz } = await supabase
    .from("business_kyc" as any)
    .select("id,merchant_id,status,business_name,updated_at")
    .in("status", ["pending", "under_review", "info_requested"])
    .order("updated_at", { ascending: false })
    .limit(100);
  for (const r of (biz as any[]) ?? []) {
    rows.push({
      id: `biz:${r.id}`,
      account_type: "business",
      entity_id: r.merchant_id ?? r.id,
      display_name: r.business_name ?? r.merchant_id ?? r.id,
      status: r.status,
      institution_id: null,
      correlation_status: "none",
      updated_at: r.updated_at,
      review_path: `/admin/business-kyc/${r.id}`,
    });
  }

  // 3. Institution
  const { data: inst } = await supabase
    .from("institutions" as any)
    .select("id,name,status,updated_at")
    .in("status", ["pending", "under_review", "info_requested"])
    .order("updated_at", { ascending: false })
    .limit(100);
  for (const r of (inst as any[]) ?? []) {
    rows.push({
      id: `inst:${r.id}`,
      account_type: "institution",
      entity_id: r.id,
      display_name: r.name ?? r.id,
      status: r.status,
      institution_id: r.id,
      correlation_status: "none",
      updated_at: r.updated_at,
      review_path: `/admin/institution-verification/${r.id}`,
    });
  }

  // 4. Developer — tpp_registrations
  const { data: tpp } = await supabase
    .from("tpp_registrations" as any)
    .select("id,client_id,client_name,status,institution_id,updated_at,created_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);
  for (const r of (tpp as any[]) ?? []) {
    if (r.status && !["pending", "under_review", "info_requested"].includes(r.status)) continue;
    rows.push({
      id: `tpp:${r.id}`,
      account_type: "developer",
      entity_id: r.client_id,
      display_name: r.client_name ?? r.client_id,
      status: r.status ?? "pending",
      institution_id: r.institution_id ?? null,
      correlation_status: "none",
      updated_at: r.updated_at ?? r.created_at,
      review_path: `/admin/tpp-registrations/${r.id}`,
    });
  }

  // 5. Decorate with recent step-up denials.
  const { data: stepUp } = await supabase
    .from("audit_logs" as any)
    .select("resource_id,details,created_at")
    .eq("event_type", "step_up_denied")
    .order("created_at", { ascending: false })
    .limit(200);
  const denialByEntity = new Map<string, string>();
  for (const r of (stepUp as any[]) ?? []) {
    const reason = (r.details as any)?.reason ?? "denied";
    if (r.resource_id && !denialByEntity.has(r.resource_id)) {
      denialByEntity.set(r.resource_id, String(reason));
    }
  }
  for (const row of rows) {
    const d = denialByEntity.get(row.entity_id);
    if (d) row.step_up_denial = d;
  }

  return rows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export default function RegistrationReviewQueue() {
  const [accountType, setAccountType] = useState<AccountType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [correlationFilter, setCorrelationFilter] = useState<string>("all");
  const [institutionFilter, setInstitutionFilter] = useState<string>("");
  const [stepUpOnly, setStepUpOnly] = useState(false);
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["registration-queue"],
    queryFn: fetchQueue,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (accountType !== "all" && r.account_type !== accountType) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (correlationFilter !== "all" && r.correlation_status !== correlationFilter) return false;
      if (institutionFilter && (r.institution_id ?? "").toLowerCase() !== institutionFilter.toLowerCase()) return false;
      if (stepUpOnly && !r.step_up_denial) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.display_name.toLowerCase().includes(q) &&
          !r.entity_id.toLowerCase().includes(q) &&
          !(r.institution_id ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, accountType, statusFilter, correlationFilter, institutionFilter, stepUpOnly, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Registration Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Pending KYC, KYB, institution, and TPP registrations across the platform.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Account type</label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Correlation</label>
            <Select value={correlationFilter} onValueChange={setCorrelationFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CORRELATION_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Institution ID</label>
            <Input value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)} placeholder="uuid…" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Search</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="name, entity id, institution…" />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant={stepUpOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setStepUpOnly((v) => !v)}
            >
              {stepUpOnly ? "Showing step-up denied" : "Step-up denied only"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No registrations match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="py-2 pr-2 font-medium">Type</th>
                    <th className="py-2 pr-2 font-medium">Name</th>
                    <th className="py-2 pr-2 font-medium">Entity ID</th>
                    <th className="py-2 pr-2 font-medium">Status</th>
                    <th className="py-2 pr-2 font-medium">Correlation</th>
                    <th className="py-2 pr-2 font-medium">Step-up</th>
                    <th className="py-2 pr-2 font-medium">Updated</th>
                    <th className="py-2 pr-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/30 align-top">
                      <td className="py-2 pr-2"><Badge variant="outline" className="text-[10px]">{r.account_type}</Badge></td>
                      <td className="py-2 pr-2 font-medium">{r.display_name}</td>
                      <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">{r.entity_id}</td>
                      <td className="py-2 pr-2"><Badge variant="secondary" className="text-[10px]">{r.status}</Badge></td>
                      <td className="py-2 pr-2 text-xs">{r.correlation_status}</td>
                      <td className="py-2 pr-2 text-xs">
                        {r.step_up_denial ? (
                          <span className="text-amber-700">{r.step_up_denial}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {new Date(r.updated_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">
                        <Link
                          to={r.review_path}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Review <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
