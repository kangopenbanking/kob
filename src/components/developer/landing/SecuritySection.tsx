import { Shield, Lock, Key, FileCheck, Server, Eye } from "lucide-react";

const practices = [
  { icon: Shield, title: "OAuth 2.0 & FAPI", description: "Industry-standard authorization with Financial-grade API security profiles." },
  { icon: Lock, title: "mTLS & Certificate Binding", description: "Mutual TLS and RFC 8705 certificate-bound access tokens in production." },
  { icon: Key, title: "Token Encryption", description: "All access tokens are hashed at rest; refresh tokens rotate on every use." },
  { icon: FileCheck, title: "COBAC Compliance", description: "Built to meet Central African Banking Commission regulatory requirements." },
  { icon: Server, title: "PCI DSS Level 1", description: "Card data handled in a PCI-compliant vault — you never touch raw PANs." },
  { icon: Eye, title: "Full Audit Trail", description: "Every API call logged with IP, user agent, geolocation, and device fingerprint." },
];

export function SecuritySection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Enterprise-Grade Security</h2>
        <p className="text-muted-foreground max-w-2xl">
          Bank-level security is not optional — it's built into every layer of the API.
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
