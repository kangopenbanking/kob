import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Plus, Save, Trash2, RotateCcw, Armchair, Grid3X3, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

type CellType = 'seat' | 'aisle' | 'blocked';

interface LayoutCell { row: number; col: number; seat_label: string; type: CellType; }
interface SeatingPlan { id: string; plan_name: string; rows: number; columns: number; layout: LayoutCell[]; total_seats: number; service_id: string; }
interface TravelService { id: string; display_name: string; service_type: string; }

const typeColors: Record<CellType, string> = {
  seat: 'bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30',
  aisle: 'bg-muted/50 text-muted-foreground hover:bg-muted/70 border border-transparent',
  blocked: 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20',
};

const COACH_PRESETS = [
  { label: 'Mini Bus (15 seats)', rows: 5, cols: 3, totalSeats: 15, aisleCol: 1 },
  { label: 'Standard Bus (30 seats)', rows: 10, cols: 4, totalSeats: 30, aisleCol: 2 },
  { label: 'Coach (50 seats)', rows: 13, cols: 5, totalSeats: 50, aisleCol: 2 },
  { label: 'Large Coach (70 seats)', rows: 14, cols: 5, totalSeats: 70, aisleCol: -1 },
  { label: 'Tour Van (8 seats)', rows: 3, cols: 3, totalSeats: 8, aisleCol: -1 },
  { label: 'Custom', rows: 0, cols: 0, totalSeats: 0, aisleCol: -1 },
];

function generateLayout(rows: number, cols: number, aisleCol: number = -1): LayoutCell[] {
  const cells: LayoutCell[] = [];
  let seatNum = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isAisle = c === aisleCol;
      const seatLabel = isAisle ? '' : `${seatNum}`;
      if (!isAisle) seatNum++;
      cells.push({ row: r, col: c, seat_label: isAisle ? `A${r}` : seatLabel, type: isAisle ? 'aisle' : 'seat' });
    }
  }
  return cells;
}

