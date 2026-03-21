import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Building2,
  Smartphone,
  Users,
  CheckCircle2,
  Clock,
  Banknote,
  TrendingUp,
  Lock,
  HeartHandshake,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Receipt,
  ChevronDown,
  Star,
  Repeat,
  Send,
} from "lucide-react";

import youngWoman from "@/assets/remittance/young-woman.jpg";
import familyHappy from "@/assets/remittance/family-happy.jpg";
import womanCard from "@/assets/remittance/woman-card.jpg";
import manLaptop from "@/assets/remittance/man-laptop.jpeg";
import marketVendor from "@/assets/remittance/market-vendor.jpeg";
import familyBed from "@/assets/remittance/family-bed.jpg";
import walletDest from "@/assets/remittance/wallet-dest.jpg";
import bankDest from "@/assets/remittance/bank-dest.jpg";
import billsDest from "@/assets/remittance/bills-dest.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const defaultCurrencies = [
  { code: "EUR", name: "Euro", flag: "🇪🇺", rate: 655.957, fee_pct: 0.5 },
  { code: "USD", name: "US Dollar", flag: "🇺🇸", rate: 605.22, fee_pct: 0.8 },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", rate: 765.43, fee_pct: 0.6 },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", rate: 445.18, fee_pct: 0.7 },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", rate: 680.50, fee_pct: 0.5 },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", rate: 0.39, fee_pct: 0.3 },
];

const corridors = [
  { from: "🇫🇷 France", to: "🇨🇲 Cameroon", rate: "1 EUR = 655.957 XAF", fee: "0.5%", time: "Instant" },
  { from: "🇺🇸 USA", to: "🇨🇲 Cameroon", rate: "1 USD = 605.22 XAF", fee: "0.8%", time: "< 30 sec" },
  { from: "🇬🇧 UK", to: "🇨🇲 Cameroon", rate: "1 GBP = 765.43 XAF", fee: "0.6%", time: "< 1 min" },
  { from: "🇨🇦 Canada", to: "🇨🇲 Cameroon", rate: "1 CAD = 445.18 XAF", fee: "0.7%", time: "< 30 sec" },
  { from: "🇩🇪 Germany", to: "🇨🇲 Cameroon", rate: "1 EUR = 655.957 XAF", fee: "0.5%", time: "Instant" },
  { from: "🇳🇬 Nigeria", to: "🇨🇲 Cameroon", rate: "1 NGN = 0.39 XAF", fee: "0.3%", time: "Instant" },
];

const destinations = [
  { icon: Smartphone, title: "KOB Wallet", desc: "Instant credit to any KOB digital wallet. Spend, save, or withdraw instantly.", img: walletDest },
  { icon: Landmark, title: "Bank Account", desc: "Direct deposit into any Cameroonian bank account via our bank connector network.", img: bankDest },
  { icon: Receipt, title: "Bills & Invoices", desc: "Pay school fees, utilities, or merchant invoices directly from diaspora funds.", img: billsDest },
];

const stats = [
  { value: "20+", label: "Partner corridors", icon: Globe },
  { value: "<30s", label: "Average delivery", icon: Zap },
  { value: "99.9%", label: "Platform uptime", icon: Shield },
  { value: "0.3%", label: "Lowest fees from", icon: TrendingUp },
];

const steps = [
  { num: "01", title: "Sender initiates", desc: "Family abroad sends money through any of our partner networks — Thunes, TerraPay, Onafriq, or others.", icon: Globe },
  { num: "02", title: "We receive & verify", desc: "Funds arrive at KOB. We verify the transaction, screen for compliance, and lock the exchange rate.", icon: Shield },
  { num: "03", title: "Smart routing", desc: "Our engine routes funds to the right destination — wallet, bank account, or bill payment.", icon: Repeat },
  { num: "04", title: "Instant credit", desc: "Recipient gets funds in their chosen destination. Real-time notifications at every step.", icon: Zap },
];

