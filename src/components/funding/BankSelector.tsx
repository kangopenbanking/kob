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
  onBankChange: (code: string, name: string) => void;
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
    let bankList: Bank[] = [];

    // Try Flutterwave API first
    try {
      const { data, error } = await supabase.functions.invoke("flutterwave-list-banks", {
        body: { country },
      }) as { data: any; error: any };
      if (!error && data?.banks?.length) {
        bankList = data.banks.map((b: any) => ({ code: b.code, name: b.name, source: "flutterwave" }));
      }
    } catch (err) {
      console.warn("[BankSelector] Flutterwave fetch failed, using fallback:", err);
    }

    // Also try KOB institutions
    try {
      const { data: kobBanks } = await supabase
        .from("institutions")
        .select("id, institution_name, swift_bic_code")
        .eq("is_active", true)
        .order("institution_name");
      if (kobBanks?.length) {
        kobBanks.forEach((inst: any) => {
          const exists = bankList.some(
            (b) => b.name.toLowerCase().includes(inst.institution_name?.toLowerCase()?.slice(0, 10))
          );
          if (!exists) {
            bankList.push({ code: inst.swift_bic_code || inst.id, name: inst.institution_name, source: "kob" });
          }
        });
      }
    } catch (err) {
      console.warn("[BankSelector] KOB institutions fetch failed:", err);
    }

    // Fallback to static CM banks if nothing loaded (Cameroon only)
    if (bankList.length === 0 && country === "CM") {
      bankList = CM_BANKS.map((b) => ({ code: b.code, name: b.name, source: "fallback" }));
    }

    setBanks(bankList);
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
                filtered.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    <span className="flex items-center gap-2">
                      {bank.name}
                      {bank.source === "kob" && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">KOB Partner</span>
                      )}
                    </span>
                  </SelectItem>
                ))
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