const MerchantTravelSeating: React.FC = () => {
  const [services, setServices] = useState<TravelService[]>([]);
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SeatingPlan | null>(null);
  const [planName, setPlanName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(4);
  const [targetSeats, setTargetSeats] = useState(30);
  const [layout, setLayout] = useState<LayoutCell[]>([]);
  const [paintMode, setPaintMode] = useState<CellType>('seat');
  const [saving, setSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('user_id', user.id).maybeSingle();
    if (!merchant) { setLoading(false); return; }

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

  const applyPreset = (presetLabel: string) => {
    setSelectedPreset(presetLabel);
    const preset = COACH_PRESETS.find(p => p.label === presetLabel);
    if (!preset || preset.label === 'Custom') return;
    setRows(preset.rows);
    setCols(preset.cols);
    setTargetSeats(preset.totalSeats);
    setLayout(generateLayout(preset.rows, preset.cols, preset.aisleCol));
  };

  const openNewPlan = () => {
    setEditingPlan(null); setPlanName(''); setServiceId(services[0]?.id || '');
    setRows(10); setCols(4); setTargetSeats(30); setSelectedPreset('');
    setLayout(generateLayout(10, 4, 2)); setPaintMode('seat'); setEditorOpen(true);
  };

  const openEditPlan = (plan: SeatingPlan) => {
    setEditingPlan(plan); setPlanName(plan.plan_name); setServiceId(plan.service_id);
    setRows(plan.rows); setCols(plan.columns); setSelectedPreset('');
    setTargetSeats(plan.total_seats);
    setLayout(Array.isArray(plan.layout) ? plan.layout as LayoutCell[] : []);
    setPaintMode('seat'); setEditorOpen(true);
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
    if (!serviceId || !planName.trim()) { toast.error('Please fill in all fields'); return; }
    setSaving(true);
    const payload = { service_id: serviceId, plan_name: planName.trim(), rows, columns: cols, layout: layout as any, total_seats: totalSeats };
    let error;
    if (editingPlan) { ({ error } = await supabase.from('travel_seating_plans').update(payload as any).eq('id', editingPlan.id)); }
    else { ({ error } = await supabase.from('travel_seating_plans').insert(payload as any)); }
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success(editingPlan ? 'Plan updated!' : 'Plan created!'); setEditorOpen(false); fetchData(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('travel_seating_plans').delete().eq('id', id);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success('Plan deleted'); fetchData(); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

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
          <p className="text-muted-foreground">Design coach layouts with rows, columns & seat counts</p>
        </div>
        <Button onClick={openNewPlan}><Plus className="mr-2 h-4 w-4" /> New Plan</Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><Grid3X3 className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{plans.length}</p><p className="text-[11px] text-muted-foreground">Total Plans</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10"><Armchair className="h-5 w-5 text-secondary" /></div>
            <div><p className="text-2xl font-bold">{plans.reduce((sum, p) => sum + p.total_seats, 0)}</p><p className="text-[11px] text-muted-foreground">Total Seats</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10"><Users className="h-5 w-5 text-accent" /></div>
            <div><p className="text-2xl font-bold">{services.length}</p><p className="text-[11px] text-muted-foreground">Services</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Plans grid */}
      {plans.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><p className="text-muted-foreground">No seating plans yet. Create your first one!</p></CardContent></Card>
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
                  <CardDescription>{svc?.display_name || 'Unknown'} · {plan.rows}×{plan.columns} grid</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-0.5 rounded-lg bg-muted/30 p-2" style={{ gridTemplateColumns: `repeat(${plan.columns}, 1fr)`, maxWidth: plan.columns * 14 + 16 }}>
                    {planLayout.map((cell, i) => (
                      <div key={i} className={`h-2.5 w-2.5 rounded-sm ${cell.type === 'seat' ? 'bg-secondary/60' : cell.type === 'aisle' ? 'bg-transparent' : 'bg-destructive/30'}`} />
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
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit' : 'Create'} Seating Plan</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Coach preset selector */}
            <div>
              <Label className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Coach Preset</Label>
              <div className="flex flex-wrap gap-2">
                {COACH_PRESETS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.label)}
                    className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${selectedPreset === p.label ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Config row */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-[12px]">Plan Name</Label>
                <Input placeholder="e.g. 70-Seater Coach" value={planName} onChange={(e) => setPlanName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Rows</Label>
                <Input type="number" min={1} max={50} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Columns</Label>
                <Input type="number" min={1} max={10} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Target Seats</Label>
                <Input type="number" min={1} max={200} value={targetSeats} onChange={(e) => setTargetSeats(Number(e.target.value))} />
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={regenerateGrid}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate Grid
              </Button>
              <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
                {(['seat', 'aisle', 'blocked'] as CellType[]).map((mode) => (
                  <button key={mode} onClick={() => setPaintMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${paintMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted'}`}>
                    {mode === 'seat' ? '💺 Seat' : mode === 'aisle' ? '⬜ Aisle' : '🚫 Blocked'}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-3">
                <Badge variant={totalSeats === targetSeats ? 'default' : 'outline'}
                  className={totalSeats === targetSeats ? 'bg-secondary text-secondary-foreground' : totalSeats > targetSeats ? 'border-destructive text-destructive' : ''}>
                  {totalSeats}/{targetSeats} seats
                </Badge>
                {totalSeats !== targetSeats && (
                  <span className="text-[11px] text-muted-foreground">
                    {totalSeats < targetSeats ? `${targetSeats - totalSeats} more needed` : `${totalSeats - targetSeats} over target`}
                  </span>
                )}
              </div>
            </div>

            {/* Grid Editor */}
            <div className="rounded-xl border bg-muted/20 p-4 overflow-x-auto">
              <div className="flex flex-col items-center gap-0.5 min-w-fit">
                {/* Column headers */}
                <div className="flex gap-0.5">
                  <div className="flex h-8 w-8 items-center justify-center" />
                  {Array.from({ length: cols }, (_, c) => (
                    <div key={c} className="flex h-8 w-10 items-center justify-center text-[10px] font-bold text-muted-foreground">{String.fromCharCode(65 + c)}</div>
                  ))}
                </div>
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="flex gap-0.5">
                    <div className="flex h-10 w-8 items-center justify-center text-[10px] font-bold text-muted-foreground">{r + 1}</div>
                    {Array.from({ length: cols }, (_, c) => {
                      const cell = layout.find(l => l.row === r && l.col === c);
                      const cellType = cell?.type || 'seat';
                      return (
                        <button key={c} onClick={() => toggleCell(r, c)}
                          className={`flex h-10 w-10 items-center justify-center rounded-lg text-[9px] font-bold transition-all ${typeColors[cellType]}`}
                          title={`Row ${r + 1}, Col ${String.fromCharCode(65 + c)} (${cellType})`}>
                          {cellType === 'seat' ? cell?.seat_label || '' : cellType === 'aisle' ? '' : '×'}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-5 text-[11px]">
                <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded bg-secondary/20 border border-secondary/30" /> Seat</span>
                <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded bg-muted/50 border" /> Aisle</span>
                <span className="flex items-center gap-1.5"><div className="h-3.5 w-3.5 rounded bg-destructive/10 border border-destructive/20" /> Blocked</span>
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