/* ─── Hook to fetch admin exchange rates ─── */
function useAdminRates() {
  const [currencies, setCurrencies] = useState(defaultCurrencies);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const { data } = await supabase
          .from("admin_exchange_rates")
          .select("base_currency, rate, effective_rate, margin_percentage")
          .eq("is_active", true)
          .eq("target_currency", "XAF");

        if (data && data.length > 0) {
          const flagMap: Record<string, { flag: string; name: string }> = {
            EUR: { flag: "🇪🇺", name: "Euro" },
            USD: { flag: "🇺🇸", name: "US Dollar" },
            GBP: { flag: "🇬🇧", name: "British Pound" },
            CAD: { flag: "🇨🇦", name: "Canadian Dollar" },
            CHF: { flag: "🇨🇭", name: "Swiss Franc" },
            NGN: { flag: "🇳🇬", name: "Nigerian Naira" },
            XOF: { flag: "🏳️", name: "CFA Franc BCEAO" },
          };

          const merged = defaultCurrencies.map((dc) => {
            const admin = data.find((d: any) => d.base_currency === dc.code);
            if (admin) {
              return {
                ...dc,
                rate: Number(admin.effective_rate || admin.rate),
                fee_pct: Number(admin.margin_percentage) || dc.fee_pct,
              };
            }
            return dc;
          });

          // Add any admin currencies not in defaults
          data.forEach((d: any) => {
            if (!merged.find((m) => m.code === d.base_currency)) {
              const info = flagMap[d.base_currency] || { flag: "🌍", name: d.base_currency };
              merged.push({
                code: d.base_currency,
                name: info.name,
                flag: info.flag,
                rate: Number(d.effective_rate || d.rate),
                fee_pct: Number(d.margin_percentage) || 0.5,
              });
            }
          });

          setCurrencies(merged);
        }
      } catch {
        // Fallback to defaults silently
      }
    };
    fetchRates();
  }, []);

  return currencies;
}

