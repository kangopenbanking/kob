import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Save, Trash2, RotateCcw, Armchair, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type CellType = 'seat' | 'aisle' | 'blocked';

interface LayoutCell {
  row: number;
  col: number;
  seat_label: string;
  type: CellType;
}

interface SeatingPlan {
  id: string;
  plan_name: string;
  rows: number;
  columns: number;
  layout: LayoutCell[];
  total_seats: number;
  service_id: string;
}

interface TravelService {
  id: string;
  display_name: string;
  service_type: string;
}

const typeColors: Record<CellType, string> = {
  seat: 'bg-[hsl(150,40%,45%)] text-white hover:bg-[hsl(150,40%,35%)]',
  aisle: 'bg-muted text-muted-foreground hover:bg-muted/80',
  blocked: 'bg-destructive/20 text-destructive hover:bg-destructive/30',
};

const typeLabels: Record<CellType, string> = {
  seat: '💺 Seat',
  aisle: '⬜ Aisle',
  blocked: '🚫 Blocked',
};

function generateLayout(rows: number, cols: number): LayoutCell[] {
  const cells: LayoutCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seatLabel = `${r + 1}${String.fromCharCode(65 + c)}`;
      cells.push({ row: r, col: c, seat_label: seatLabel, type: 'seat' });
    }
  }
  return cells;
}

const MerchantTravelSeating: React.FC = () => {
  const [services, setServices] = useState<TravelService[]>([]);
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SeatingPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(4);
  const [layout, setLayout] = useState<LayoutCell[]>([]);
  const [paintMode, setPaintMode] = useState<CellType>('seat');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: merchant } = await supabase
      .from('gateway_merchants')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!merchant) { setLoading(false); return; }
    setMerchantId(merchant.id);

    const [svcRes, planRes] = await Promise.all([
      supabase.from('travel_services').select('id, display_name, service_type').eq('merchant_id', merchant.id),
      supabase.from('travel_seating_plans').select('*').in('service_id',
        (await supabase.from('travel_services').select('id').eq('merchant_id', merchant.id)).data?.map((s: any) => s.id) || []
      ),
    ]);

    setServices((svcRes.data as any[]) || []);
    setPlans((planRes.data as any[]) || []);
    setLoading(false);
  };

  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanName('');
    setServiceId(services[0]?.id || '');
    setRows(10);
    setCols(4);
    setLayout(generateLayout(10, 4));
    setPaintMode('seat');
    setEditorOpen(true);
  };

  const openEditPlan = (plan: SeatingPlan) => {
    setEditingPlan(plan);
    setPlanName(plan.plan_name);
    setServiceId(plan.service_id);
    setRows(plan.rows);
    setCols(plan.columns);
    setLayout(Array.isArray(plan.layout) ? plan.layout as LayoutCell[] : []);
    setPaintMode('seat');
    setEditorOpen(true);
  };

  const regenerateGrid = useCallback(() => {
    setLayout(generateLayout(rows, cols));
  }, [rows, cols]);

  const toggleCell = (r: number, c: number) => {
    setLayout(prev => prev.map(cell =>
      cell.row === r && cell.col === c ? { ...cell, type: paintMode } : cell
    ));
  };

  const totalSeats = layout.filter(c => c.type === 'seat').length;

  const handleSave = async () => {
    if (!serviceId || !planName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSaving(true);

    const payload = {
      service_id: serviceId,
      plan_name: planName.trim(),
      rows,
      columns: cols,
      layout: layout as any,
      total_seats: totalSeats,
    };

    let error;
    if (editingPlan) {
      ({ error } = await supabase.from('travel_seating_plans').update(payload as any).eq('id', editingPlan.id));
    } else {
      ({ error } = await supabase.from('travel_seating_plans').insert(payload as any));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editingPlan ? 'Seating plan updated!' : 'Seating plan created!');
      setEditorOpen(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('travel_seating_plans').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Plan deleted'); fetchData(); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (services.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Seating Plans</h1>
        <Card><CardContent className="py-10 text-center">
          <Armchair className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">No travel services set up yet</p>
          <p className="text-sm text-muted-foreground">Go to Service Setup first to register a transport service.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seating Plans</h1>
          <p className="text-muted-foreground">Design flexible seat layouts for your vehicles</p>
        </div>
        <Button onClick={openNewPlan}><Plus className="mr-2 h-4 w-4" /> New Plan</Button>
      </div>

      {/* Existing Plans */}
      {plans.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <p className="text-muted-foreground">No seating plans yet. Create your first one!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const svc = services.find(s => s.id === plan.service_id);
            const planLayout = Array.isArray(plan.layout) ? plan.layout as LayoutCell[] : [];
            return (
              <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEditPlan(plan)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.plan_name}</CardTitle>
                    <Badge variant="secondary">{plan.total_seats} seats</Badge>
                  </div>
                  <CardDescription>{svc?.display_name || 'Unknown service'} · {plan.rows}×{plan.columns} grid</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Mini preview */}
                  <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted/50 p-2" style={{ maxWidth: plan.columns * 16 + 16 }}>
                    {planLayout.map((cell, i) => (
                      <div
                        key={i}
                        className={`h-3 w-3 rounded-sm ${cell.type === 'seat' ? 'bg-[hsl(150,40%,45%)]' : cell.type === 'aisle' ? 'bg-transparent' : 'bg-destructive/30'}`}
                        style={{ marginLeft: cell.col === 0 && cell.row > 0 ? 0 : undefined }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); openEditPlan(plan); }}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit' : 'Create'} Seating Plan</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Config */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input placeholder="e.g. 70-seater Coach" value={planName} onChange={(e) => setPlanName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rows</Label>
                <Input type="number" min={1} max={50} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Columns</Label>
                <Input type="number" min={1} max={10} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={regenerateGrid}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate Grid
              </Button>
              <div className="flex items-center gap-1 rounded-lg border p-1">
                {(['seat', 'aisle', 'blocked'] as CellType[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaintMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${paintMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {typeLabels[mode]}
                  </button>
                ))}
              </div>
              <Badge variant="outline" className="ml-auto">{totalSeats} bookable seats</Badge>
            </div>

            {/* Grid Editor */}
            <div className="rounded-xl border bg-muted/30 p-4 overflow-x-auto">
              <div className="flex flex-col items-center gap-1 min-w-fit">
                {/* Column headers */}
                <div className="flex gap-1">
                  <div className="flex h-8 w-8 items-center justify-center" />
                  {Array.from({ length: cols }, (_, c) => (
                    <div key={c} className="flex h-8 w-10 items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {String.fromCharCode(65 + c)}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex gap-1">
                    <div className="flex h-10 w-8 items-center justify-center text-xs font-bold text-muted-foreground">
                      {r + 1}
                    </div>
                    {Array.from({ length: cols }, (_, c) => {
                      const cell = layout.find(l => l.row === r && l.col === c);
                      const cellType = cell?.type || 'seat';
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCell(r, c)}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg text-[10px] font-bold transition-all ${typeColors[cellType]}`}
                          title={`${cell?.seat_label || ''} (${cellType})`}
                        >
                          {cellType === 'seat' ? cell?.seat_label || '' : cellType === 'aisle' ? '' : '×'}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded bg-[hsl(150,40%,45%)]" />
                  <span className="text-xs text-muted-foreground">Seat</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded bg-muted border" />
                  <span className="text-xs text-muted-foreground">Aisle</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded bg-destructive/30" />
                  <span className="text-xs text-muted-foreground">Blocked</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !planName.trim() || !serviceId}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingPlan ? 'Update Plan' : 'Save Plan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MerchantTravelSeating;
