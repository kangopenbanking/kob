import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  ArrowRight,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const formatXAF = (n: number) =>
  new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(n);

const ROICalculator = () => {
  const [monthlyTxns, setMonthlyTxns] = useState(50000);
  const [avgTxnValue, setAvgTxnValue] = useState(25000);
  const [numBanks, setNumBanks] = useState(3);
  const [devCount, setDevCount] = useState(4);

  const results = useMemo(() => {
    // Without KOB: per-bank integration costs
    const perBankIntegrationCost = 15_000_000; // XAF one-time
    const perBankMaintenance = 2_000_000; // XAF/month
    const manualProcessingCostPerTxn = 150; // XAF
    const avgDevSalary = 800_000; // XAF/month
    const integrationMonths = 6; // per bank

    // With KOB
    const kobSetupFee = 5_000_000;
    const kobPerTxnFee = 25; // XAF
    const kobMonthlyPlatform = 500_000;
    const kobIntegrationMonths = 1;

    // Annual costs WITHOUT KOB
    const withoutSetup = numBanks * perBankIntegrationCost;
    const withoutMaintenance = numBanks * perBankMaintenance * 12;
    const withoutProcessing = monthlyTxns * manualProcessingCostPerTxn * 12;
    const withoutDevTime = devCount * avgDevSalary * integrationMonths * numBanks;
    const totalWithout = withoutSetup + withoutMaintenance + withoutProcessing + withoutDevTime;

    // Annual costs WITH KOB
    const withSetup = kobSetupFee;
    const withTxnFees = monthlyTxns * kobPerTxnFee * 12;
    const withPlatform = kobMonthlyPlatform * 12;
    const withDevTime = devCount * avgDevSalary * kobIntegrationMonths;
    const totalWith = withSetup + withTxnFees + withPlatform + withDevTime;

    const savings = totalWithout - totalWith;
    const savingsPercent = totalWithout > 0 ? (savings / totalWithout) * 100 : 0;
    const timeToMarketSaved = (integrationMonths * numBanks - kobIntegrationMonths);
    const roiMultiple = totalWith > 0 ? savings / totalWith : 0;

    return {
      totalWithout,
      totalWith,
      savings,
      savingsPercent,
      timeToMarketSaved,
      roiMultiple,
      breakdown: {
        without: { setup: withoutSetup, maintenance: withoutMaintenance, processing: withoutProcessing, dev: withoutDevTime },
        with: { setup: withSetup, txn: withTxnFees, platform: withPlatform, dev: withDevTime },
      },
    };
  }, [monthlyTxns, avgTxnValue, numBanks, devCount]);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-accent py-16">
        <div className="container mx-auto px-4 text-center text-primary-foreground">
          <Badge variant="outline" className="mb-4 border-primary-foreground/30 text-primary-foreground">
            <Calculator className="h-4 w-4 mr-1" /> ROI Calculator
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Calculate Your Savings</h1>
          <p className="text-lg opacity-90 max-w-2xl mx-auto">
            See how much your institution can save by switching to KOB's unified API
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Inputs */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-6">Your Parameters</h2>

              <div className="space-y-6">
                <div>
                  <Label className="text-sm font-medium">Monthly Transactions</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[monthlyTxns]}
                      onValueChange={([v]) => setMonthlyTxns(v)}
                      min={1000}
                      max={500000}
                      step={1000}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={monthlyTxns}
                      onChange={(e) => setMonthlyTxns(Number(e.target.value) || 0)}
                      className="w-28 text-right"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Avg Transaction Value (XAF)</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[avgTxnValue]}
                      onValueChange={([v]) => setAvgTxnValue(v)}
                      min={1000}
                      max={500000}
                      step={1000}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={avgTxnValue}
                      onChange={(e) => setAvgTxnValue(Number(e.target.value) || 0)}
                      className="w-28 text-right"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Banks to Integrate</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[numBanks]}
                      onValueChange={([v]) => setNumBanks(v)}
                      min={1}
                      max={25}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={numBanks}
                      onChange={(e) => setNumBanks(Number(e.target.value) || 1)}
                      className="w-28 text-right"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Developer Team Size</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      value={[devCount]}
                      onValueChange={([v]) => setDevCount(v)}
                      min={1}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={devCount}
                      onChange={(e) => setDevCount(Number(e.target.value) || 1)}
                      className="w-28 text-right"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6">
            {/* Headline savings */}
            <div className="grid sm:grid-cols-3 gap-4">
              <motion.div key={results.savings} initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
                <Card className="p-6 text-center border-primary bg-primary/5">
                  <DollarSign className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold text-primary">{formatXAF(results.savings)}</div>
                  <div className="text-xs text-muted-foreground">Annual Savings</div>
                </Card>
              </motion.div>
              <Card className="p-6 text-center">
                <Clock className="h-8 w-8 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold">{results.timeToMarketSaved} mo</div>
                <div className="text-xs text-muted-foreground">Faster Time-to-Market</div>
              </Card>
              <Card className="p-6 text-center">
                <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">{results.roiMultiple.toFixed(1)}x</div>
                <div className="text-xs text-muted-foreground">ROI Multiple</div>
              </Card>
            </div>

            {/* Cost comparison */}
            <Card className="p-6">
              <h3 className="font-bold mb-4">Annual Cost Comparison</h3>
              <div className="space-y-4">
                {/* Without KOB */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Without KOB</span>
                    <span className="font-semibold">{formatXAF(results.totalWithout)}</span>
                  </div>
                  <div className="h-6 bg-destructive/20 rounded-full overflow-hidden">
                    <div className="h-full bg-destructive/60 rounded-full" style={{ width: "100%" }} />
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Setup: {formatXAF(results.breakdown.without.setup)}</span>
                    <span>Maint: {formatXAF(results.breakdown.without.maintenance)}</span>
                    <span>Dev: {formatXAF(results.breakdown.without.dev)}</span>
                  </div>
                </div>

                {/* With KOB */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">With KOB</span>
                    <span className="font-semibold">{formatXAF(results.totalWith)}</span>
                  </div>
                  <div className="h-6 bg-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.max(5, (results.totalWith / results.totalWithout) * 100)}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Setup: {formatXAF(results.breakdown.with.setup)}</span>
                    <span>Txn fees: {formatXAF(results.breakdown.with.txn)}</span>
                    <span>Platform: {formatXAF(results.breakdown.with.platform)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-400">
                    Save {results.savingsPercent.toFixed(0)}% annually with KOB
                  </span>
                </div>
              </div>
            </Card>

            {/* CTA */}
            <Card className="p-6 bg-primary text-primary-foreground">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-bold text-lg">Ready to start saving?</h3>
                  <p className="text-sm opacity-80">Talk to our team about your specific requirements</p>
                </div>
                <Link to="/contact">
                  <Button variant="secondary" size="lg">
                    Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROICalculator;
