import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Search, IdCard, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecipientResult {
  user_id: string;
  kang_id: string | null;
  full_name: string | null;
  phone_masked: string | null;
  match_type: "kang_id" | "phone" | "name";
}

interface RecipientPickerProps {
  /** Called when the user picks a recipient row. */
  onSelect: (recipient: RecipientResult) => void;
  /** Optional: hide the user themselves from the list. */
  excludeUserId?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Production-grade recipient picker for send / transfer / split-bill flows.
 * Searches by KANG ID (exact), phone number, or full name via the
 * `lookup_recipient` RPC. Debounced 250ms; minimum 2 characters.
 */
export function RecipientPicker({
  onSelect,
  excludeUserId,
  placeholder = "Search by KANG ID, phone, or name",
  className,
}: RecipientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const { data, error } = await (supabase as any).rpc("lookup_recipient", {
        _query: q,
        _limit: 10,
      });
      if (!error && Array.isArray(data)) {
        const filtered = excludeUserId
          ? (data as RecipientResult[]).filter((r) => r.user_id !== excludeUserId)
          : (data as RecipientResult[]);
        setResults(filtered);
      } else {
        setResults([]);
      }
      setLoading(false);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, excludeUserId]);

  const showEmpty = useMemo(
    () => !loading && query.trim().length >= 2 && results.length === 0,
    [loading, query, results.length],
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search recipient"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {results.map((r) => {
            const Icon =
              r.match_type === "kang_id" ? IdCard : r.match_type === "phone" ? Phone : User;
            return (
              <li key={r.user_id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40 focus:bg-muted/60 focus:outline-none"
                >
                  <div className="rounded-lg border border-border bg-muted/40 p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.full_name || "Unnamed account"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.kang_id ? <span className="font-mono">{r.kang_id}</span> : null}
                      {r.kang_id && r.phone_masked ? <span className="mx-1">·</span> : null}
                      {r.phone_masked || null}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showEmpty && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-center text-sm text-muted-foreground">
          No accounts found for "{query.trim()}"
        </p>
      )}
    </div>
  );
}
