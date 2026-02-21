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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertTriangle, Plus, ShieldAlert, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

export default function InstitutionIncidents() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", incident_type: "operational", severity: "medium" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data } = await supabase.from("incident_logs").select("*").order("created_at", { ascending: false }).limit(200);
      setIncidents(data || []);
    } catch (error) { console.error("Error:", error); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("incident_logs").insert({
        title: form.title,
        description: form.description || null,
        incident_type: form.incident_type,
        severity: form.severity,
        reported_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Incident logged" });
      setDialogOpen(false);
      setForm({ title: "", description: "", incident_type: "operational", severity: "medium" });
      loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const severityColor = (s: string): "default" | "secondary" | "destructive" | "outline" => {
    if (s === "critical" || s === "high") return "destructive";
    if (s === "medium") return "outline";
    return "secondary";
  };

  const open = incidents.filter(i => i.status === "open" || i.status === "investigating").length;
  const critical = incidents.filter(i => i.severity === "critical").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-rose/10 border border-fi-rose/20"><ShieldAlert className="h-5 w-5 text-fi-rose" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Incident Management</h1>
            <p className="text-xs text-muted-foreground">Track and resolve operational incidents</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Log Incident</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log New Incident</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Title</Label><Input placeholder="Brief description" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} /></div>
                <div><Label>Description</Label><Textarea placeholder="Details..." value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type</Label>
                    <Select value={form.incident_type} onValueChange={v => setForm(f => ({...f, incident_type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="fraud">Fraud</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Severity</Label>
                    <Select value={form.severity} onValueChange={v => setForm(f => ({...f, severity: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button className="w-full" onClick={handleCreate} disabled={saving || !form.title}>{saving ? "Logging..." : "Log Incident"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Incidents", value: incidents.length, icon: ShieldAlert, color: "text-fi-rose bg-fi-rose/10 border-fi-rose/20" },
          { label: "Open / Investigating", value: open, icon: Clock, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
          { label: "Critical", value: critical, icon: AlertTriangle, color: "text-fi-red bg-fi-red/10 border-fi-red/20" },
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
        <CardHeader><CardTitle className="text-sm font-semibold">Incident Log</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No incidents logged</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Title</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Severity</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{incidents.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{i.title}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{i.incident_type}</Badge></TableCell>
                  <TableCell><Badge variant={severityColor(i.severity)} className="text-[10px]">{i.severity}</Badge></TableCell>
                  <TableCell><Badge variant={i.status === "resolved" ? "default" : "outline"} className="text-[10px]">{i.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.created_at ? format(new Date(i.created_at), 'PP') : '--'}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
