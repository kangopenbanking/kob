import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Percent, DollarSign, Tag, Trash2, Edit, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface Discount {
  id: string;
  service_id: string;
  discount_name: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_seats: number;
  max_uses: number | null;
  current_uses: number;
  promo_code: string | null;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

const MerchantTravelDiscounts: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Discount | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    service_id: '', discount_name: '', discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '', min_seats: '1', max_uses: '', promo_code: '',
    valid_from: '', valid_until: '',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }

    const { data: svcData } = await supabase.from('travel_services').select('id, display_name, service_type').eq('merchant_id', merchant.id);
    setServices(svcData || []);
    const svcIds = (svcData || []).map((s: any) => s.id);

    if (svcIds.length > 0) {
      const { data: discData } = await supabase.from('travel_discounts').select('*').in('service_id', svcIds).order('created_at', { ascending: false });
      setDiscounts((discData as any[]) || []);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      service_id: services[0]?.id || '', discount_name: '', discount_type: 'percentage',
      discount_value: '', min_seats: '1', max_uses: '', promo_code: '',
      valid_from: new Date().toISOString().slice(0, 16), valid_until: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (d: Discount) => {
    setEditing(d);
    setForm({
      service_id: d.service_id, discount_name: d.discount_name, discount_type: d.discount_type,
      discount_value: String(d.discount_value), min_seats: String(d.min_seats),
      max_uses: d.max_uses ? String(d.max_uses) : '', promo_code: d.promo_code || '',
      valid_from: d.valid_from ? d.valid_from.slice(0, 16) : '',
      valid_until: d.valid_until ? d.valid_until.slice(0, 16) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_id || !form.discount_name.trim() || !form.discount_value) {
      toast.error('Fill in required fields'); return;
    }
    setSaving(true);
    const payload = {
      service_id: form.service_id,
      discount_name: form.discount_name.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      min_seats: parseInt(form.min_seats) || 1,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      promo_code: form.promo_code.trim().toUpperCase() || null,
      valid_from: form.valid_from || new Date().toISOString(),
      valid_until: form.valid_until || null,
    };

    if (editing) {
      const { error } = await supabase.from('travel_discounts').update(payload as any).eq('id', editing.id);
      if (error) toast.error(extractEdgeFunctionError(error)); else { toast.success('Discount updated'); setDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from('travel_discounts').insert(payload as any);
      if (error) toast.error(extractEdgeFunctionError(error)); else { toast.success('Discount created'); setDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const toggleActive = async (d: Discount) => {
    await supabase.from('travel_discounts').update({ is_active: !d.is_active } as any).eq('id', d.id);
    setDiscounts(prev => prev.map(x => x.id === d.id ? { ...x, is_active: !x.is_active } : x));
  };

  const deleteDiscount = async (id: string) => {
    if (!confirm('Delete this discount?')) return;
    await supabase.from('travel_discounts').delete().eq('id', id);
    toast.success('Discount deleted');
    fetchData();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Promo code copied!');
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Discounts & Promos</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount codes for your travel services</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={services.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> New Discount
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{discounts.length}</p><p className="text-xs text-muted-foreground">Total Discounts</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{discounts.filter(d => d.is_active).length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="pt-6"><p className="text-xl md:text-2xl font-bold">{discounts.reduce((s, d) => s + d.current_uses, 0)}</p><p className="text-xs text-muted-foreground">Total Uses</p></CardContent></Card>
      </div>

      {/* Discount List */}
      {discounts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Tag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">No discounts yet</p>
          <p className="text-sm">Create your first discount or promo code to attract more customers.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {discounts.map(d => {
            const svc = services.find(s => s.id === d.service_id);
            const isExpired = d.valid_until && new Date(d.valid_until) < new Date();
            const usageFull = d.max_uses !== null && d.current_uses >= d.max_uses;
            return (
              <Card key={d.id} className={!d.is_active || isExpired || usageFull ? 'opacity-60' : ''}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    {d.discount_type === 'percentage' ? <Percent className="h-5 w-5 text-primary" /> : <DollarSign className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0 basis-[55%]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{d.discount_name}</p>
                      <Badge variant={d.is_active && !isExpired && !usageFull ? 'default' : 'secondary'}>
                        {isExpired ? 'Expired' : usageFull ? 'Limit Reached' : d.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      {d.discount_type === 'percentage' ? `${d.discount_value}% off` : `${d.discount_value} XAF off`}
                      {d.min_seats > 1 && ` · Min ${d.min_seats} seats`}
                      {d.max_uses && ` · ${d.current_uses}/${d.max_uses} used`}
                      {svc && ` · ${svc.display_name}`}
                    </p>
                    {d.promo_code && (
                      <button onClick={() => copyCode(d.promo_code!)} className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-bold text-foreground hover:bg-muted/80 transition-colors">
                        <Copy className="h-3 w-3" /> {d.promo_code}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDiscount(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Discount' : 'Create Discount'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {services.length > 1 && (
              <div className="space-y-1">
                <Label className="text-xs">Service</Label>
                <Select value={form.service_id} onValueChange={v => setForm(f => ({ ...f, service_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Discount Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Early Bird 20%" value={form.discount_name} onChange={e => setForm(f => ({ ...f, discount_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={form.discount_type} onValueChange={(v: any) => setForm(f => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (XAF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value <span className="text-destructive">*</span></Label>
                <Input type="number" placeholder={form.discount_type === 'percentage' ? 'e.g. 15' : 'e.g. 500'} value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min Seats</Label>
                <Input type="number" value={form.min_seats} onChange={e => setForm(f => ({ ...f, min_seats: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Uses (blank = unlimited)</Label>
                <Input type="number" placeholder="Unlimited" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Promo Code (optional)</Label>
              <Input placeholder="e.g. SUMMER25" className="font-mono uppercase" value={form.promo_code}
                onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))} />
              <p className="text-[11px] text-muted-foreground">Customers enter this code at checkout. Leave blank for auto-applied discount.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valid From</Label>
                <Input type="datetime-local" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valid Until (blank = no expiry)</Label>
                <Input type="datetime-local" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              {editing ? 'Update Discount' : 'Create Discount'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelDiscounts;
