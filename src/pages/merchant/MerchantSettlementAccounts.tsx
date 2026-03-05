import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Building2, Smartphone, Plus, Trash2, Star, CreditCard, Wallet, Globe, Landmark, Shield, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const CAMEROON_BANKS = [
  { code: "10005", name: "Afriland First Bank" },
  { code: "10029", name: "Atlantic Bank Cameroon" },
  { code: "10009", name: "Banque Internationale du Cameroun (BICEC)" },
  { code: "10004", name: "CBC (Commercial Bank of Cameroon)" },
  { code: "10033", name: "CCA Bank" },
  { code: "10013", name: "Citibank Cameroon" },
  { code: "10007", name: "Ecobank Cameroon" },
  { code: "10023", name: "NFC Bank" },
  { code: "10003", name: "SCB (Société Commerciale de Banque)" },
  { code: "10002", name: "Société Générale Cameroun" },
  { code: "10008", name: "Standard Chartered Cameroon" },
  { code: "10011", name: "UBA Cameroon" },
  { code: "10015", name: "UBC (Union Bank of Cameroon)" },
  { code: "10035", name: "BC-PME SA" },
  { code: "10037", name: "BGFI Bank Cameroon" },
];

const MOMO_PROVIDERS = [
  { id: "mtn_momo", name: "MTN Mobile Money", prefix: "+237 67/65" },
  { id: "orange_money", name: "Orange Money", prefix: "+237 69/65" },
];

const ACCOUNT_TYPES = [
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "Receive payouts to your bank account via domestic transfer" },
  { value: "mobile_money", label: "Mobile Money", icon: Smartphone, description: "Receive payouts to MTN MoMo or Orange Money" },
  { value: "paypal", label: "PayPal", icon: Globe, description: "Receive payouts to your PayPal account" },
  { value: "card", label: "Card (Visa Direct / MC Send)", icon: CreditCard, description: "Push-to-card payouts via Visa Direct or Mastercard Send" },
  { value: "rtgs", label: "RTGS / Wire Transfer", icon: Landmark, description: "Real-time gross settlement for large-value transfers" },
] as const;

const CURRENCIES = [
  { code: "XAF", name: "CFA Franc BEAC", flag: "🇨🇲" },
  { code: "XOF", name: "CFA Franc BCEAO", flag: "🇸🇳" },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬" },
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
  { code: "GHS", name: "Ghanaian Cedi", flag: "🇬🇭" },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪" },
];

type AccountType = typeof ACCOUNT_TYPES[number]["value"];

interface FormState {
  account_type: AccountType;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  phone_number: string;
  currency: string;
  paypal_email: string;
  card_last4: string;
  card_network: string;
  card_token: string;
}

const INITIAL_FORM: FormState = {
  account_type: "bank_transfer",
  bank_code: "",
  bank_name: "",
  account_number: "",
  account_name: "",
  phone_number: "",
  currency: "XAF",
  paypal_email: "",
  card_last4: "",
  card_network: "visa",
  card_token: "",
};

function getAccountIcon(type: string) {
  switch (type) {
    case "mobile_money": return Smartphone;
    case "paypal": return Globe;
    case "card": return CreditCard;
    case "rtgs": return Landmark;
    default: return Building2;
  }
}

function getAccountLabel(type: string) {
  return ACCOUNT_TYPES.find(t => t.value === type)?.label || type;
}

