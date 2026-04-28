import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const SNIPPET_URL = "/docs/snippets/auth-and-payments.md";

export default function ClientSnippets() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Client Snippets</h1>
        <p className="text-muted-foreground mt-2">
          Copy-paste cURL and JavaScript requests for every authentication and core
          payment endpoint, validated against the public sandbox.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download bundle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Markdown bundle containing OAuth2, OIDC discovery, charges, refunds,
            payouts, and webhook verification examples.
          </p>
          <Button asChild variant="outline">
            <a href={SNIPPET_URL} download>
              <Download className="h-4 w-4 mr-2" /> auth-and-payments.md
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What's inside</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
            <li>OAuth2 client-credentials token exchange</li>
            <li>OIDC discovery (<code>/.well-known/openid-configuration</code>)</li>
            <li>Create / retrieve a charge</li>
            <li>Issue a refund</li>
            <li>Create a payout / transfer</li>
            <li>Webhook signature verification (Node.js, header parity with runtime)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
