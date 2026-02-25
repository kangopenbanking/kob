import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const sdks = [
  { name: "Node.js / TypeScript", install: "npm install @kangopenbanking/sdk", badge: "Official" },
  { name: "Python", install: "pip install kangopenbanking", badge: "Official" },
  { name: "PHP / Laravel", install: "composer require kangopenbanking/sdk", badge: "Community" },
  { name: "Postman Collection", install: "Import from API Console", badge: "Download" },
];

export function SDKSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">SDKs & Libraries</h2>
        <p className="text-muted-foreground max-w-2xl">
          Official SDKs and community libraries to accelerate your integration.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {sdks.map((sdk) => (
          <Card key={sdk.name} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">{sdk.name}</h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {sdk.badge}
                </span>
              </div>
              <code className="text-xs bg-muted px-2 py-1 rounded block">{sdk.install}</code>
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
