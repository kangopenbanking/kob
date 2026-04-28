import { CodeBlock } from "@/components/developer/CodeBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, ShieldAlert } from "lucide-react";

/**
 * Reusable presentation block: drop into any developer page that documents a
 * secured endpoint to show the canonical 401 (Unauthorized) and 403 (Forbidden)
 * response shapes the gateway returns. Sourced from
 * components.responses.{Unauthorized,Forbidden} in openapi.json (v4.17.0).
 */
export function SecuredResponseSamples({
  endpoint = "GET /v1/aisp/accounts",
  scopeRequired = "accounts:read",
}: {
  endpoint?: string;
  scopeRequired?: string;
}) {
  const unauthorizedCurl = `# Replay the request with an expired or missing bearer token
curl -i -X ${endpoint.split(" ")[0]} \\
  "https://api.kangopenbanking.com/v1${endpoint.split(" ")[1] ?? ""}" \\
  -H "Authorization: Bearer expired_or_invalid_token"

HTTP/1.1 401 Unauthorized
Content-Type: application/problem+json
WWW-Authenticate: Bearer realm="kob", error="invalid_token", error_description="Access token expired"

{
  "type": "https://kangopenbanking.com/errors/invalid_token",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token expired at 2026-04-24T01:55:00Z. Refresh and retry.",
  "error_id": "err_8f3a91c4",
  "timestamp": "2026-04-24T02:01:12Z",
  "instance": "${endpoint.split(" ")[1] ?? "/v1/resource"}"
}`;

  const forbiddenCurl = `# Same endpoint, valid token but missing the "${scopeRequired}" scope
curl -i -X ${endpoint.split(" ")[0]} \\
  "https://api.kangopenbanking.com/v1${endpoint.split(" ")[1] ?? ""}" \\
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."

HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://kangopenbanking.com/errors/insufficient_scope",
  "title": "Forbidden",
  "status": 403,
  "detail": "Token is valid but missing required scope: ${scopeRequired}.",
  "required_scope": "${scopeRequired}",
  "granted_scopes": ["openid", "profile"],
  "error_id": "err_2b71d0aa",
  "timestamp": "2026-04-24T02:02:48Z",
  "instance": "${endpoint.split(" ")[1] ?? "/v1/resource"}"
}`;

  return (
    <div className="grid gap-4 md:grid-cols-2 my-6">
      <Card className="border-amber-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            401 Unauthorized
            <Badge variant="outline" className="ml-auto text-[10px] font-mono">
              application/problem+json
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">
            Returned when the access token is missing, malformed, expired, or
            revoked (RFC&nbsp;6750&nbsp;§3.1).
          </p>
          <CodeBlock examples={[{ language: "bash", label: "cURL", code: unauthorizedCurl }]} />
        </CardContent>
      </Card>

      <Card className="border-rose-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            403 Forbidden
            <Badge variant="outline" className="ml-auto text-[10px] font-mono">
              application/problem+json
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">
            Returned when the token is valid but lacks the required scope or the
            resource is not owned by the calling client.
          </p>
          <CodeBlock examples={[{ language: "bash", label: "cURL", code: forbiddenCurl }]} />
        </CardContent>
      </Card>
    </div>
  );
}
