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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { StatCard } from "@/components/ui/stat-card";
import { CorridorQuickSetup } from "@/components/admin/remittance/CorridorQuickSetup";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Plus, Edit, Globe, ArrowRight, CheckCircle2, Settings2,
  Zap, Activity, Clock, MapPin, Wifi, WifiOff, Signal,
} from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  CM: "🇨🇲", FR: "🇫🇷", GB: "🇬🇧", US: "🇺🇸", DE: "🇩🇪", CA: "🇨🇦",
  NG: "🇳🇬", GH: "🇬🇭", KE: "🇰🇪", SN: "🇸🇳", CI: "🇨🇮", ZA: "🇿🇦",
  RW: "🇷🇼", TZ: "🇹🇿", UG: "🇺🇬", ML: "🇲🇱", BF: "🇧🇫", BJ: "🇧🇯",
};

const COUNTRY_NAMES: Record<string, string> = {
  CM: "Cameroon", FR: "France", GB: "United Kingdom", US: "United States",
  DE: "Germany", CA: "Canada", NG: "Nigeria", GH: "Ghana", KE: "Kenya",
  SN: "Senegal", CI: "Côte d'Ivoire", ZA: "South Africa", RW: "Rwanda",
};

const PARTNER_COLORS: Record<string, string> = {
  thunes: "bg-blue-500", terrapay: "bg-emerald-500", onafriq: "bg-amber-500",
  kob_internal: "bg-primary", flutterwave: "bg-orange-500", paypal: "bg-[#0070BA]",
};

function formatDelivery(secs: number | null) {
  if (!secs) return "—";
  if (secs < 60) return `~${secs}s (instant)`;
  if (secs < 3600) return `~${Math.round(secs / 60)} min`;
  if (secs < 7200) return `~1 hr`;
  return `~${Math.round(secs / 3600)} hrs`;
}

