import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Building2, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionBranches() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data } = await supabase.from("branches").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setBranches(data || []);
    } catch (error) { console.error("Error loading branches:", error); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Branches</h1>
            <p className="text-xs text-muted-foreground">Manage institution branches and locations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Branches", value: branches.length, icon: Building2 },
          { label: "Active Branches", value: branches.filter(b => b.is_active).length, icon: MapPin },
          { label: "Branch Types", value: new Set(branches.map(b => b.branch_type)).size, icon: Building2 },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted"><s.icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">All Branches</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No branches found</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Branch Name</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Phone</TableHead><TableHead className="text-xs">Email</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Created</TableHead></TableRow></TableHeader>
              <TableBody>{branches.map(branch => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium text-sm">{branch.branch_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{branch.branch_code}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{branch.branch_type}</Badge></TableCell>
                  <TableCell className="text-sm">{branch.phone || '--'}</TableCell>
                  <TableCell className="text-sm">{branch.email || '--'}</TableCell>
                  <TableCell><Badge variant={branch.is_active ? "default" : "secondary"} className="text-[10px]">{branch.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{branch.created_at ? format(new Date(branch.created_at), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
