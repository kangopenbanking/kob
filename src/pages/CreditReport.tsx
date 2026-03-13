import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Download, FileText, ArrowLeft, User, Briefcase, CreditCard, Search, Clock, CheckCircle, XCircle, TrendingDown, AlertTriangle, PiggyBank, ShieldCheck, ShieldAlert, CalendarDays, BarChart3, Percent, Banknote, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import CreditInquiriesPanel from '@/components/credit/CreditInquiriesPanel';
import PreApprovedOffersCard from '@/components/credit/PreApprovedOffersCard';
import ScoreTrendChart from '@/components/credit/ScoreTrendChart';
import AITipsCard from '@/components/credit/AITipsCard';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } }),
};

export default function CreditReport() {
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['credit-report'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase.functions.invoke('credit-report-generate', {
        body: {
          user_id: user.id,
          report_type: 'full',
          requester_type: 'self',
          purpose: 'general_review'
        }
      });
      if (error) throw error;
      return data;
    },
  });

  const handleDownload = () => {
    if (!reportData) {
      toast.error('No report data available');
      return;
    }
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;
      doc.setFontSize(20);
      doc.text("Credit Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;
      doc.setFontSize(10);
      doc.text(`Generated: ${reportData.generated_at ? new Date(reportData.generated_at).toLocaleDateString() : 'N/A'}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;
      doc.setFontSize(14);
      doc.text("Credit Score", 20, yPosition);
      yPosition += 8;
      doc.setFontSize(12);
      doc.text(`Score: ${reportData.score || 'N/A'}`, 20, yPosition);
      yPosition += 12;
      doc.setFontSize(14);
      doc.text("Account Summary", 20, yPosition);
      yPosition += 8;
      doc.setFontSize(10);
      doc.text(`Total Accounts: ${reportData.report_summary?.total_accounts || 0}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Active Loans: ${reportData.report_summary?.active_loans || 0}`, 20, yPosition);
      yPosition += 6;
      doc.text(`Total Savings: ${reportData.report_summary?.total_savings?.toLocaleString() || '0'} XAF`, 20, yPosition);
      yPosition += 12;
      if (reportData.report) {
        doc.setFontSize(14);
        doc.text("Loan History", 20, yPosition);
        yPosition += 8;
        doc.setFontSize(10);
        doc.text(`Total Loans: ${reportData.report.total_loans || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Active Loans: ${reportData.report.active_loans || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Completed Loans: ${reportData.report.completed_loans || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`On-Time Payment Rate: ${reportData.report.on_time_payment_rate || 0}%`, 20, yPosition);
        yPosition += 12;
        doc.setFontSize(14);
        doc.text("Payment History", 20, yPosition);
        yPosition += 8;
        doc.setFontSize(10);
        doc.text(`Total Payments Made: ${reportData.report.total_payments_made || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Late 30 Days: ${reportData.report.late_payments_30_days || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Late 60 Days: ${reportData.report.late_payments_60_days || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Late 90 Days: ${reportData.report.late_payments_90_days || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Missed Payments: ${reportData.report.missed_payments || 0}`, 20, yPosition);
        yPosition += 12;
        doc.setFontSize(14);
        doc.text("Credit Inquiries", 20, yPosition);
        yPosition += 8;
        doc.setFontSize(10);
        doc.text(`Hard Inquiries (6 months): ${reportData.report.hard_inquiries_6m || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Hard Inquiries (12 months): ${reportData.report.hard_inquiries_12m || 0}`, 20, yPosition);
      }
      doc.save(`credit-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Credit report downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const report = reportData?.report;
  const utilizationRatio = report?.credit_utilization_ratio || 0;
  const onTimeRate = report?.on_time_payment_rate || 0;
  const totalPayments = report?.total_payments_made || 0;
  const late30 = report?.late_payments_30_days || 0;
  const late60 = report?.late_payments_60_days || 0;
  const late90 = report?.late_payments_90_days || 0;
  const missed = report?.missed_payments || 0;
  const onTimePayments = totalPayments - late30 - late60 - late90 - missed;

  const summaryStats = [
    { label: 'Credit Score', value: reportData?.score || 'N/A', icon: CreditCard, color: 'bg-primary/10 text-primary' },
    { label: 'Total Accounts', value: reportData?.report_summary?.total_accounts || 0, icon: Briefcase, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
    { label: 'Active Loans', value: reportData?.report_summary?.active_loans || 0, icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    { label: 'Total Savings', value: `${(reportData?.report_summary?.total_savings || 0).toLocaleString()} XAF`, icon: CheckCircle, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  ];

  const getUtilizationColor = (ratio: number) => {
    if (ratio <= 30) return 'text-emerald-600 dark:text-emerald-400';
    if (ratio <= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getUtilizationLabel = (ratio: number) => {
    if (ratio <= 30) return 'Excellent';
    if (ratio <= 50) return 'Fair';
    if (ratio <= 75) return 'High';
    return 'Very High';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-primary rounded-b-[2rem] px-4 pt-6 pb-8 md:px-8"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/15 rounded-full">
                <Link to="/credit-score"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary-foreground/60">CrediQ</p>
                <h1 className="text-xl font-bold text-primary-foreground">Credit Report</h1>
              </div>
            </div>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="secondary"
              className="rounded-full bg-primary-foreground/15 text-primary-foreground border-0 hover:bg-primary-foreground/25 gap-1.5"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
          <p className="text-sm text-primary-foreground/70">
            {reportData?.generated_at
              ? `Generated ${new Date(reportData.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : 'Comprehensive view of your credit history'}
          </p>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto px-4 md:px-8 pb-12">
        {/* Summary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 -mt-5">
          {summaryStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="visible">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 ${stat.color}`}>
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold text-foreground mt-0.5 truncate">{stat.value}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Pre-Approved Loan Offers — TOP of report */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="mt-6">
          <PreApprovedOffersCard creditScore={reportData?.score || 0} />
        </motion.div>

        {/* Personal Information */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                  <CardDescription className="text-xs">Verified identity and employment details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Identity', verified: report?.personal_info_verified },
                  { label: 'Employment', verified: report?.employment_verified },
                  { label: 'Income', verified: report?.income_verified },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                    {item.verified
                      ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold">{item.verified ? 'Verified' : 'Not Verified'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Credit Utilization */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                  <Percent className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Credit Utilization</CardTitle>
                  <CardDescription className="text-xs">How much of your available credit you're using</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 mb-4">
                <p className={`text-4xl font-bold ${getUtilizationColor(utilizationRatio)}`}>
                  {utilizationRatio.toFixed(1)}%
                </p>
                <Badge variant="outline" className={`mb-1 text-[10px] font-bold ${getUtilizationColor(utilizationRatio)}`}>
                  {getUtilizationLabel(utilizationRatio)}
                </Badge>
              </div>
              <Progress value={Math.min(utilizationRatio, 100)} className="h-3 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Credit</p>
                  <p className="text-lg font-bold text-foreground">{(report?.total_credit_limit || 0).toLocaleString()} XAF</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Balance Used</p>
                  <p className="text-lg font-bold text-foreground">{(report?.total_balance || 0).toLocaleString()} XAF</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                <strong>Tip:</strong> Keep utilization below 30% for the best credit score impact.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Account Summary */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                  <Briefcase className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Account Summary</CardTitle>
                  <CardDescription className="text-xs">Overview of all financial accounts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Total', value: report?.total_accounts || 0, color: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Active', value: report?.active_accounts || 0, color: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Closed', value: report?.closed_accounts || 0, color: 'bg-muted/50' },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-xl text-center ${item.color}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loan History */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Loan History</CardTitle>
                  <CardDescription className="text-xs">Complete borrowing and repayment record</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Total', value: report?.total_loans || 0, color: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Active', value: report?.active_loans || 0, color: 'bg-amber-50 dark:bg-amber-950/30' },
                  { label: 'Completed', value: report?.completed_loans || 0, color: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Defaulted', value: report?.defaulted_loans || 0, color: report?.defaulted_loans > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50' },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-xl text-center ${item.color}`}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-0 divide-y divide-border/50">
                {[
                  { label: 'Total Borrowed', value: `${(report?.total_borrowed || 0).toLocaleString()} XAF` },
                  { label: 'Total Repaid', value: `${(report?.total_repaid || 0).toLocaleString()} XAF` },
                  { label: 'Outstanding Balance', value: `${(report?.total_balance || 0).toLocaleString()} XAF` },
                  { label: 'On-Time Payment Rate', value: `${onTimeRate.toFixed(1)}%` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment History */}
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Payment History</CardTitle>
                  <CardDescription className="text-xs">Track record of timely payments — the biggest factor in your score</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {totalPayments > 0 ? (
                <>
                  <div className="flex items-end gap-3 mb-4">
                    <p className={`text-4xl font-bold ${onTimeRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : onTimeRate >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {onTimeRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">on-time rate</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                    {[
                      { label: 'On Time', value: Math.max(onTimePayments, 0), color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
                      { label: '30 Days Late', value: late30, color: late30 > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-muted/50 text-muted-foreground' },
                      { label: '60 Days Late', value: late60, color: late60 > 0 ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300' : 'bg-muted/50 text-muted-foreground' },
                      { label: '90+ Days Late', value: late90, color: late90 > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-muted/50 text-muted-foreground' },
                      { label: 'Missed', value: missed, color: missed > 0 ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' : 'bg-muted/50 text-muted-foreground' },
                    ].map(item => (
                      <div key={item.label} className={`p-2.5 rounded-lg text-center ${item.color}`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
                        <p className="text-lg font-bold">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-[10px] text-muted-foreground">
                      <strong>Payment history</strong> accounts for ~35% of your credit score. Consistently making payments on time is the most impactful way to improve your score.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">No payment history recorded yet</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Savings Summary */}
        <motion.div custom={10} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                  <PiggyBank className="h-4 w-4 text-teal-700 dark:text-teal-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Savings Summary</CardTitle>
                  <CardDescription className="text-xs">Savings behavior contributes to your creditworthiness</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Accounts</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{report?.total_savings_accounts || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Total Balance</p>
                  <p className="text-lg font-bold text-teal-700 dark:text-teal-300">{(report?.total_savings_balance || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-teal-600 dark:text-teal-400">XAF</p>
                </div>
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">Consistency</p>
                  <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{report?.savings_consistency_score || 0}%</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-border/50">
                <span className="text-sm text-muted-foreground">Average per Account</span>
                <span className="text-sm font-bold text-foreground">{(report?.average_monthly_savings || 0).toLocaleString()} XAF</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Derogatory Marks */}
        <motion.div custom={11} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                  (report?.collections || 0) + (report?.bankruptcies || 0) + (report?.liens || 0) + (report?.judgments || 0) > 0
                    ? 'bg-red-100 dark:bg-red-900' : 'bg-emerald-100 dark:bg-emerald-900'
                }`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    (report?.collections || 0) + (report?.bankruptcies || 0) + (report?.liens || 0) + (report?.judgments || 0) > 0
                      ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                  }`} />
                </div>
                <div>
                  <CardTitle className="text-lg">Derogatory Marks</CardTitle>
                  <CardDescription className="text-xs">Negative items that severely impact your score</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {((report?.collections || 0) + (report?.bankruptcies || 0) + (report?.liens || 0) + (report?.judgments || 0)) === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">No Derogatory Marks</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Your record is clean — keep it up!</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Collections', value: report?.collections || 0 },
                    { label: 'Bankruptcies', value: report?.bankruptcies || 0 },
                    { label: 'Liens', value: report?.liens || 0 },
                    { label: 'Judgments', value: report?.judgments || 0 },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-xl text-center ${item.value > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/50'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</p>
                      <p className={`text-2xl font-bold ${item.value > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Credit Inquiries — Enhanced Panel */}
        <motion.div custom={12} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <CreditInquiriesPanel />
        </motion.div>

        {/* Report Info Footer */}
        <motion.div custom={13} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card className="bg-muted/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-11 w-11 shrink-0 rounded-2xl bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Report ID: {reportData?.report_id || 'N/A'}</p>
                <p className="text-xs text-muted-foreground">
                  {reportData?.generated_at ? new Date(reportData.generated_at).toLocaleString() : 'N/A'}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold shrink-0">Full Report</Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
