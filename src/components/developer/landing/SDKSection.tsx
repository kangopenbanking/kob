import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, ExternalLink, FileCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KOB_API_VERSION_LABEL } from "@/config/version";

const sdks = [
  {
    name: "Node.js / TypeScript",
    install: "npm install @kang/openbanking-node",
    badge: "v1.1.0",
    status: "available",
    github: "https://github.com/kangfinance/openbanking-node",
    features: ["Full TypeScript types", "OAuth2 + PKCE", "Webhook verification"],
    license: "MIT",
  },
  {
    name: "Python",
    install: "pip install kang-openbanking",
    badge: "v1.1.0",
    status: "available",
    github: "https://github.com/kangfinance/openbanking-python",
    features: ["Typed responses", "Context manager", "Async support"],
    license: "MIT",
  },
  {
    name: "PHP / Laravel",
    install: "composer require kang/openbanking-php",
    badge: "v1.1.0",
    status: "available",
    github: "https://github.com/kangfinance/openbanking-php",
    features: ["Laravel facade", "Webhook middleware", "Auto-discovery"],
    license: "MIT",
  },
  {
    name: "cURL / REST",
    install: "No SDK needed — use any HTTP client",
    badge: "Universal",
    status: "available",
    github: null,
    features: ["391 operations", "OpenAPI 3.1 spec", "JSON request/response"],
    license: null,
  },
];

export function SDKSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">SDKs and Libraries</h2>
        <p className="text-muted-foreground max-w-2xl">
          Official SDKs with full type safety, automatic OAuth2 authentication, idempotency key injection, and HMAC webhook signature verification.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {sdks.map((sdk) => (
          <Card key={sdk.name} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{sdk.name}</h3>
                <Badge variant={sdk.status === "available" ? "default" : "secondary"} className="text-[10px]">
                  {sdk.badge}
                </Badge>
              </div>

              <div
                className="text-xs bg-muted px-2 py-1 rounded font-mono cursor-pointer hover:bg-muted/80 transition-colors flex items-center justify-between"
                onClick={() => {
                  navigator.clipboard.writeText(sdk.install);
                  toast.success("Copied to clipboard");
                }}
              >
                <span className="truncate">{sdk.install}</span>
                <Copy className="h-3 w-3 shrink-0 ml-2 text-muted-foreground" />
              </div>

              <ul className="text-xs text-muted-foreground space-y-0.5">
                {sdk.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-primary/50 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {sdk.github && (
                <a
                  href={sdk.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Postman Collection */}
      <Card className="hover:border-primary/30 transition-colors">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-muted">
                <FileCode className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Postman Collection</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All 339 endpoints with pre-configured sandbox environments and example request bodies.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to="/developer/guides/postman">
                <Button variant="outline" size="sm">
                  Setup Guide <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
              <a
                href="https://www.postman.com/kangopenbanking"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="sm">
                  Run in Postman <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OpenAPI Spec download */}
      <Card className="hover:border-primary/30 transition-colors">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-muted">
                <FileCode className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">OpenAPI Specification</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Download the full OpenAPI 3.1 spec ({KOB_API_VERSION_LABEL}) in JSON or YAML. Import into any tool.
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <a href="https://kangopenbanking.com/openapi.json" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">JSON</Button>
              </a>
              <a href="https://kangopenbanking.com/openapi-sandbox.json" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">Sandbox JSON</Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link to="/developer/guides/sdks">
          <Button variant="outline" size="sm">
            All SDKs and Guides <ArrowRight className="ml-1 h-3 w-3" />
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
