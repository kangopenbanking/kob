import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CM_BANKS } from "@/constants/cameroon-banks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Bank {
  code: string;
  name: string;
  source?: string;
}

interface BankSelectorProps {
  selectedBank: string;
  onBankChange: (code: string, name: string, source: string) => void;
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
  country?: string;
}

export const BankSelector = ({
  selectedBank,
  onBankChange,
  accountNumber,
  onAccountNumberChange,
  country = "CM",
}: BankSelectorProps) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadBanks();
  }, [country]);

  const loadBanks = async () => {
    setLoading(true);
    const kobBankList: Bank[] = [];
    const fwBankList: Bank[] = [];

    // Priority 1: User's linked bank accounts
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: linkedAccounts } = await supabase
          .from("accounts")
          .select("id, account_holder_name, swift_bic, rib_bank_code, institution_id")
          .eq("user_id", user.id)
          .eq("is_active", true) as { data: any[] | null };

        if (linkedAccounts?.length) {
          linkedAccounts.forEach((acc: any) => {
            const bankCode = acc.rib_bank_code || acc.swift_bic || acc.id;
            const bankName = acc.account_holder_name ? `${acc.account_holder_name} (Linked)` : `Linked Account`;
            if (!kobBankList.some(b => b.code === bankCode)) {
              kobBankList.push({ code: bankCode, name: bankName, source: "linked" });
            }
          });
        }
      }
    } catch (err) {
      console.warn("[BankSelector] Linked accounts fetch failed:", err);
    }

    // Priority 2: KOB Partner banks (local institutions)
    try {
      const query = supabase
        .from("institutions" as any)
        .select("id, institution_name, swift_bic_code")
        .eq("is_active", true)
        .order("institution_name");
      const { data: kobInst } = await query;
      if (kobInst?.length) {
        kobInst.forEach((inst: any) => {
          const exists = kobBankList.some(b => b.code === (inst.swift_bic_code || inst.id));
          if (!exists) {
            kobBankList.push({ code: inst.swift_bic_code || inst.id, name: inst.institution_name, source: "kob" });
          }
        });
      }
    } catch (err) {
      console.warn("[BankSelector] KOB institutions fetch failed:", err);
    }

    // Priority 3: Flutterwave banks (external network)
    try {
      const { data, error } = await supabase.functions.invoke("flutterwave-list-banks", {
        body: { country },
      }) as { data: any; error: any };
      if (!error && data?.banks?.length) {
        data.banks.forEach((b: any) => {
          const isDuplicate = kobBankList.some(
            (kb) => kb.name.toLowerCase().includes(b.name?.toLowerCase()?.slice(0, 10))
          );
          if (!isDuplicate) {
            fwBankList.push({ code: b.code, name: b.name, source: "flutterwave" });
          }
        });
      }
    } catch (err) {
      console.warn("[BankSelector] Flutterwave fetch failed:", err);
    }

    // Merge: KOB first, then Flutterwave, then fallback
    let merged = [...kobBankList, ...fwBankList];
    if (merged.length === 0 && country === "CM") {
      merged = CM_BANKS.map((b) => ({ code: b.code, name: b.name, source: "fallback" }));
    }

    setBanks(merged);
    setLoading(false);
  };

  const filtered = search
    ? banks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : banks;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Receiving Bank
        </Label>
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading banks...
          </div>
        ) : (
          <Select value={selectedBank} onValueChange={(val) => {
            const bank = banks.find((b) => b.code === val);
            onBankChange(val, bank?.name || "");
          }}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select a bank" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 pb-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search banks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
              </div>
              {filtered.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">No banks found</div>
              ) : (
                <>
                  {/* Linked accounts first */}
                  {filtered.some(b => b.source === "linked") && (
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Your Linked Accounts</div>
                  )}
                  {filtered.filter(b => b.source === "linked").map((bank) => (
                    <SelectItem key={`linked-${bank.code}`} value={bank.code}>
                      <span className="flex items-center gap-2">
                        {bank.name}
                        <span className="text-[10px] font-medium text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">Linked</span>
                      </span>
                    </SelectItem>
                  ))}

                  {/* KOB partner banks */}
                  {filtered.some(b => b.source === "kob") && (
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">KOB Partner Banks</div>
                  )}
                  {filtered.filter(b => b.source === "kob").map((bank) => (
                    <SelectItem key={`kob-${bank.code}`} value={bank.code}>
                      <span className="flex items-center gap-2">
                        {bank.name}
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Partner</span>
                      </span>
                    </SelectItem>
                  ))}

                  {/* Other banks (Flutterwave / fallback) */}
                  {filtered.some(b => b.source === "flutterwave" || b.source === "fallback") && (
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">All Banks</div>
                  )}
                  {filtered.filter(b => b.source === "flutterwave" || b.source === "fallback").map((bank) => (
                    <SelectItem key={`fw-${bank.code}`} value={bank.code}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Account Number / RIB</Label>
        <Input
          placeholder="Enter account number or 23-digit RIB"
          value={accountNumber}
          onChange={(e) => onAccountNumberChange(e.target.value)}
          className="h-11 font-mono"
        />
      </div>
    </div>
  );
};
