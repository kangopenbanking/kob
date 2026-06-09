// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4, P6)
// Side-by-side documentation of every Kang registration flow.
import { Helmet } from "react-helmet-async";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type Field = { name: string; type: string; required: boolean; notes?: string };
type Flow = {
  key: "personal" | "business" | "institution" | "developer";
  title: string;
  entryRoute: string;
  authMethod: string;
  states: string[];
  fields: Field[];
  diagram: string;
};

const FLOWS: Flow[] = [
  {
    key: "personal",
    title: "Personal (Consumer)",
    entryRoute: "/app/register",
    authMethod: "Phone OTP",
    states: ["pending_kyc", "under_review", "info_requested", "approved", "rejected"],
    fields: [
      { name: "phone", type: "E.164", required: true },
      { name: "full_name", type: "string", required: true },
      { name: "date_of_birth", type: "date", required: true },
      { name: "photo_id_front", type: "image/jpeg|png|pdf", required: true },
      { name: "photo_id_back", type: "image/jpeg|png|pdf", required: true },
      { name: "selfie", type: "image/jpeg|png", required: true },
      { name: "pin", type: "6-digit", required: true, notes: "Hashed server-side" },
      { name: "referral_code", type: "string", required: false },
    ],
    diagram: `sequenceDiagram
    participant U as User
    participant A as /app/register
    participant E as customer-register
    participant K as unified-kyc-gateway
    participant Y as Youverify
    U->>A: Submit wizard (8 steps)
    A->>E: POST profile + docs
    E->>K: Enqueue KYC
    K->>Y: Verify ID + selfie
    Y-->>K: Webhook (matched by youverify_session_id)
    K-->>U: status=under_review|approved|rejected`,
  },
  {
    key: "business",
    title: "Business (Merchant)",
    entryRoute: "/merchant-register",
    authMethod: "Email + password",
    states: ["pending_kyb", "under_review", "info_requested", "approved", "rejected", "suspended"],
    fields: [
      { name: "business_name", type: "string", required: true },
      { name: "business_type", type: "enum", required: true },
      { name: "country", type: "ISO-2", required: true },
      { name: "contact_phone", type: "E.164", required: true },
      { name: "registration_doc", type: "application/pdf", required: true },
      { name: "owner_id", type: "image|pdf", required: true },
      { name: "address_proof", type: "application/pdf", required: true },
      { name: "tax_id", type: "string", required: false },
    ],
    diagram: `sequenceDiagram
    participant U as Owner
    participant M as /merchant-register
    participant E as merchant-register
    participant K as MerchantKYB
    participant A as admin-kyb-verify
    U->>M: 4-step wizard
    M->>E: POST business profile
    E-->>U: status=pending_kyb
    U->>K: Upload KYB docs
    K->>A: Submit (step-up MFA required)
    A-->>U: approved | rejected`,
  },
  {
    key: "institution",
    title: "Institution (Bank / FI)",
    entryRoute: "/register",
    authMethod: "Email auth",
    states: ["pending", "under_review", "info_requested", "approved", "rejected"],
    fields: [
      { name: "institution_name", type: "string", required: true },
      { name: "institution_type", type: "enum (bank|mfi|payment)", required: true },
      { name: "registration_number", type: "string", required: true },
      { name: "address", type: "string", required: true },
      { name: "country", type: "ISO-2", required: true },
      { name: "phone", type: "E.164", required: true },
      { name: "website", type: "url", required: false },
      { name: "use_kob_flutterwave", type: "boolean", required: false },
      { name: "pin", type: "6-digit", required: true },
    ],
    diagram: `sequenceDiagram
    participant U as FI Admin
    participant R as /register
    participant E as institution-register
    participant A as admin-institution-approve
    U->>R: 2-step (details + PIN)
    R->>E: POST institution
    E-->>U: redirect /pending-approval
    U->>A: (Admin reviews; step-up MFA)
    A-->>U: approved → /fi-portal`,
  },
  {
    key: "developer",
    title: "Developer / TPP",
    entryRoute: "/tpp/register (or /developer/register)",
    authMethod: "Signed SSA JWT (RFC 7591)",
    states: ["pending", "approved", "rejected", "revoked"],
    fields: [
      { name: "software_statement", type: "JWT (RS256/ES256/PS256)", required: true, notes: "Signed by approved issuer" },
      { name: "redirect_uris", type: "string[]", required: true, notes: "HTTPS only (localhost allowed)" },
      { name: "grant_types", type: "string[]", required: false, notes: "subset of {client_credentials, authorization_code, refresh_token}" },
      { name: "scope", type: "space-delimited", required: false },
      { name: "token_endpoint_auth_method", type: "enum", required: false, notes: "tls_client_auth | private_key_jwt | client_secret_*" },
      { name: "jwks_uri", type: "url", required: false },
    ],
    diagram: `sequenceDiagram
    participant T as TPP
    participant D as POST /v1/dcr/register
    participant J as JWKS
    participant DB as tpp_registrations
    T->>D: SSA + redirect_uris
    D->>J: Fetch JWKS for iss
    J-->>D: keys
    D->>D: Verify signature + claims
    D->>DB: Insert client + hash secret
    D-->>T: 201 {client_id, client_secret*}
    Note over T: secret shown once`,
  },
];

