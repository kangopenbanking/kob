import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Server, Database, FileText, Users, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";

const connectorTypes = [
  {
    id: "api",
    title: "API Connector",
    description: "For banks with existing REST/SOAP APIs. Connect directly to core banking endpoints.",
    icon: Server,
    features: ["Real-time data sync", "Bidirectional communication", "OAuth2/API key auth"],
    status: "Available",
  },
  {
    id: "database",
    title: "Database Connector",
    description: "Read-only SQL access to bank core systems (Oracle, PostgreSQL, MySQL).",
    icon: Database,
    features: ["Configurable polling interval", "Watermark-based sync", "Schema mapping"],
    status: "Available",
  },
  {
    id: "file",
    title: "File-Based Connector",
    description: "Daily CSV, MT940, or CAMT.053 file imports via SFTP or upload.",
    icon: FileText,
    features: ["ISO 20022 support", "SHA-256 deduplication", "Batch processing"],
    status: "Available",
  },
  {
    id: "manual",
    title: "Manual Console",
    description: "For banks with no digital system. Staff approve/reject via secure back-office UI.",
    icon: Users,
    features: ["Approval queue", "Manual entry", "Audit trail"],
    status: "Available",
  },
];

export default function BankConnectorSetup() {
  const [selectedType, setSelectedType] = useState<string | null>(null);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connector Setup</h1>
        <p className="text-muted-foreground">Choose how your bank connects to the Kang Open Banking platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {connectorTypes.map((ct) => (
          <Card
            key={ct.id}
            className={`cursor-pointer border transition-all ${
              selectedType === ct.id ? "border-primary ring-1 ring-primary/20" : "border-border/50 hover:border-border"
            }`}
            onClick={() => setSelectedType(ct.id)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <ct.icon className="h-8 w-8 text-primary" />
                <Badge variant="outline">{ct.status}</Badge>
              </div>
              <CardTitle className="mt-3">{ct.title}</CardTitle>
              <CardDescription>{ct.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {ct.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {selectedType === ct.id && (
                <Button className="mt-4 w-full" size="sm">
                  Configure {ct.title}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedType && (
        <Card className="border border-border/50">
          <CardHeader>
            <CardTitle>Configuration Steps</CardTitle>
            <CardDescription>Follow these steps to complete your {connectorTypes.find(c => c.id === selectedType)?.title} setup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { step: 1, title: "Provide Connection Details", desc: "Enter your bank's endpoint URL, credentials, and environment settings." },
                { step: 2, title: "Configure Data Mapping", desc: "Map your bank's data fields to the KOB unified schema." },
                { step: 3, title: "Test Connection", desc: "Run a health check to verify connectivity and data flow." },
                { step: 4, title: "Enable Sync", desc: "Activate the connector and set your sync schedule." },
              ].map((s) => (
                <div key={s.step} className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-sm font-bold text-primary">
                    {s.step}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
