import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const sdks = [
  { name: "Node.js / TypeScript", install: "npm install @kangopenbanking/sdk", badge: "v1.0.0", status: "available" },
  { name: "Python", install: "pip install kangopenbanking", badge: "v1.0.0", status: "available" },
  { name: "PHP / Laravel", install: "composer require kangopenbanking/sdk", badge: "v1.0.0", status: "available" },
  { name: "cURL / REST", install: "No SDK needed — use any HTTP client", badge: "Universal", status: "available" },
];

export function SDKSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">SDKs & Libraries</h2>
        <p className="text-muted-foreground max-w-2xl">
          Official SDKs with full type safety, automatic auth, and webhook verification.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {sdks.map((sdk) => (
          <Card key={sdk.name} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{sdk.name}</h3>
                <Badge variant={sdk.status === "available" ? "default" : "secondary"} className="text-[10px]">
                  {sdk.badge}
                </Badge>
              </div>
              <div
                className="text-xs bg-muted px-2 py-1 rounded block font-mono cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-between"
                onClick={() => {
                  navigator.clipboard.writeText(sdk.install);
                  toast.success("Copied to clipboard");
                }}
              >
                <span className="truncate">{sdk.install}</span>
                <Copy className="h-3 w-3 shrink-0 ml-2 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex gap-3">
        <Link to="/developer/guides/sdks">
          <Button variant="outline" size="sm">
            All SDKs & Guides <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
        <Link to="/developer/examples">
          <Button variant="ghost" size="sm">
            Code Examples <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