export default function RemittancePartners() {
  const queryClient = useQueryClient();
  const [partnerDialog, setPartnerDialog] = useState<any>(null);
  const [corridorDialog, setCorridorDialog] = useState<any>(null);
  const [partnerForm, setPartnerForm] = useState<any>({});
  const [corridorForm, setCorridorForm] = useState<any>({});
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);

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
        .select("*, remittance_partners(id, name, display_name)")
        .order("from_country");
      if (error) throw error;
      return data;
    },
  });

  const partnerMutation = useMutation({
    mutationFn: async (form: any) => {
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
      const { data: { session } } = await supabase.auth.getSession();
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
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
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

  // Stats
  const totalPartners = partners?.length || 0;
  const activePartners = partners?.filter(p => p.status === "active").length || 0;
  const activeCorridors = corridors?.filter(c => c.is_active).length || 0;
  const uniqueCountries = new Set([
    ...(corridors?.map(c => c.from_country) || []),
    ...(corridors?.map(c => c.to_country) || []),
  ]).size;
  const avgDelivery = corridors?.length
    ? Math.round((corridors.reduce((s, c) => s + (c.est_delivery_seconds || 0), 0) / corridors.length) / 60)
    : 0;

  // Per-partner corridor counts
  const partnerCorridorCounts: Record<string, number> = {};
  corridors?.forEach(c => {
    partnerCorridorCounts[c.partner_id] = (partnerCorridorCounts[c.partner_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Settings2}
        title="Remittance Partners & Corridors"
        description="Manage remittance partner configurations, corridors, and fee models — Wise / WorldRemit grade"
      />

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Partners" value={totalPartners} icon={<Building2 />} trend={activePartners > 0 ? { value: Math.round((activePartners / Math.max(totalPartners, 1)) * 100), label: "active" } : undefined} />
        <StatCard title="Active Corridors" value={activeCorridors} icon={<Globe />} />
        <StatCard title="Countries" value={uniqueCountries} icon={<MapPin />} />
        <StatCard title="Avg Delivery" value={`${avgDelivery} min`} icon={<Clock />} />
      </div>

      <Tabs defaultValue="partners" className="space-y-4">
        <TabsList>
          <TabsTrigger value="partners">Partners ({totalPartners})</TabsTrigger>
          <TabsTrigger value="corridors">Corridors ({corridors?.length || 0})</TabsTrigger>
        </TabsList>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuickSetupOpen(true)}>
              <Zap className="h-4 w-4 mr-1" /> Quick Setup
            </Button>
            <Button onClick={() => { setPartnerForm({}); setPartnerDialog("new"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Partner
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {partners?.map((p, i) => {
                  const corridorCount = partnerCorridorCounts[p.id] || 0;
                  const colorClass = PARTNER_COLORS[p.name] || "bg-primary";
                  const isActive = p.status === "active";

                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="hover:shadow-md transition-all duration-300 group relative overflow-hidden">
                        {/* Color bar */}
                        <div className={`absolute top-0 left-0 right-0 h-1 ${colorClass}`} />

                        <CardHeader className="pb-2 pt-5">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-xl ${colorClass} flex items-center justify-center text-white font-bold text-sm`}>
                                {(p.display_name || p.name).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <CardTitle className="text-base">{p.display_name || p.name}</CardTitle>
                                <p className="text-xs text-muted-foreground font-mono">{p.name}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditPartner(p)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3 pb-4">
                          {/* Status + Environment */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              {isActive ? (
                                <Signal className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                                {p.status}
                              </Badge>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {(p as any).api_environment || "sandbox"}
                            </Badge>
                          </div>

                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-2.5">
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{corridorCount}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Corridors</p>
                            </div>
                            <div className="text-center border-x border-border/50">
                              <p className="text-lg font-bold text-foreground capitalize">{(p as any).settlement_frequency || "daily"}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Settlement</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-foreground">{(p as any).auto_settlement ? "Auto" : "Manual"}</p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mode</p>
                            </div>
                          </div>

                          {/* API URL */}
                          {(p as any).api_base_url && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                              <Wifi className="h-3 w-3 shrink-0" />
                              <span className="truncate font-mono">{(p as any).api_base_url}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {(!partners || partners.length === 0) && (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No partners configured</p>
                    <p className="text-sm mt-1">Click "Quick Setup" to seed default international partners</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Corridors Tab */}
        <TabsContent value="corridors" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuickSetupOpen(true)}>
              <Zap className="h-4 w-4 mr-1" /> Quick Setup
            </Button>
            <Button onClick={() => { setCorridorForm({}); setCorridorDialog("new"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Corridor
            </Button>
          </div>

          {loadingCorridors ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <Card>
              <ScrollArea className="h-[560px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>FX Rate</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Limits</TableHead>
                      <TableHead>KYC</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corridors?.map((c, i) => {
                      const fees = (c.fees_model as any) || {};
                      const partnerInfo = (c as any).remittance_partners;
                      const partnerColor = partnerInfo ? PARTNER_COLORS[partnerInfo.name] || "bg-primary" : "bg-muted";

                      return (
                        <motion.tr
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="border-b hover:bg-muted/50"
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${partnerColor}`} />
                              <span className="font-medium text-sm">{partnerInfo?.display_name || partnerInfo?.name || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <span>{COUNTRY_FLAGS[c.from_country] || ""}</span>
                              <span className="font-medium">{COUNTRY_NAMES[c.from_country] || c.from_country}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span>{COUNTRY_FLAGS[c.to_country] || ""}</span>
                              <span className="font-medium">{COUNTRY_NAMES[c.to_country] || c.to_country}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{c.from_currency} → {c.to_currency}</TableCell>
                          <TableCell className="font-mono text-sm">{fees.fx_rate || "—"}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div>{fees.fee_percentage || 0}%</div>
                              {fees.fixed_fee && (
                                <div className="text-muted-foreground">+ {fees.fixed_fee} {fees.fee_currency || c.from_currency}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatDelivery(c.est_delivery_seconds)}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>{Number(c.min_amount).toLocaleString()} – {Number(c.max_amount).toLocaleString()}</div>
                            <div className="text-muted-foreground">{c.from_currency}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] capitalize">{(c as any).requires_kyc_level || "basic"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-2 w-2 rounded-full ${c.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                              <span className="text-xs">{c.is_active ? "Active" : "Inactive"}</span>
                            </div>
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
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                          <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No corridors configured</p>
                          <p className="text-sm mt-1">Use "Quick Setup" to create corridors automatically</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick Setup */}
      <CorridorQuickSetup
        open={quickSetupOpen}
        onOpenChange={setQuickSetupOpen}
        partners={(partners || []).map(p => ({ id: p.id, name: p.name, display_name: p.display_name }))}
        existingCorridors={(corridors || []).map(c => ({ from_country: c.from_country, to_country: c.to_country, partner_id: c.partner_id }))}
      />

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
