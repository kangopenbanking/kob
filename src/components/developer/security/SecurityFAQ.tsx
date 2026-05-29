import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { KOB_API_VERSION } from "@/config/version";


const HEALTHZ = "https://api.kangopenbanking.com/v1/healthz";
const OIDC = "https://api.kangopenbanking.com/v1/oidc-config";

const FAQS = [
  {
    q: "Is OAuth 2.0 actually implemented?",
    a: (
      <>
        Yes — fully. The token, authorize, revoke, and introspect endpoints are live and discoverable via{" "}
        <a href={OIDC} target="_blank" rel="noopener noreferrer" className="underline">/oidc-config</a> and verifiable through{" "}
        <a href={HEALTHZ} target="_blank" rel="noopener noreferrer" className="underline">/healthz</a>. Reviews citing v0.1.0 with only a
        <code className="mx-1 rounded bg-muted px-1">hello()</code> method are inspecting an unrelated stale npm package, not this API.
      </>
    ),
  },
  {
    q: "What FAPI profile is supported?",
    a: <>FAPI 1.0 Advanced. PAR is required, request objects must be signed (JAR), PKCE is S256-only, and tokens are certificate-bound. The OIDC discovery document advertises all four flags.</>,
  },
  {
    q: "Is mTLS supported?",
    a: <>Yes — RFC 8705 mTLS client authentication and certificate-bound access tokens are implemented. In self-hosted deployments, your reverse proxy must forward client certificate headers (X-SSL-Client-Cert) for cert-binding to take effect.</>,
  },
  {
    q: "Is there a sandbox?",
    a: <>Yes — and it is free forever. Sandbox keys use the <code className="mx-1 rounded bg-muted px-1">sbx_</code> prefix. Spin up an environment from the <a href="/developer/sandbox/console" className="underline">Sandbox Console</a>.</>,
  },
  {
    q: "Is this production-ready?",
    a: <>Yes. The current API version is v{KOB_API_VERSION}. Confirm via the <a href="/developer/changelog" className="underline">changelog</a> and the <code className="mx-1 rounded bg-muted px-1">version</code> field returned by /healthz.</>,
  },
  {
    q: "Which SDK should I install?",
    a: <>Use <code className="mx-1 rounded bg-muted px-1">@kangopenbanking/sdk</code> v1.2.0 (Node) or the active PHP SDK. Any package at v0.1.0 is not the official client — reviewers occasionally land on a stale unrelated package on npm and draw incorrect conclusions.</>,
  },
  {
    q: "Are webhooks signed?",
    a: <>Yes — HMAC-SHA256 signatures are sent in the <code className="mx-1 rounded bg-muted px-1">x-webhook-signature</code> header with timestamp tolerance for replay protection. Failed deliveries retry up to 7 times with exponential backoff.</>,
  },
  {
    q: "Where is the OpenAPI specification?",
    a: <>Publicly downloadable at <a href="/openapi.json" className="underline">/openapi.json</a> and <a href="/openapi.yaml" className="underline">/openapi.yaml</a>. No login required. Per Standing Order P4 it will never be moved behind authentication.</>,
  },
];

export function SecurityFAQ() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security FAQ</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Direct answers to the most common review questions, with links to verify each claim live.
        </p>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
