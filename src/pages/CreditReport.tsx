import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

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

      // Header
      doc.setFontSize(20);
      doc.text("Credit Report", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Report Date
      doc.setFontSize(10);
      doc.text(`Generated: ${reportData.generated_at ? new Date(reportData.generated_at).toLocaleDateString() : 'N/A'}`, pageWidth / 2, yPosition, { align: "center" });
      yPosition += 15;

      // Credit Score
      doc.setFontSize(14);
      doc.text("Credit Score", 20, yPosition);
      yPosition += 8;
      doc.setFontSize(12);
      doc.text(`Score: ${reportData.score || 'N/A'}`, 20, yPosition);
      yPosition += 12;

      // Account Summary
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

      // Loan History
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

      // Credit Inquiries
      if (reportData.report) {
        doc.setFontSize(14);
        doc.text("Credit Inquiries", 20, yPosition);
        yPosition += 8;
        doc.setFontSize(10);
        doc.text(`Hard Inquiries (6 months): ${reportData.report.hard_inquiries_6m || 0}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Hard Inquiries (12 months): ${reportData.report.hard_inquiries_12m || 0}`, 20, yPosition);
      }

      // Save the PDF
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
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Credit Report</h1>
          <p className="text-muted-foreground">Comprehensive view of your credit history</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Report Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.score || 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.report_summary?.total_accounts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.report_summary?.active_loans || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reportData?.report_summary?.total_savings?.toLocaleString() || '0'} XAF
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Verified identity and employment details</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Identity Verified</dt>
              <dd className="font-medium">{reportData?.report?.personal_info_verified ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Employment Verified</dt>
              <dd className="font-medium">{reportData?.report?.employment_verified ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Summary</CardTitle>
          <CardDescription>Overview of all financial accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Accounts</span>
              <span className="font-medium">{reportData?.report?.total_accounts || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Accounts</span>
              <span className="font-medium">{reportData?.report?.active_accounts || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Closed Accounts</span>
              <span className="font-medium">{reportData?.report?.closed_accounts || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
          <CardDescription>Complete borrowing and repayment record</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Loans</span>
              <span className="font-medium">{reportData?.report?.total_loans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Loans</span>
              <span className="font-medium">{reportData?.report?.active_loans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Completed Loans</span>
              <span className="font-medium">{reportData?.report?.completed_loans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Borrowed</span>
              <span className="font-medium">
                {reportData?.report?.total_borrowed?.toLocaleString() || '0'} XAF
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">On-Time Payment Rate</span>
              <span className="font-medium">{reportData?.report?.on_time_payment_rate || 0}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credit Inquiries</CardTitle>
          <CardDescription>Recent credit checks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hard Inquiries (6 months)</span>
              <span className="font-medium">{reportData?.report?.hard_inquiries_6m || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hard Inquiries (12 months)</span>
              <span className="font-medium">{reportData?.report?.hard_inquiries_12m || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Soft Inquiries (Total)</span>
              <span className="font-medium">{reportData?.report?.soft_inquiries_total || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Report ID: {reportData?.report_id}</p>
              <p className="text-sm text-muted-foreground">
                Generated: {reportData?.generated_at ? new Date(reportData.generated_at).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