export default function MerchantSettlementAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({ ...INITIAL_FORM });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase
        .from("gateway_merchant_settlement_accounts")
        .select("*")
        .eq("merchant_id", m.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const isFormValid = () => {
    if (!form.account_name) return false;
    switch (form.account_type) {
      case "bank_transfer":
      case "rtgs":
        return !!form.bank_code && !!form.account_number;
      case "mobile_money":
        return !!form.phone_number;
      case "paypal":
        return !!form.paypal_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.paypal_email);
      case "card":
        return !!form.card_last4 && form.card_last4.length === 4;
      default:
        return false;
    }
  };

  const handleCreate = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      let accountNumber = form.account_number;
      let phoneNumber: string | null = null;
      let bankCode: string | null = form.bank_code || null;
      let bankName: string | null = form.bank_name || null;
      const metadata: Record<string, any> = {};

      switch (form.account_type) {
        case "mobile_money":
          phoneNumber = form.phone_number;
          accountNumber = form.phone_number; // account_number is required
          const provider = MOMO_PROVIDERS.find(p => p.id === form.bank_code);
          bankName = provider?.name || form.bank_code;
          bankCode = form.bank_code;
          metadata.momo_provider = form.bank_code;
          break;
        case "paypal":
          accountNumber = form.paypal_email;
          metadata.paypal_email = form.paypal_email;
          bankName = "PayPal";
          bankCode = null;
          break;
        case "card":
          accountNumber = `****${form.card_last4}`;
          metadata.card_network = form.card_network;
          metadata.card_last4 = form.card_last4;
          if (form.card_token) metadata.card_token = form.card_token;
          bankName = form.card_network === "visa" ? "Visa Direct" : "Mastercard Send";
          bankCode = null;
          break;
        case "rtgs":
        case "bank_transfer":
        default:
          if (form.bank_code) {
            const bank = CAMEROON_BANKS.find(b => b.code === form.bank_code);
            bankName = bank?.name || form.bank_name;
          }
          break;
      }

      const { error } = await supabase.from("gateway_merchant_settlement_accounts").insert({
        merchant_id: merchantId,
        account_type: form.account_type,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: form.account_name,
        phone_number: phoneNumber,
        currency: form.currency,
        is_default: accounts.length === 0,
        metadata,
      });
      if (error) throw error;
      toast.success("Settlement account added successfully");
      setDialogOpen(false);
      setForm({ ...INITIAL_FORM });
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: string) => {
    if (!merchantId) return;
    await supabase.from("gateway_merchant_settlement_accounts").update({ is_default: false }).eq("merchant_id", merchantId);
    await supabase.from("gateway_merchant_settlement_accounts").update({ is_default: true }).eq("id", id);
    toast.success("Default settlement account updated");
    loadData();
  };

  const deactivateAccount = async (id: string) => {
    const { error } = await supabase.from("gateway_merchant_settlement_accounts").update({ is_active: false }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Account deactivated"); loadData(); }
  };

  const activeAccounts = accounts.filter(a => a.is_active !== false);
  const bankAccounts = activeAccounts.filter(a => a.account_type === "bank_transfer" || a.account_type === "rtgs");
  const momoAccounts = activeAccounts.filter(a => a.account_type === "mobile_money");
  const otherAccounts = activeAccounts.filter(a => !["bank_transfer", "rtgs", "mobile_money"].includes(a.account_type));

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const renderAccountCard = (a: any) => {
    const Icon = getAccountIcon(a.account_type);
    const meta = a.metadata || {};
    return (
      <Card key={a.id} className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{a.account_name || a.bank_name || "Account"}</CardTitle>
                <p className="text-xs text-muted-foreground">{getAccountLabel(a.account_type)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {a.is_default && <Badge className="bg-primary/10 text-primary border-primary/20">Default</Badge>}
              <Badge variant="outline">{a.currency}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Separator />
          <div className="grid grid-cols-2 gap-2 text-sm">
            {a.bank_name && (
              <div><span className="text-muted-foreground text-xs">Bank / Provider</span><p className="font-medium">{a.bank_name}</p></div>
            )}
            {a.bank_code && (
              <div><span className="text-muted-foreground text-xs">Bank Code</span><p className="font-medium font-mono">{a.bank_code}</p></div>
            )}
            {a.account_number && a.account_type !== "paypal" && (
              <div><span className="text-muted-foreground text-xs">Account Number</span><p className="font-medium font-mono">****{a.account_number?.slice(-4)}</p></div>
            )}
            {a.phone_number && (
              <div><span className="text-muted-foreground text-xs">Phone</span><p className="font-medium">{a.phone_number}</p></div>
            )}
            {meta.paypal_email && (
              <div className="col-span-2"><span className="text-muted-foreground text-xs">PayPal Email</span><p className="font-medium">{meta.paypal_email}</p></div>
            )}
            {meta.card_network && (
              <div><span className="text-muted-foreground text-xs">Card Network</span><p className="font-medium capitalize">{meta.card_network === "visa" ? "Visa Direct" : "Mastercard Send"}</p></div>
            )}
            {meta.card_last4 && (
              <div><span className="text-muted-foreground text-xs">Card</span><p className="font-medium font-mono">•••• {meta.card_last4}</p></div>
            )}
            {meta.momo_provider && (
              <div><span className="text-muted-foreground text-xs">Provider</span><p className="font-medium">{MOMO_PROVIDERS.find(p => p.id === meta.momo_provider)?.name || meta.momo_provider}</p></div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            {!a.is_default && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDefault(a.id)}>
                <Star className="h-3.5 w-3.5" /> Set Default
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5 ml-auto" onClick={() => deactivateAccount(a.id)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderFormFields = () => {
    switch (form.account_type) {
      case "bank_transfer":
      case "rtgs":
        return (
          <>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={form.bank_code} onValueChange={v => {
                const bank = CAMEROON_BANKS.find(b => b.code === v);
                setForm(f => ({ ...f, bank_code: v, bank_name: bank?.name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select a bank" /></SelectTrigger>
                <SelectContent>
                  {CAMEROON_BANKS.map(b => (
                    <SelectItem key={b.code} value={b.code}>
                      <span className="font-mono text-xs mr-2">{b.code}</span> {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Number {form.account_type === "rtgs" ? "(IBAN)" : ""}</Label>
              <Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
                placeholder={form.account_type === "rtgs" ? "CM21 XXXXX XXXXX XXXXXXXXXXX XX" : "23-digit RIB or account number"} />
              {form.account_type === "bank_transfer" && (
                <p className="text-xs text-muted-foreground">Enter the full 23-digit Domestic RIB (bank-branch-account-key)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Account Holder Name</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Full legal name on the account" />
            </div>
          </>
        );
      case "mobile_money":
        return (
          <>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={form.bank_code} onValueChange={v => setForm(f => ({ ...f, bank_code: v }))}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {MOMO_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} <span className="text-xs text-muted-foreground ml-1">({p.prefix})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+237 6XX XXX XXX" />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Name registered on MoMo" />
            </div>
          </>
        );
      case "paypal":
        return (
          <>
            <div className="space-y-2">
              <Label>PayPal Email</Label>
              <Input type="email" value={form.paypal_email} onChange={e => setForm(f => ({ ...f, paypal_email: e.target.value }))} placeholder="merchant@example.com" />
              <p className="text-xs text-muted-foreground">The email address linked to your PayPal business account</p>
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="PayPal account name" />
            </div>
          </>
        );
      case "card":
        return (
          <>
            <div className="space-y-2">
              <Label>Card Network</Label>
              <Select value={form.card_network} onValueChange={v => setForm(f => ({ ...f, card_network: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visa">Visa Direct</SelectItem>
                  <SelectItem value="mastercard">Mastercard Send</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Card Last 4 Digits</Label>
              <Input value={form.card_last4} onChange={e => setForm(f => ({ ...f, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="1234" maxLength={4} />
            </div>
            <div className="space-y-2">
              <Label>Card Token (optional)</Label>
              <Input value={form.card_token} onChange={e => setForm(f => ({ ...f, card_token: e.target.value }))} placeholder="tok_XXXX..." />
              <p className="text-xs text-muted-foreground">If you have a tokenized card reference from Stripe or the gateway</p>
            </div>
            <div className="space-y-2">
              <Label>Cardholder Name</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Name on the card" />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settlement Accounts</h1>
          <p className="text-muted-foreground">Manage payout destinations across all supported rails</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setForm({ ...INITIAL_FORM }); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Account</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Settlement Account</DialogTitle>
              <DialogDescription>Configure a new payout destination for receiving settlements</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Account Type Selection */}
              <div className="space-y-2">
                <Label>Payout Method</Label>
                <div className="grid grid-cols-1 gap-2">
                  {ACCOUNT_TYPES.map(t => {
                    const Icon = t.icon;
                    const selected = form.account_type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...INITIAL_FORM, account_type: t.value, currency: f.currency }))}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${selected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${selected ? "text-primary" : ""}`}>{t.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Dynamic Form Fields */}
              {renderFormFields()}

              {/* Currency */}
              <div className="space-y-2">
                <Label>Settlement Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.flag} {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !isFormValid()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-primary">Supported Payout Rails</p>
            <p className="text-muted-foreground mt-1">
              Bank Transfer (Domestic RIB/IBAN) • Mobile Money (MTN MoMo, Orange Money) • PayPal • Visa Direct • Mastercard Send • RTGS Wire.
              The default account receives automatic settlements. All sensitive data is encrypted at rest.
            </p>
          </div>
        </CardContent>
      </Card>

      {activeAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Settlement Accounts</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
              Add a bank account, mobile money, PayPal, or card to start receiving your payouts
            </p>
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All ({activeAccounts.length})</TabsTrigger>
            {bankAccounts.length > 0 && <TabsTrigger value="bank">Bank ({bankAccounts.length})</TabsTrigger>}
            {momoAccounts.length > 0 && <TabsTrigger value="momo">MoMo ({momoAccounts.length})</TabsTrigger>}
            {otherAccounts.length > 0 && <TabsTrigger value="other">Other ({otherAccounts.length})</TabsTrigger>}
          </TabsList>
          <TabsContent value="all">
            <div className="grid gap-4 md:grid-cols-2">{activeAccounts.map(renderAccountCard)}</div>
          </TabsContent>
          <TabsContent value="bank">
            <div className="grid gap-4 md:grid-cols-2">{bankAccounts.map(renderAccountCard)}</div>
          </TabsContent>
          <TabsContent value="momo">
            <div className="grid gap-4 md:grid-cols-2">{momoAccounts.map(renderAccountCard)}</div>
          </TabsContent>
          <TabsContent value="other">
            <div className="grid gap-4 md:grid-cols-2">{otherAccounts.map(renderAccountCard)}</div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
