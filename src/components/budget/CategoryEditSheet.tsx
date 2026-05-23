import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateCategory } from "@/hooks/budget/useBudgetApi";
import { formatXAF } from "@/lib/budget/formatXAF";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  budgetId: string;
  category?: { id: string; name: string; limit: number; colour: string } | null;
}

export function CategoryEditSheet({ open, onOpenChange, budgetId, category }: Props) {
  const [limit, setLimit] = useState("");
  const update = useUpdateCategory();

  useEffect(() => {
    if (category) setLimit(String(category.limit));
  }, [category]);

  async function save() {
    if (!category) return;
    await update.mutateAsync({ budgetId, categoryId: category.id, limit: Number(limit) || 0 });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0F172A] border-t border-white/10 text-[#E2EAF4] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle className="text-[#E2EAF4]">{category ? `Edit ${category.name}` : "Edit category"}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <label className="block text-xs uppercase tracking-wider text-slate-400">Monthly limit (XAF)</label>
          <Input
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            className="h-14 text-lg bg-white/5 border-white/10 text-white"
          />
          <div className="text-xs text-slate-500">{formatXAF(Number(limit) || 0)}</div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" className="flex-1 h-12 rounded-2xl border-white/15 bg-transparent text-white hover:bg-white/5" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="flex-1 h-12 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white" disabled={update.isPending} onClick={save}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
