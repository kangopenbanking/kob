import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Zap,
  Smartphone,
  CreditCard,
  Shield,
  Globe,
  Building2,
  BarChart3,
  Download,
  Printer,
} from "lucide-react";
import jsPDF from "jspdf";

const functions = [
  {
    icon: Database,
    title: "Account Information (AISP)",
    desc: "Real-time access to balances, transactions, and account details across 25+ banks via a single API.",
    highlights: ["Multi-bank aggregation", "OAuth 2.0 consent", "COBAC compliant"],
  },
  {
    icon: Zap,
    title: "Payment Initiation (PISP)",
    desc: "Instant domestic transfers, bulk payments, and scheduled transactions with SCA authentication.",
    highlights: ["Instant settlement", "Bulk payments", "SCA secured"],
  },
  {
    icon: Smartphone,
    title: "Mobile Money Integration",
    desc: "Connect MTN MoMo, Orange Money, and other mobile wallets for collections and disbursements.",
    highlights: ["MTN & Orange Money", "USSD fallback", "Real-time callbacks"],
  },
  {
    icon: CreditCard,
    title: "Virtual Card Issuance",
    desc: "Issue Visa/Mastercard virtual cards for online payments, funded from local currency accounts.",
    highlights: ["USD-denominated", "Spending controls", "Instant issuance"],
  },
  {
    icon: Shield,
    title: "CrediQ Credit Scoring",
    desc: "Alternative credit scoring engine using transaction data, mobile money history, and behavioral analytics.",
    highlights: ["AI-powered", "Financial inclusion", "Bureau-grade reports"],
  },
  {
    icon: Building2,
    title: "Institutional Banking Ops",
    desc: "Bank reconciliation, SWIFT/ISO 20022 messaging, branch management, and compliance reporting.",
    highlights: ["Automated reconciliation", "SWIFT messaging", "Regulatory reports"],
  },
];

const KeyFunctionsSummary = () => {
  const handlePrint = () => window.print();

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, w, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text("Kang Open Banking — Key Functions Overview", 14, 18);
    doc.setFontSize(9);
    doc.text("Confidential — Board Meeting Summary", w - 14, 18, { align: "right" });

    // Cards grid: 3 cols x 2 rows
    const cols = 3;
    const marginX = 14;
    const marginY = 34;
    const gap = 6;
    const cardW = (w - 2 * marginX - (cols - 1) * gap) / cols;
    const cardH = 52;

    doc.setTextColor(30, 30, 30);
    functions.forEach((fn, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = marginX + col * (cardW + gap);
      const y = marginY + row * (cardH + gap);

      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "S");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(fn.title, x + 4, y + 8);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const descLines = doc.splitTextToSize(fn.desc, cardW - 8);
      doc.text(descLines, x + 4, y + 15);

      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      fn.highlights.forEach((h, j) => {
        doc.text(`• ${h}`, x + 4, y + 30 + j * 5);
      });
      doc.setTextColor(30, 30, 30);
    });

    // Footer
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("© 2026 Kang Open Banking — COBAC & BEAC Compliant | PCI-DSS Certified", 14, ph - 6);
    doc.text(`Generated ${new Date().toLocaleDateString()}`, w - 14, ph - 6, { align: "right" });

    doc.save("KOB-Key-Functions-Overview.pdf");
  };

  return (
    <div className="min-h-screen">
      {/* Screen controls — hidden when printing */}
      <div className="print:hidden bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Key Functions Overview</h1>
            <p className="text-sm text-muted-foreground">One-page summary for stakeholder meetings</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Printable area */}
      <div className="container mx-auto px-4 py-10 max-w-6xl print:px-0 print:py-0 print:max-w-none">
        {/* Print header */}
        <div className="hidden print:block bg-primary text-primary-foreground p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Kang Open Banking</h1>
                <p className="text-sm opacity-80">Key Functions Overview — Board Meeting Summary</p>
              </div>
            </div>
            <p className="text-sm opacity-70">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Financial Institutions", value: "25+" },
            { label: "Uptime SLA", value: "99.9%" },
            { label: "Avg Response", value: "<200ms" },
            { label: "Daily API Calls", value: "1M+" },
          ].map((s) => (
            <Card key={s.label} className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Functions grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {functions.map((fn) => (
            <Card key={fn.title} className="p-6 print:break-inside-avoid">
              <fn.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-lg font-bold mb-2">{fn.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{fn.desc}</p>
              <div className="flex flex-wrap gap-2">
                {fn.highlights.map((h) => (
                  <Badge key={h} variant="secondary" className="text-xs">{h}</Badge>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Compliance strip */}
        <Card className="p-6 bg-muted/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">COBAC Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">BEAC Regulated</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">PCI-DSS Certified</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                © 2026 Kang Open Banking — Confidential
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default KeyFunctionsSummary;
