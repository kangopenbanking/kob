import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Edit, Globe, Banknote, ArrowRight, CheckCircle2, RefreshCw, Settings2,
} from "lucide-react";

export default function RemittancePartners() {
  const queryClient = useQueryClient();
  const [partnerDialog, setPartnerDialog] = useState<any>(null);
  const [corridorDialog, setCorridorDialog] = useState<any>(null);
  const [partnerForm, setPartnerForm] = useState<any>({});
  const [corridorForm, setCorridorForm] = useState<any>({});

  const { data: partners, isLoading } = useQuery({
    queryKey: ["admin-remittance-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("remittance_partners").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: corridors, isLoading: loadingCorridors } = useQuery({
    queryKey: ["admin-remittance-corridors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("remittance_corridors")
        .select("*, remittance_partners(id, name)")
        .order("from_country");
      if (error) throw error;
      return data;
    },
  });

  const partnerMutation = useMutation({
    mutationFn: async (form: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("remittance-engine", {
        body: {
          action: "admin_manage_partner",
          operation: form.id ? "update" : "create",
          partner_id: form.id,
          partner_data: {
            name: form.name,
            display_name: form.display_name,
            status: form.status || "active",
            supported_corridors: form.supported_corridors || [],
            api_base_url: form.api_base_url,
            api_environment: form.api_environment || "sandbox",
            auto_settlement: form.auto_settlement || false,
            settlement_frequency: form.settlement_frequency || "daily",
          },
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-remittance-partners"] });
      toast({ title: "Partner saved" });
      setPartnerDialog(null);
      setPartnerForm({});
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const corridorMutation = useMutation({
    mutationFn: async (form: any) => {
      const res = await supabase.functions.invoke("remittance-engine", {
        body: {
          action: "admin_manage_corridor",
          operation: form.id ? "update" : "create",
          corridor_id: form.id,
          corridor_data: {
            partner_id: form.partner_id,
            from_country: form.from_country,
            to_country: form.to_country || "CM",
            from_currency: form.from_currency,
            to_currency: form.to_currency || "XAF",
            min_amount: Number(form.min_amount) || 0,
            max_amount: Number(form.max_amount) || 10000000,
            est_delivery_seconds: Number(form.est_delivery_seconds) || 3600,
            fees_model: {
              fx_rate: Number(form.fx_rate) || 1,
              fee_percentage: Number(form.fee_percentage) || 0,
            },
            is_active: form.is_active !== false,
            settlement_delay_hours: Number(form.settlement_delay_hours) || 24,
            requires_kyc_level: form.requires_kyc_level || "basic",
          },
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-remittance-corridors"] });
      toast({ title: "Corridor saved" });
      setCorridorDialog(null);
      setCorridorForm({});
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditPartner = (p: any) => {
    setPartnerForm({ ...p });
    setPartnerDialog("edit");
  };

  const openEditCorridor = (c: any) => {
    const fees = (c.fees_model as any) || {};
    setCorridorForm({
      ...c,
      fx_rate: fees.fx_rate || 1,
      fee_percentage: fees.fee_percentage || 0,
    });
    setCorridorDialog("edit");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Settings2}
        title="Remittance Partners & Corridors"
        description="Manage remittance partner configurations, corridors, and fee models"
      />

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="corridors">Corridors</TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setPartnerForm({}); setPartnerDialog("new"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {partners?.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            {p.display_name || p.name}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                            <Button variant="ghost" size="icon" onClick={() => openEditPartner(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Name</span><span className="font-mono">{p.name}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Environment</span>
                          <Badge variant="outline" className="text-[10px]">{(p as any).api_environment || "sandbox"}</Badge>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Auto Settlement</span>
                          <span>{(p as any).auto_settlement ? "Yes" : "No"}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Frequency</span>
                          <span className="capitalize">{(p as any).settlement_frequency || "daily"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
              {(!partners || partners.length === 0) && (
                <Card className="col-span-full"><CardContent className="py-12 text-center text-muted-foreground">No partners configured</CardContent></Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Corridors Tab */}
        <TabsContent value="corridors" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setCorridorForm({}); setCorridorDialog("new"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Corridor
            </Button>
          </div>

          {loadingCorridors ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>FX Rate</TableHead>
                      <TableHead>Fee %</TableHead>
                      <TableHead>Min / Max</TableHead>
                      <TableHead>KYC Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corridors?.map((c, i) => {
                      const fees = (c.fees_model as any) || {};
                      return (
                        <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b hover:bg-muted/50">
                          <TableCell className="font-medium">{(c as any).remittance_partners?.name || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              {c.from_country} <ArrowRight className="h-3 w-3" /> {c.to_country}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{c.from_currency} → {c.to_currency}</TableCell>
                          <TableCell className="font-mono text-sm">{fees.fx_rate || "—"}</TableCell>
                          <TableCell className="text-sm">{fees.fee_percentage || 0}%</TableCell>
                          <TableCell className="text-xs">
                            {Number(c.min_amount || 0).toLocaleString()} – {Number(c.max_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{(c as any).requires_kyc_level || "basic"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => openEditCorridor(c)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                    {(!corridors || corridors.length === 0) && (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No corridors configured</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Partner Dialog */}
      <Dialog open={!!partnerDialog} onOpenChange={() => { setPartnerDialog(null); setPartnerForm({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{partnerForm.id ? "Edit" : "Add"} Remittance Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name (slug)</Label>
                <Input value={partnerForm.name || ""} onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })} placeholder="thunes" />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={partnerForm.display_name || ""} onChange={e => setPartnerForm({ ...partnerForm, display_name: e.target.value })} placeholder="Thunes" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={partnerForm.status || "active"} onValueChange={v => setPartnerForm({ ...partnerForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Environment</Label>
                <Select value={partnerForm.api_environment || "sandbox"} onValueChange={v => setPartnerForm({ ...partnerForm, api_environment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>API Base URL</Label>
              <Input value={partnerForm.api_base_url || ""} onChange={e => setPartnerForm({ ...partnerForm, api_base_url: e.target.value })} placeholder="https://api.partner.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Settlement Frequency</Label>
                <Select value={partnerForm.settlement_frequency || "daily"} onValueChange={v => setPartnerForm({ ...partnerForm, settlement_frequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={partnerForm.auto_settlement || false} onCheckedChange={v => setPartnerForm({ ...partnerForm, auto_settlement: v })} />
                <Label>Auto Settlement</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPartnerDialog(null); setPartnerForm({}); }}>Cancel</Button>
            <Button disabled={!partnerForm.name || partnerMutation.isPending} onClick={() => partnerMutation.mutate(partnerForm)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Corridor Dialog */}
      <Dialog open={!!corridorDialog} onOpenChange={() => { setCorridorDialog(null); setCorridorForm({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{corridorForm.id ? "Edit" : "Add"} Corridor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Partner</Label>
              <Select value={corridorForm.partner_id || ""} onValueChange={v => setCorridorForm({ ...corridorForm, partner_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>
                  {partners?.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From Country</Label><Input value={corridorForm.from_country || ""} onChange={e => setCorridorForm({ ...corridorForm, from_country: e.target.value })} placeholder="FR" /></div>
              <div><Label>To Country</Label><Input value={corridorForm.to_country || "CM"} onChange={e => setCorridorForm({ ...corridorForm, to_country: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From Currency</Label><Input value={corridorForm.from_currency || ""} onChange={e => setCorridorForm({ ...corridorForm, from_currency: e.target.value })} placeholder="EUR" /></div>
              <div><Label>To Currency</Label><Input value={corridorForm.to_currency || "XAF"} onChange={e => setCorridorForm({ ...corridorForm, to_currency: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>FX Rate</Label><Input type="number" step="0.01" value={corridorForm.fx_rate || ""} onChange={e => setCorridorForm({ ...corridorForm, fx_rate: e.target.value })} /></div>
              <div><Label>Fee %</Label><Input type="number" step="0.1" value={corridorForm.fee_percentage || ""} onChange={e => setCorridorForm({ ...corridorForm, fee_percentage: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Min Amount</Label><Input type="number" value={corridorForm.min_amount || ""} onChange={e => setCorridorForm({ ...corridorForm, min_amount: e.target.value })} /></div>
              <div><Label>Max Amount</Label><Input type="number" value={corridorForm.max_amount || ""} onChange={e => setCorridorForm({ ...corridorForm, max_amount: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Settlement Delay (hrs)</Label><Input type="number" value={corridorForm.settlement_delay_hours || 24} onChange={e => setCorridorForm({ ...corridorForm, settlement_delay_hours: e.target.value })} /></div>
              <div>
                <Label>KYC Level</Label>
                <Select value={corridorForm.requires_kyc_level || "basic"} onValueChange={v => setCorridorForm({ ...corridorForm, requires_kyc_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="enhanced">Enhanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCorridorDialog(null); setCorridorForm({}); }}>Cancel</Button>
            <Button disabled={!corridorForm.partner_id || corridorMutation.isPending} onClick={() => corridorMutation.mutate(corridorForm)}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
