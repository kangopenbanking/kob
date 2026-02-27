import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Pencil, Power, PowerOff, Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreateFeeStructureForm } from "./CreateFeeStructureForm";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FeeStructuresTableProps {
  structures: any[];
  institutions?: any[];
  onRefresh: () => void;
}

const MODEL_COLORS: Record<string, string> = {
  fixed: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  percentage: "bg-blue-500/10 text-blue-700 border-blue-200",
  hybrid: "bg-purple-500/10 text-purple-700 border-purple-200",
  tiered: "bg-amber-500/10 text-amber-700 border-amber-200",
};

export function FeeStructuresTable({ structures, institutions = [], onRefresh }: FeeStructuresTableProps) {
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("fee_structures").update({ is_active: !currentActive }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentActive ? "Deactivated" : "Activated", description: "Fee structure updated" });
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    const { error } = await supabase.from("fee_structures").delete().eq("id", deleteItem.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Fee structure removed" });
      setDeleteItem(null);
      onRefresh();
    }
  };

  const handleEdit = async (formData: any) => {
    if (!editItem) return;
    const { error } = await supabase.from("fee_structures").update({
      institution_id: formData.institution_id,
      transaction_type: formData.transaction_type,
      fee_model: formData.fee_model,
      fixed_amount: formData.fixed_amount || 0,
      percentage_rate: formData.percentage_rate || 0,
      min_fee_amount: formData.min_fee_amount || 0,
      max_fee_amount: formData.max_fee_amount || null,
      tiered_rates: formData.tiered_rates || null,
      effective_from: formData.effective_from,
      effective_until: formData.effective_until,
    }).eq("id", editItem.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "Fee structure updated successfully" });
      setEditItem(null);
      onRefresh();
    }
  };

  const duplicate = async (structure: any) => {
    const { id, created_at, updated_at, institutions: _, ...rest } = structure;
    const { error } = await supabase.from("fee_structures").insert({ ...rest, is_active: false });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Duplicated", description: "Fee structure copied (inactive)" });
      onRefresh();
    }
  };

  if (structures.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-12 text-center">
        <p className="text-muted-foreground">No fee structures configured yet. Create your first one above.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {structures.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{s.institutions?.institution_name || 'Unknown'}</span>
                    {!s.is_active && <Badge variant="outline" className="text-[10px] border-destructive text-destructive">Inactive</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{s.transaction_type.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-[11px] font-semibold ${MODEL_COLORS[s.fee_model] || ''}`}>
                  {s.fee_model.toUpperCase()}
                </Badge>

                <div className="text-right hidden sm:block">
                  {s.fixed_amount > 0 && <p className="text-sm font-bold">{Number(s.fixed_amount).toLocaleString()} XAF</p>}
                  {s.percentage_rate > 0 && <p className="text-sm font-bold">{s.percentage_rate}%</p>}
                  {s.fee_model === 'tiered' && <p className="text-xs text-muted-foreground">{(s.tiered_rates as any[])?.length || 0} tiers</p>}
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                  {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditItem(s)}><Pencil className="h-3 w-3 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate(s)}><Copy className="h-3 w-3 mr-2" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active ? <><PowerOff className="h-3 w-3 mr-2" /> Deactivate</> : <><Power className="h-3 w-3 mr-2" /> Activate</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteItem(s)}>
                      <Trash2 className="h-3 w-3 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <AnimatePresence>
              {expandedId === s.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Effective From</span><p className="font-medium">{new Date(s.effective_from).toLocaleDateString()}</p></div>
                    <div><span className="text-muted-foreground text-xs">Effective Until</span><p className="font-medium">{s.effective_until ? new Date(s.effective_until).toLocaleDateString() : 'Ongoing'}</p></div>
                    {s.min_fee_amount > 0 && <div><span className="text-muted-foreground text-xs">Min Fee</span><p className="font-medium">{Number(s.min_fee_amount).toLocaleString()} XAF</p></div>}
                    {s.max_fee_amount && <div><span className="text-muted-foreground text-xs">Max Fee</span><p className="font-medium">{Number(s.max_fee_amount).toLocaleString()} XAF</p></div>}
                    {s.fee_model === 'tiered' && Array.isArray(s.tiered_rates) && (
                      <div className="col-span-full">
                        <span className="text-muted-foreground text-xs">Tiers</span>
                        <div className="mt-1 grid grid-cols-4 gap-1 text-xs font-medium bg-muted/50 rounded-lg p-2">
                          <span>Min</span><span>Max</span><span>Fixed</span><span>%</span>
                          {(s.tiered_rates as any[]).map((t: any, i: number) => (
                            <><span key={`min${i}`}>{Number(t.min).toLocaleString()}</span><span key={`max${i}`}>{t.max ? Number(t.max).toLocaleString() : '∞'}</span><span key={`fix${i}`}>{t.fixed}</span><span key={`pct${i}`}>{t.percentage}%</span></>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Fee Structure</DialogTitle>
            <DialogDescription>Modify the fee structure configuration</DialogDescription>
          </DialogHeader>
          {editItem && (
            <CreateFeeStructureForm
              institutions={institutions}
              onSubmit={handleEdit}
              onCancel={() => setEditItem(null)}
              initialData={editItem}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the fee structure for <strong>{deleteItem?.institutions?.institution_name}</strong> — <em>{deleteItem?.transaction_type}</em>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
