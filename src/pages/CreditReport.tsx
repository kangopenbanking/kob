import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, FileText, ArrowLeft, User, Briefcase, CreditCard, Search, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import CreditInquiriesPanel from '@/components/credit/CreditInquiriesPanel';
import PreApprovedOffersCard from '@/components/credit/PreApprovedOffersCard';

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
      }
      if (reportData.report) {
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

  const summaryStats = [
    { label: 'Credit Score', value: reportData?.score || 'N/A', icon: CreditCard, color: 'bg-primary/10 text-primary' },
    { label: 'Total Accounts', value: reportData?.report_summary?.total_accounts || 0, icon: Briefcase, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
    { label: 'Active Loans', value: reportData?.report_summary?.active_loans || 0, icon: Clock, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
    { label: 'Total Savings', value: `${(reportData?.report_summary?.total_savings || 0).toLocaleString()} XAF`, icon: CheckCircle, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  ];

  const loanRows = [
    { label: 'Total Loans', value: reportData?.report?.total_loans || 0 },
    { label: 'Active Loans', value: reportData?.report?.active_loans || 0 },
    { label: 'Completed Loans', value: reportData?.report?.completed_loans || 0 },
    { label: 'Total Borrowed', value: `${(reportData?.report?.total_borrowed || 0).toLocaleString()} XAF` },
    { label: 'On-Time Payment Rate', value: `${reportData?.report?.on_time_payment_rate || 0}%` },
  ];

  const inquiryRows = [
    { label: 'Hard Inquiries (6 months)', value: reportData?.report?.hard_inquiries_6m || 0 },
    { label: 'Hard Inquiries (12 months)', value: reportData?.report?.hard_inquiries_12m || 0 },
    { label: 'Soft Inquiries (Total)', value: reportData?.report?.soft_inquiries_total || 0 },
  ];

  const accountRows = [
    { label: 'Total Accounts', value: reportData?.report?.total_accounts || 0 },
    { label: 'Active Accounts', value: reportData?.report?.active_accounts || 0 },
    { label: 'Closed Accounts', value: reportData?.report?.closed_accounts || 0 },
  ];

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

        {/* Personal Information */}
        <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible" className="mt-6">
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
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  {reportData?.report?.personal_info_verified
                    ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                  <div>
                    <p className="text-xs text-muted-foreground">Identity</p>
                    <p className="text-sm font-semibold">{reportData?.report?.personal_info_verified ? 'Verified' : 'Not Verified'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  {reportData?.report?.employment_verified
                    ? <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    : <XCircle className="h-5 w-5 text-destructive shrink-0" />}
                  <div>
                    <p className="text-xs text-muted-foreground">Employment</p>
                    <p className="text-sm font-semibold">{reportData?.report?.employment_verified ? 'Verified' : 'Not Verified'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Account Summary */}
        <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
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
              <div className="space-y-0 divide-y divide-border/50">
                {accountRows.map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Loan History */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div>
                  <CardTitle className="text-lg">Loan History</CardTitle>
                  <CardDescription className="text-xs">Complete borrowing and repayment record</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-0 divide-y divide-border/50">
                {loanRows.map((row) => (
                  <div key={row.label} className="flex justify-between items-center py-3">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className="text-sm font-bold text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Credit Inquiries - Enhanced Panel */}
        <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <CreditInquiriesPanel />
        </motion.div>

        {/* Pre-Approved Loans */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
          <PreApprovedOffersCard creditScore={reportData?.score || 0} />
        </motion.div>

        {/* Report Info Footer */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="mt-5">
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
