import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { CheckCircle, Circle, Clock, AlertTriangle, Shield, TrendingUp, Calendar, Target, FileCheck, Landmark } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const documents = [
  { code: "KOB-REG-001", title: "Corporate Structure & Governance", completeness: 85, status: "review", route: "/regulatory/corporate-structure" },
  { code: "KOB-REG-002", title: "Internal Control Policy", completeness: 90, status: "review", route: "/regulatory/internal-control-policy" },
  { code: "KOB-REG-003", title: "PSP License Application", completeness: 70, status: "draft", route: "/regulatory/license-application" },
  { code: "KOB-REG-004", title: "Business Continuity & DR", completeness: 88, status: "review", route: "/regulatory/business-continuity" },
  { code: "KOB-REG-005", title: "AML/CFT Compliance Pack", completeness: 92, status: "review", route: "/regulatory/aml-cft-pack" },
  { code: "KOB-REG-006", title: "Data Protection Policy", completeness: 80, status: "draft", route: "/regulatory/data-protection-policy" },
  { code: "KOB-REG-007", title: "Technical System Disclosure", completeness: 95, status: "complete", route: "/regulatory/technical-disclosure" },
  { code: "KOB-REG-008", title: "Risk Assessment Matrix", completeness: 88, status: "review", route: "/regulatory/risk-assessment" },
  { code: "KOB-REG-009", title: "Reporting Templates", completeness: 75, status: "draft", route: "/regulatory/reporting-templates" },
];

const overallScore = Math.round(documents.reduce((s, d) => s + d.completeness, 0) / documents.length);

const complianceAreas = [
  { name: "AML/CFT", score: 92, weight: 25 },
  { name: "Capital Adequacy", score: 60, weight: 20 },
  { name: "Governance", score: 85, weight: 15 },
  { name: "Technology", score: 95, weight: 15 },
  { name: "Data Protection", score: 80, weight: 10 },
  { name: "Operational", score: 88, weight: 15 },
];

const timelineData = [
  { month: "Mar 2026", score: 45 },
  { month: "Apr 2026", score: 55 },
  { month: "May 2026", score: 65 },
  { month: "Jun 2026", score: 72 },
  { month: "Jul 2026", score: 78 },
  { month: "Aug 2026", score: overallScore },
];

const milestones = [
  { label: "Document Drafting", target: "Mar 2026", status: "complete" },
  { label: "Internal Review & Legal Sign-Off", target: "Apr 2026", status: "in-progress" },
  { label: "Capital Deposit (500M XAF)", target: "May 2026", status: "pending" },
  { label: "MLRO & CO Formal Appointment", target: "May 2026", status: "pending" },
  { label: "Submit to BEAC/COBAC", target: "Jun 2026", status: "pending" },
  { label: "COBAC Review & Site Inspection", target: "Jul–Sep 2026", status: "pending" },
  { label: "Conditional Approval", target: "Oct 2026", status: "pending" },
  { label: "Final License Issuance", target: "Dec 2026", status: "pending" },
];

const pieData = [
  { name: "Complete", value: documents.filter(d => d.status === "complete").length, color: "hsl(var(--primary))" },
  { name: "In Review", value: documents.filter(d => d.status === "review").length, color: "hsl(45 93% 47%)" },
  { name: "Draft", value: documents.filter(d => d.status === "draft").length, color: "hsl(var(--muted-foreground))" },
];

const statusIcon = (status: string) => {
  if (status === "complete") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (status === "in-progress") return <Clock className="h-4 w-4 text-yellow-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
};

export default function RegulatoryReadiness() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">BEAC / COBAC License Readiness</Badge>
        <h1 className="text-4xl font-bold mb-2">Regulatory Readiness Dashboard</h1>
        <p className="text-lg text-muted-foreground">Real-time compliance tracking for Cameroon PSP license application</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Target className="h-3 w-3" /> Overall Readiness</CardDescription>
            <CardTitle className="text-4xl">{overallScore}%</CardTitle>
          </CardHeader>
          <CardContent><Progress value={overallScore} className="h-2" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><FileCheck className="h-3 w-3" /> Documents</CardDescription>
            <CardTitle className="text-2xl">{documents.filter(d => d.status === "complete").length}/{documents.length} Complete</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{documents.filter(d => d.status === "review").length} in review, {documents.filter(d => d.status === "draft").length} draft</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Landmark className="h-3 w-3" /> Capital Status</CardDescription>
            <CardTitle className="text-2xl text-orange-600">Pending</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">500M XAF deposit required</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Est. Approval</CardDescription>
            <CardTitle className="text-2xl">Q4 2026</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">6–9 months from submission</p></CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Readiness Score Trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="url(#readinessGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Document Status</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart width={180} height={180}>
              <Pie data={pieData} cx={90} cy={90} innerRadius={50} outerRadius={75} dataKey="value" stroke="none">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </CardContent>
          <CardContent className="pt-0">
            <div className="flex justify-center gap-4 text-xs">
              {pieData.map(d => (
                <span key={d.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Domains */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Compliance Domain Scores</CardTitle>
          <CardDescription>Weighted scoring across 6 regulatory domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceAreas.map((area) => (
              <div key={area.name} className="flex items-center gap-4">
                <span className="text-sm font-medium w-36">{area.name}</span>
                <div className="flex-1">
                  <Progress value={area.score} className="h-3" />
                </div>
                <span className="text-sm font-semibold w-12 text-right">{area.score}%</span>
                <Badge variant="outline" className="text-xs w-20 justify-center">{area.weight}% weight</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Completeness */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Document Completeness Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.code} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                {statusIcon(doc.status)}
                <Badge variant="outline" className="font-mono text-xs shrink-0">{doc.code}</Badge>
                <Link to={doc.route} className="text-sm font-medium hover:text-primary transition-colors flex-1">{doc.title}</Link>
                <div className="w-32">
                  <Progress value={doc.completeness} className="h-2" />
                </div>
                <span className="text-sm font-semibold w-10 text-right">{doc.completeness}%</span>
                <Badge className={`text-xs capitalize ${doc.status === "complete" ? "bg-green-500/10 text-green-700 border-green-500/20" : doc.status === "review" ? "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" : "bg-muted text-muted-foreground"}`}>
                  {doc.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline to Approval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Timeline to BEAC/COBAC Approval</CardTitle>
          <CardDescription>Estimated milestone schedule from current state to license issuance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative ml-4">
            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-4 relative">
                  <div className="z-10 mt-0.5">{statusIcon(m.status)}</div>
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.target}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