/* ─── Live Send Form ─── */
function SendForm() {
  const currencies = useAdminRates();
  const [amount, setAmount] = useState("1000");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"wallet" | "bank" | "bills">("wallet");

  const selectedCurrency = currencies[selectedIdx] || currencies[0];

  const numericAmount = parseFloat(amount) || 0;
  const feePercent = (selectedCurrency.fee_pct || 0.5) / 100;
  const fee = Math.round(numericAmount * feePercent * 100) / 100;
  const convertedAmount = useMemo(
    () => Math.round((numericAmount - fee) * selectedCurrency.rate),
    [numericAmount, fee, selectedCurrency.rate]
  );

  const deliveryOptions = [
    { key: "wallet" as const, label: "KOB Wallet", icon: "📱" },
    { key: "bank" as const, label: "Bank Account", icon: "🏦" },
    { key: "bills" as const, label: "Bills & Fees", icon: "🧾" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="bg-background rounded-2xl shadow-2xl p-6 lg:p-8 w-full max-w-md border border-border/40"
    >
      {/* You send */}
      <div className="space-y-1.5 mb-4">
        <label className="text-sm font-semibold text-foreground">You send</label>
        <div className="flex items-center border-2 rounded-xl overflow-hidden border-border focus-within:border-primary/50 transition-colors">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="border-0 text-2xl font-bold h-16 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            placeholder="0"
          />
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 h-16 bg-muted/50 hover:bg-muted transition-colors font-semibold text-sm min-w-[130px] justify-center"
            >
              <span className="text-xl">{selectedCurrency.flag}</span>
              {selectedCurrency.code}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-[calc(100%+4px)] bg-background rounded-xl shadow-xl border border-border z-50 min-w-[220px] overflow-hidden"
                >
                  {currencies.map((c, i) => (
                    <button
                      key={c.code}
                      onClick={() => { setSelectedIdx(i); setShowDropdown(false); }}
                      className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/60 transition-colors text-sm"
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className="font-medium">{c.code}</span>
                      <span className="text-muted-foreground text-xs ml-auto">{c.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fee breakdown */}
      <div className="space-y-2 py-3 border-y border-border/50 mb-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" /> Fee ({selectedCurrency.fee_pct}%)
          </span>
          <span className="font-semibold text-foreground">
            {fee.toFixed(2)} {selectedCurrency.code}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5" /> Rate
          </span>
          <span className="font-semibold text-foreground">
            1 {selectedCurrency.code} = {selectedCurrency.rate.toLocaleString()} XAF
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Delivery
          </span>
          <span className="font-semibold text-primary">Instant</span>
        </div>
      </div>

      {/* Recipient gets */}
      <div className="space-y-1.5 mb-4">
        <label className="text-sm font-semibold text-foreground">Recipient gets</label>
        <div className="flex items-center border-2 rounded-xl overflow-hidden border-border bg-muted/20">
          <div className="flex-1 px-4 py-4">
            <motion.span
              key={convertedAmount}
              initial={{ opacity: 0.5, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-2xl font-bold text-foreground"
            >
              {convertedAmount.toLocaleString()}
            </motion.span>
          </div>
          <div className="flex items-center gap-2 px-4 h-16 bg-muted/50 font-semibold text-sm min-w-[130px] justify-center">
            <span className="text-xl">🇨🇲</span>
            XAF
          </div>
        </div>
      </div>

      {/* Delivery method */}
      <div className="space-y-1.5 mb-4">
        <label className="text-sm font-semibold text-foreground">Deliver to</label>
        <div className="grid grid-cols-3 gap-2">
          {deliveryOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDeliveryMethod(opt.key)}
              className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-xs font-medium border-2 transition-all ${
                deliveryMethod === opt.key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recipient phone */}
      <div className="space-y-1.5 mb-5">
        <label className="text-sm font-semibold text-foreground">Recipient phone</label>
        <div className="flex items-center border-2 rounded-xl overflow-hidden border-border focus-within:border-primary/50 transition-colors">
          <span className="px-3 text-sm font-semibold text-muted-foreground bg-muted/50 h-12 flex items-center">+237</span>
          <Input
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            className="border-0 h-12 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
            placeholder="6XX XXX XXX"
          />
        </div>
      </div>

      <Link to="/app/send-money" className="block">
        <Button className="w-full h-14 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all gap-2" size="lg">
          <Send className="h-5 w-5" />
          Send money now
        </Button>
      </Link>

      <p className="text-xs text-center text-muted-foreground mt-3">
        You could save vs banks. <span className="text-primary font-medium cursor-pointer hover:underline">How do we collect this data?</span>
      </p>
    </motion.div>
  );
}

function FlagRow() {
  const flags = ["🇫🇷", "🇺🇸", "🇬🇧", "🇨🇦", "🇩🇪", "🇳🇬", "🇧🇪", "🇨🇭"];
  return (
    <div className="flex items-center gap-3 mt-6">
      {flags.map((f, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 + i * 0.06, type: "spring", stiffness: 300 }}
          className="text-2xl"
        >
          {f}
        </motion.div>
      ))}
    </div>
  );
}

export default function RemittanceLanding() {
  return (
    <div className="min-h-screen bg-background">
      {/* ══════════ HERO ══════════ */}
      <section className="relative overflow-hidden bg-[hsl(var(--primary))]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
            <motion.div initial="hidden" animate="visible" className="flex-1 space-y-5">
              <motion.div custom={0} variants={fadeUp} className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4].map(i => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
                  <Star className="h-4 w-4 fill-yellow-400/50 text-yellow-400/50" />
                </div>
                <span className="text-white/70 text-sm">Trusted by thousands</span>
              </motion.div>

              <motion.h1 custom={1} variants={fadeUp} className="text-5xl lg:text-[4.2rem] font-black text-white leading-[1] tracking-tight">
                SEND MONEY
                <br />
                GLOBALLY
                <br />
                <span className="text-primary-foreground/70">FOR LESS</span>
              </motion.h1>

              <motion.p custom={2} variants={fadeUp} className="text-lg text-white/80 max-w-lg leading-relaxed">
                Move your money where it matters. Save on international transfers in over 50 currencies, without any hidden fees.
              </motion.p>

              <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-3 pt-2">
                <Link to="/app/send-money">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-14 text-base font-semibold shadow-xl">
                    Open an Account <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/developer">
                  <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold bg-transparent">
                    Explore API
                  </Button>
                </Link>
              </motion.div>

              <motion.div custom={4} variants={fadeUp}>
                <FlagRow />
              </motion.div>
            </motion.div>

            <div className="w-full max-w-md lg:max-w-lg">
              <SendForm />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ TRUST BAR ══════════ */}
      <section className="border-b border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: Users, title: "Trusted by millions", desc: "Families globally move billions each month" },
              { icon: Shield, title: "Regulated", desc: "Licensed & regulated by local authorities" },
              { icon: HeartHandshake, title: "24/7 customer support", desc: "Get help anytime over email, phone and chat" },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <item.icon className="h-6 w-6 text-primary" />
                <h3 className="font-bold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground max-w-xs">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ NEVER PAY A HIDDEN FEE ══════════ */}
      <section className="py-20 lg:py-28 bg-[hsl(var(--primary))]">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
              NEVER PAY A HIDDEN FEE AGAIN
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
              Banks and other providers add markups to the exchange rate to make you pay more. Not us — see for yourself.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link to="/app/send-money">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-14 font-semibold shadow-lg">
                Send money now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/developer">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 font-semibold backdrop-blur-sm bg-transparent">
                Learn how to send money
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {corridors.map((c, i) => (
              <motion.div
                key={c.from}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white/95 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-foreground">{c.from}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-bold text-foreground">{c.to}</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Rate</span>
                        <span className="font-semibold text-foreground">{c.rate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee</span>
                        <span className="font-semibold text-primary">{c.fee}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Speed</span>
                        <span className="font-semibold text-foreground flex items-center gap-1">
                          <Zap className="h-3 w-3 text-amber-500" />{c.time}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-sm">How it works</Badge>
            <h2 className="text-4xl lg:text-5xl font-black text-foreground">Money arrives in seconds</h2>
            <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
              A seamless four-step process from sender to recipient. No delays, no hidden fees.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.num} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center mb-4">
                      <step.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-xs font-bold text-primary mb-2">STEP {step.num}</div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ DESTINATIONS ══════════ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <Badge variant="outline" className="mb-4 text-sm">Delivery options</Badge>
            <h2 className="text-4xl lg:text-5xl font-black text-foreground">Choose where the money lands</h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {destinations.map((dest, i) => (
              <motion.div key={dest.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group">
                  <CardContent className="p-0">
                    <div className="relative h-56 overflow-hidden">
                      <img src={dest.img} alt={dest.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-4 left-4">
                        <div className="h-10 w-10 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center">
                          <dest.icon className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground mb-2">{dest.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{dest.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ PEOPLE — Connecting diaspora ══════════ */}
      <section className="py-20 lg:py-28 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <Badge variant="outline" className="mb-4 text-sm">Built for Cameroon</Badge>
              <h2 className="text-4xl lg:text-5xl font-black text-foreground leading-tight mb-6">
                FOR PEOPLE
                <br />
                <span className="text-primary">GOING PLACES</span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                Over 3 million Cameroonians live abroad. Every month, billions of XAF flow back home
                to support families, fund businesses, pay school fees, and build dreams. KOB makes
                that journey faster, cheaper, and safer.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: HeartHandshake, text: "Support families instantly" },
                  { icon: Building2, text: "Fund small businesses" },
                  { icon: Users, text: "Pay school fees directly" },
                  { icon: Banknote, text: "Transparent exchange rates" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <img src={youngWoman} alt="Young Cameroonian woman" className="rounded-2xl w-full h-48 object-cover shadow-lg" loading="lazy" />
                <img src={familyHappy} alt="Happy family" className="rounded-2xl w-full h-64 object-cover shadow-lg" loading="lazy" />
              </div>
              <div className="space-y-4 pt-8">
                <img src={womanCard} alt="Woman making payment" className="rounded-2xl w-full h-64 object-cover shadow-lg" loading="lazy" />
                <img src={marketVendor} alt="Market vendor" className="rounded-2xl w-full h-48 object-cover shadow-lg" loading="lazy" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ STATS BAR ══════════ */}
      <section className="bg-[hsl(var(--primary))] text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <s.icon className="h-6 w-6 text-white/60 mx-auto mb-2" />
                <p className="text-3xl font-black">{s.value}</p>
                <p className="text-sm text-white/60 mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FOR BUSINESSES / API ══════════ */}
      <section className="py-20 lg:py-28 bg-foreground text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-4">For Banks & Fintechs</Badge>
              <h2 className="text-4xl lg:text-5xl font-black leading-tight mb-6">
                Remittance-as-a-Service
                <br />
                <span className="text-primary-foreground/60">One API. All partners.</span>
              </h2>
              <p className="text-white/60 text-lg leading-relaxed mb-8">
                Integrate once with KOB and access 20+ remittance corridors. Our partner adapter
                layer normalizes data from Thunes, TerraPay, Onafriq, and others into a single
                canonical format. Full settlement reconciliation included.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  "Webhook-driven status updates at every lifecycle stage",
                  "Double-entry ledger with full audit trail",
                  "Automated settlement reconciliation with mismatch detection",
                  "Sanctions screening and compliance hooks built in",
                ].map((text) => (
                  <div key={text} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary-foreground/70 mt-0.5 shrink-0" />
                    <span className="text-white/70 text-sm">{text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Link to="/developer">
                  <Button size="lg" className="rounded-full px-8">
                    Read the docs <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/developer/guides/sdks">
                  <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-full px-8 bg-transparent">
                    Get the SDK
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <img src={manLaptop} alt="Developer integrating KOB API" className="rounded-3xl shadow-2xl w-full object-cover h-[450px]" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent rounded-3xl" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ SEND + RECEIVE CTA ══════════ */}
      <section className="py-20 lg:py-28 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card className="h-full border-0 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <CardContent className="p-0">
                  <div className="relative h-64 overflow-hidden">
                    <img src={familyBed} alt="Family receiving remittance" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <Badge className="bg-primary text-primary-foreground border-0">
                        <ArrowDownLeft className="h-3 w-3 mr-1" /> Inbound
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Receive money from abroad</h3>
                    <p className="text-muted-foreground mb-6">
                      Track every transfer sent to you by family and friends abroad. Get instant notifications when money arrives.
                    </p>
                    <Link to="/app/remittances">
                      <Button className="rounded-full px-6">
                        Track inbound transfers <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              <Card className="h-full border-0 shadow-xl overflow-hidden group hover:shadow-2xl transition-all duration-500">
                <CardContent className="p-0">
                  <div className="relative h-64 overflow-hidden">
                    <img src={womanCard} alt="Woman sending money" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <Badge className="bg-secondary text-secondary-foreground border-0">
                        <ArrowUpRight className="h-3 w-3 mr-1" /> Outbound
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">Send money abroad</h3>
                    <p className="text-muted-foreground mb-6">
                      Transfer money from Cameroon to 140+ countries. Competitive rates, multiple delivery methods, real-time tracking.
                    </p>
                    <Link to="/app/send-money">
                      <Button className="rounded-full px-6">
                        Send money now <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="py-20 lg:py-28 relative overflow-hidden bg-[hsl(var(--primary))]">
        <div className="container mx-auto px-4 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-3xl mx-auto">
            <h2 className="text-4xl lg:text-6xl font-black text-white leading-tight mb-6">
              Start sending money
              <br />
              the smart way
            </h2>
            <p className="text-xl text-white/70 mb-10">
              Join thousands of families who trust KOB for fast, affordable remittances to Cameroon.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/app/send-money">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-10 h-14 text-base font-semibold shadow-xl">
                  Get started free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/developer">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-10 h-14 text-base font-semibold bg-transparent">
                  API Documentation
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
