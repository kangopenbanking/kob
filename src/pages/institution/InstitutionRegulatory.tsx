import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, FileText, Plus, Send, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionRegulatory() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [form, setForm] = useState({ report_type: "anti_money_laundering", regulator: "COBAC", report_format: "xml", period_start: "", period_end: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { instId = institution.id; }
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);
      const query = supabase.from("regulatory_reports").select("*");
      const { data } = await query.eq("institution_id", instId).order("created_at", { ascending: false }).limit(100);
      setReports(data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.period_start || !form.period_end || !institutionId) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("regulatory_reports").insert({
        report_type: form.report_type,
        regulator: form.regulator,
        report_format: form.report_format,
        report_period_start: form.period_start,
        report_period_end: form.period_end,
        institution_id: institutionId,
        created_by: user?.id,
        submission_status: "draft",
      });
      if (error) throw error;
      toast({ title: "Report created" });
      setDialogOpen(false);
      setForm({ report_type: "anti_money_laundering", regulator: "COBAC", report_format: "xml", period_start: "", period_end: "" });
      loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const submitted = reports.filter(r => r.submission_status === "submitted").length;
  const acknowledged = reports.filter(r => r.acknowledgment_received).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-indigo/10 border border-fi-indigo/20"><FileText className="h-5 w-5 text-fi-indigo" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Regulatory Reporting</h1>
            <p className="text-xs text-muted-foreground">Generate and submit reports to regulators</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />New Report</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Regulatory Report</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Report Type</Label>
                  <Select value={form.report_type} onValueChange={v => setForm(f => ({...f, report_type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anti_money_laundering">Anti-Money Laundering</SelectItem>
                      <SelectItem value="prudential">Prudential</SelectItem>
                      <SelectItem value="statistical">Statistical</SelectItem>
                      <SelectItem value="suspicious_transaction">Suspicious Transaction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Regulator</Label><Input value={form.regulator} onChange={e => setForm(f => ({...f, regulator: e.target.value}))} /></div>
                <div><Label>Format</Label>
                  <Select value={form.report_format} onValueChange={v => setForm(f => ({...f, report_format: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xml">XML</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start</Label><Input type="date" value={form.period_start} onChange={e => setForm(f => ({...f, period_start: e.target.value}))} /></div>
                  <div><Label>Period End</Label><Input type="date" value={form.period_end} onChange={e => setForm(f => ({...f, period_end: e.target.value}))} /></div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={saving || !form.period_start || !form.period_end}>{saving ? "Creating..." : "Create Report"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Reports", value: reports.length, icon: FileText, color: "text-fi-indigo bg-fi-indigo/10 border-fi-indigo/20" },
          { label: "Submitted", value: submitted, icon: Send, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Acknowledged", value: acknowledged, icon: CheckCircle, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle className="text-sm font-semibold">Reports</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No regulatory reports</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Regulator</TableHead><TableHead className="text-xs">Period</TableHead><TableHead className="text-xs">Format</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Created</TableHead></TableRow></TableHeader>
              <TableBody>{reports.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.report_type?.replace(/_/g, ' ')}</TableCell>
                  <TableCell className="text-sm">{r.regulator}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.report_period_start && r.report_period_end ? `${format(new Date(r.report_period_start), 'MMM d')} - ${format(new Date(r.report_period_end), 'MMM d, yyyy')}` : '--'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] uppercase">{r.report_format}</Badge></TableCell>
                  <TableCell><Badge variant={r.submission_status === "submitted" ? "default" : r.submission_status === "draft" ? "outline" : "secondary"} className="text-[10px]">{r.submission_status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
