import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-0 p-6"
        style={{
          background: "var(--bud-bg)",
          color: "var(--bud-text)",
          borderTop: "1px solid var(--bud-border)",
        }}
      >
        <SheetHeader>
          <SheetTitle style={{ color: "var(--bud-text)" }}>
            {category ? `Edit ${category.name}` : "Edit category"}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <label
            className="block text-xs uppercase tracking-wider"
            style={{ color: "var(--bud-text-3)" }}
          >
            Monthly limit (XAF)
          </label>
          <input
            inputMode="numeric"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
            className="h-14 w-full rounded-2xl px-4 text-lg outline-none focus:ring-2 focus:ring-sky-500/40"
            style={{
              background: "var(--bud-input-bg)",
              border: "1px solid var(--bud-border)",
              color: "var(--bud-text)",
            }}
          />
          <div className="text-xs" style={{ color: "var(--bud-text-3)" }}>
            {formatXAF(Number(limit) || 0)}
          </div>
          <div className="flex gap-2 pt-3">
            <button
              className="flex-1 h-12 rounded-2xl text-sm font-medium"
              style={{
                border: "1px solid var(--bud-border)",
                background: "transparent",
                color: "var(--bud-text)",
              }}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              className="flex-1 h-12 rounded-2xl text-sm font-semibold disabled:opacity-50 transition-transform active:scale-[0.98]"
              style={{ background: "var(--bud-cta-bg)", color: "var(--bud-cta-fg)" }}
              disabled={update.isPending}
              onClick={save}
            >
              {update.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
