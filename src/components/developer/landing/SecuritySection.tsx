import { Shield, Lock, Key, FileCheck, Server, Eye } from "lucide-react";

export function SecuritySection() {
  const practices = [
    { icon: Shield,    title: "OAuth 2.0 + OpenID Connect",  description: "Industry-standard authorization with PKCE and FAPI 1.0 Advanced profile support." },
    { icon: Lock,      title: "Mutual TLS (mTLS)",           description: "Certificate-bound access tokens for sender-constrained API access." },
    { icon: Key,       title: "Rotating Refresh Tokens",     description: "Short-lived access tokens with refresh-token rotation and reuse detection." },
    { icon: FileCheck, title: "COBAC / CEMAC Compliant",     description: "Aligned with regional banking regulations and KYC/AML requirements." },
    { icon: Server,    title: "PCI-DSS Infrastructure",      description: "Card data is tokenized and never touches your servers — fully PCI-compliant flows." },
    { icon: Eye,       title: "Full Audit Trail",            description: "Every API call is logged with device, IP, and consent metadata for forensic review." },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Security &amp; Compliance</h2>
        <p className="text-muted-foreground max-w-2xl">
          Bank-grade security built into every layer of the platform — so you can ship with confidence.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {practices.map((item) => (
          <div key={item.title} className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
            <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
