import { motion } from "framer-motion";
import { TrendingUp, Smartphone, Shield, ArrowUpRight } from "lucide-react";

// === Accounts Preview (Screenshot 1) ===
export function AccountsPreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-8">
      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[hsl(210,20%,92%)] shadow-sm p-5 mb-4"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-[hsl(210,10%,50%)]">Current Balance</span>
        </div>
        <AnimatedCounter target={2450000} suffix=" XAF" className="text-2xl md:text-3xl font-bold text-[hsl(220,25%,15%)]" />
      </motion.div>

      {/* Transaction 1 */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="w-full max-w-sm bg-white rounded-xl border border-[hsl(210,20%,92%)] shadow-sm p-4 mb-3 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-[hsl(145,50%,92%)] flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[hsl(145,60%,40%)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[hsl(220,25%,15%)]">Salary Deposit</p>
          <p className="text-xs text-[hsl(210,10%,50%)]">Today, 09:30</p>
        </div>
        <span className="text-sm font-bold text-[hsl(145,60%,35%)]">+450,000 XAF</span>
      </motion.div>

      {/* Transaction 2 */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="w-full max-w-sm bg-white rounded-xl border border-[hsl(210,20%,92%)] shadow-sm p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-full bg-[hsl(30,80%,92%)] flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-[hsl(15,70%,50%)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[hsl(220,25%,15%)]">MTN MoMo Transfer</p>
          <p className="text-xs text-[hsl(210,10%,50%)]">Yesterday, 14:22</p>
        </div>
        <span className="text-sm font-bold text-[hsl(220,25%,15%)]">-25,000 XAF</span>
      </motion.div>
    </div>
  );
}

// === Payments Preview (Screenshot 2) ===
export function PaymentsPreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm bg-gradient-to-br from-white to-[hsl(145,30%,97%)] rounded-2xl border border-[hsl(210,20%,90%)] shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-base font-semibold text-[hsl(220,60%,40%)]">Send Money</span>
          <motion.span
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="px-3 py-1 rounded-full bg-[hsl(220,60%,30%)] text-white text-xs font-bold"
          >
            Instant
          </motion.span>
        </div>

        <div className="mb-1">
          <span className="text-xs text-[hsl(210,10%,50%)]">Recipient</span>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm font-semibold text-[hsl(220,25%,15%)] mb-4"
        >
          Orange Money - 670 XXX XXX
        </motion.p>

        <div className="mb-1">
          <span className="text-xs text-[hsl(210,10%,50%)]">Amount</span>
        </div>
        <AnimatedCounter target={50000} suffix=" XAF" className="text-2xl md:text-3xl font-bold text-[hsl(220,25%,15%)] mb-5" />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="w-full py-3 rounded-xl bg-[hsl(220,60%,30%)] text-white text-center text-sm font-bold flex items-center justify-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Confirm Payment
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="flex items-center gap-2 mt-4 text-xs text-[hsl(210,10%,50%)]"
      >
        <Shield className="w-3.5 h-3.5" />
        Secured with SCA authentication
      </motion.div>
    </div>
  );
}

// === Credit Score Preview (Screenshot 3) ===
export function CreditScorePreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm bg-white rounded-2xl border border-[hsl(210,20%,90%)] shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-base font-bold text-[hsl(220,25%,15%)]">Credit Score</span>
          <motion.span
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="px-3 py-1 rounded-full border border-[hsl(210,20%,85%)] text-xs font-medium text-[hsl(220,25%,15%)]"
          >
            Excellent
          </motion.span>
        </div>

        <div className="text-center mb-2">
          <AnimatedCounter target={750} className="text-5xl font-bold text-[hsl(220,60%,30%)]" />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-1 mb-6 text-sm text-[hsl(145,60%,35%)]"
        >
          <ArrowUpRight className="w-4 h-4" />
          +25 points this month
        </motion.div>

        {/* Progress Bars */}
        <div className="space-y-4">
          <ProgressRow label="Payment History" value={95} color="hsl(220,60%,30%)" delay={0.7} />
          <ProgressRow label="Credit Utilization" value={32} color="hsl(145,60%,40%)" delay={0.85} />
          <ProgressRow label="Savings Behavior" value={88} color="hsl(220,60%,30%)" delay={1.0} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-5 pt-4 border-t border-[hsl(210,20%,92%)] text-xs text-center text-[hsl(210,10%,50%)]"
        >
          Eligible for loans up to <strong className="text-[hsl(220,25%,15%)]">5,000,000 XAF</strong> at <strong className="text-[hsl(220,25%,15%)]">8.5% APR</strong>
        </motion.div>
      </motion.div>
    </div>
  );
}

// === Savings Preview (Screenshot 4) ===
export function SavingsPreview() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-sm bg-gradient-to-br from-white to-[hsl(145,30%,96%)] rounded-2xl border border-[hsl(145,30%,85%)] shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <span className="text-base font-bold text-[hsl(220,25%,15%)]">High-Yield Savings</span>
          <motion.span
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="px-3 py-1 rounded-full bg-[hsl(145,60%,40%)] text-white text-xs font-bold"
          >
            6.5% APY
          </motion.span>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[hsl(210,20%,92%)] mb-4">
          <span className="text-xs text-[hsl(145,50%,40%)]">Current Balance</span>
          <AnimatedCounter target={1250000} suffix=" XAF" className="text-2xl md:text-3xl font-bold text-[hsl(220,25%,15%)]" />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[hsl(210,10%,50%)]">Interest Earned (YTD)</span>
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-sm font-bold text-[hsl(145,60%,35%)]"
            >
              +45,750 XAF
            </motion.span>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-white rounded-xl p-4 border border-[hsl(210,20%,92%)] mb-3 flex items-center justify-between"
        >
          <span className="text-sm text-[hsl(220,25%,15%)]">Base Rate</span>
          <span className="text-sm font-bold text-[hsl(220,25%,15%)]">6.0%</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.05 }}
          className="bg-[hsl(145,40%,94%)] rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[hsl(145,60%,35%)]" />
            <span className="text-sm text-[hsl(220,25%,15%)]">Credit Score Bonus</span>
          </div>
          <span className="text-sm font-bold text-[hsl(145,60%,35%)]">+0.5%</span>
        </motion.div>
      </motion.div>
    </div>
  );
}

// === Shared Components ===

function AnimatedCounter({ target, suffix = "", className }: { target: number; suffix?: string; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className={className}
    >
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        {target.toLocaleString()}{suffix}
      </motion.span>
    </motion.div>
  );
}

function ProgressRow({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[hsl(220,25%,15%)] w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-[hsl(210,20%,92%)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-[hsl(220,25%,15%)] w-8 text-right">{value}%</span>
    </div>
  );
}