const unifiedDiagram = `stateDiagram-v2
    [*] --> pending
    pending --> under_review: KYC/KYB submitted
    under_review --> info_requested: admin needs more
    info_requested --> under_review: user resubmits
    under_review --> approved: admin approves (step-up MFA)
    under_review --> rejected: admin rejects
    approved --> [*]
    rejected --> [*]`;

function FieldsTable({ fields }: { fields: Field[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b border-border/60">
            <th className="py-2 pr-2 font-medium">Field</th>
            <th className="py-2 pr-2 font-medium">Type</th>
            <th className="py-2 pr-2 font-medium">Req</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-b border-border/30 align-top">
              <td className="py-1.5 pr-2 font-mono text-xs">{f.name}</td>
              <td className="py-1.5 pr-2 text-xs">{f.type}</td>
              <td className="py-1.5 pr-2 text-xs">
                {f.required ? (
                  <Badge variant="default" className="text-[10px]">required</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">optional</Badge>
                )}
                {f.notes && <span className="ml-1 text-muted-foreground">— {f.notes}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowCard({ flow }: { flow: Flow }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{flow.title}</CardTitle>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Entry:</span> <code>{flow.entryRoute}</code></p>
          <p><span className="font-medium text-foreground">Auth:</span> {flow.authMethod}</p>
          <p>
            <span className="font-medium text-foreground">States:</span>{" "}
            {flow.states.map((s) => (
              <Badge key={s} variant="secondary" className="ml-1 text-[10px]">{s}</Badge>
            ))}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldsTable fields={flow.fields} />
        <MermaidDiagram chart={flow.diagram} />
      </CardContent>
    </Card>
  );
}

export default function RegistrationFlowsDocs() {
  return (
    <div className="container max-w-7xl py-8">
      <Helmet>
        <title>Registration Flows · Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Side-by-side reference for Personal, Business, Institution, and Developer (TPP) registration flows on Kang Open Banking, including required fields, state machines, and sequence diagrams."
        />
        <link rel="canonical" href="https://kob.lovable.app/developer/registration-flows" />
      </Helmet>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Registration Flows</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Side-by-side reference for every Kang account type. Each card lists the required onboarding
          fields, the lifecycle states an entity passes through, and a sequence diagram of the calls
          and webhooks emitted during registration.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Unified lifecycle</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          All four account types share the same outer state machine. Approval transitions are
          step-up MFA gated on the admin side and emit <code>registration.*</code> webhooks.
        </p>
        <MermaidDiagram chart={unifiedDiagram} />
      </section>

      {/* Desktop: 4-column grid; Mobile: tabs */}
      <div className="hidden xl:grid xl:grid-cols-4 xl:gap-4">
        {FLOWS.map((f) => <FlowCard key={f.key} flow={f} />)}
      </div>
      <div className="xl:hidden">
        <Tabs defaultValue="personal">
          <TabsList className="w-full justify-start overflow-x-auto">
            {FLOWS.map((f) => (
              <TabsTrigger key={f.key} value={f.key}>{f.title}</TabsTrigger>
            ))}
          </TabsList>
          {FLOWS.map((f) => (
            <TabsContent key={f.key} value={f.key} className="mt-4">
              <FlowCard flow={f} />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <section className="mt-10 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
        <h2 className="mb-1 text-base font-medium">Registration lifecycle webhooks</h2>
        <p className="text-muted-foreground">
          Subscribe to these event types to automate onboarding handoffs:
        </p>
        <ul className="mt-2 list-disc pl-5 font-mono text-xs">
          <li>registration.pending</li>
          <li>registration.under_review</li>
          <li>registration.approved</li>
          <li>registration.rejected</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Event payload schemas are documented in <a className="underline" href="/openapi.json">openapi.json</a> and
          validated client-side by <code>src/lib/webhook-event-schemas.ts</code>.
        </p>
      </section>
    </div>
  );
}
