// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4, P6)
// Side-by-side documentation of every Kang registration flow.
import { Helmet } from "react-helmet-async";
import { MermaidDiagram } from "@/components/developer/MermaidDiagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Building2, Landmark, Code2 } from "lucide-react";

type Field = { name: string; type: string; required: boolean; notes?: string };
type Flow = {
  key: "personal" | "business" | "institution" | "developer";
  title: string;
  icon: React.ElementType;
  entryRoute: string;
  authMethod: string;
  states: string[];
  fields: Field[];
  diagram: string;
  stateDiagram: string;
};

const FLOWS: Flow[] = [
  {
    key: "personal",
    title: "Personal (Consumer)",
    icon: User,
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
    autonumber
    participant U as User
    participant A as App (/app/register)
    participant E as customer-register
    participant K as unified-kyc-gateway
    participant Y as Youverify
    U->>A: Complete 8-step wizard
    A->>E: POST profile + documents
    E->>E: Create profile (pending_kyc)
    E->>K: Enqueue KYC verification
    K->>Y: Submit ID + selfie
    Y-->>K: Webhook result
    K-->>A: status = approved | rejected
    A-->>U: Land on /app (PIN set)`,
    stateDiagram: `stateDiagram-v2
    [*] --> pending_kyc
    pending_kyc --> under_review: docs uploaded
    under_review --> info_requested: admin needs more
    info_requested --> under_review: user resubmits
    under_review --> approved
    under_review --> rejected
    approved --> [*]
    rejected --> [*]`,
  },
  {
    key: "business",
    title: "Business (Merchant)",
    icon: Building2,
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
    autonumber
    participant U as Owner
    participant M as /merchant-register
    participant E as merchant-register
    participant K as MerchantKYB page
    participant A as admin-kyb-verify
    U->>M: 4-step wizard
    M->>E: POST business profile
    E-->>U: status = pending_kyb
    U->>K: Upload KYB documents
    K->>K: Submit to unified-kyc-gateway
    A->>A: Reviewer step-up MFA
    A-->>U: approved | rejected | info_requested`,
    stateDiagram: `stateDiagram-v2
    [*] --> pending_kyb
    pending_kyb --> under_review: KYB submitted
    under_review --> info_requested
    info_requested --> under_review
    under_review --> approved
    under_review --> rejected
    approved --> suspended: policy breach
    suspended --> approved: reinstated
    approved --> [*]
    rejected --> [*]`,
  },
  {
    key: "institution",
    title: "Institution (Bank / FI)",
    icon: Landmark,
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
    autonumber
    participant U as FI Admin
    participant R as /register
    participant E as institution-register
    participant P as /pending-approval
    participant A as admin-institution-approve
    U->>R: 2-step form (details + PIN)
    R->>E: POST institution
    E->>E: Create row (status=pending)
    E-->>P: Redirect to pending page
    A->>A: Reviewer step-up MFA
    A-->>U: approved -> /fi-portal`,
    stateDiagram: `stateDiagram-v2
    [*] --> pending
    pending --> under_review: KYB submitted
    under_review --> info_requested
    info_requested --> under_review
    under_review --> approved
    under_review --> rejected
    approved --> [*]
    rejected --> [*]`,
  },
  {
    key: "developer",
    title: "Developer / TPP",
    icon: Code2,
    entryRoute: "/tpp/register",
    authMethod: "Signed SSA JWT (RFC 7591)",
    states: ["pending", "approved", "rejected", "revoked"],
    fields: [
      { name: "software_statement", type: "JWT (RS256/ES256/PS256)", required: true, notes: "Signed by approved issuer" },
      { name: "redirect_uris", type: "string[]", required: true, notes: "HTTPS only" },
      { name: "grant_types", type: "string[]", required: false },
      { name: "scope", type: "space-delimited", required: false },
      { name: "token_endpoint_auth_method", type: "enum", required: false },
      { name: "jwks_uri", type: "url", required: false },
    ],
    diagram: `sequenceDiagram
    autonumber
    participant T as TPP
    participant D as POST /v1/dcr/register
    participant J as JWKS endpoint
    participant DB as tpp_registrations
    T->>D: SSA JWT + redirect_uris
    D->>J: Fetch issuer JWKS
    J-->>D: Public keys
    D->>D: Verify signature + claims
    D->>DB: Insert client + hash secret
    D-->>T: 201 with client_id + secret
    Note over T: Secret shown once only`,
    stateDiagram: `stateDiagram-v2
    [*] --> pending
    pending --> approved: SSA verified
    pending --> rejected: invalid SSA
    approved --> revoked: admin action
    approved --> [*]
    rejected --> [*]
    revoked --> [*]`,
  },
];

const unifiedDiagram = `flowchart TD
    A[Submit registration] --> B{Account type}
    B -->|Personal| C1[customer-register]
    B -->|Business| C2[merchant-register]
    B -->|Institution| C3[institution-register]
    B -->|Developer| C4[dcr-register-v1]
    C1 --> D[Status: pending]
    C2 --> D
    C3 --> D
    C4 --> D
    D --> E[Emit registration.pending webhook]
    E --> F{Requires admin review?}
    F -->|Yes| G[Status: under_review]
    F -->|No - TPP auto| K[Status: approved]
    G --> H[Emit registration.under_review]
    H --> I{Admin decision step-up MFA}
    I -->|Approve| K
    I -->|Reject| L[Status: rejected]
    I -->|Need info| M[Status: info_requested]
    M --> G
    K --> N[Emit registration.approved]
    L --> O[Emit registration.rejected]`;

function FieldsTable({ fields }: { fields: Field[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="py-2 px-3 font-medium">Field</th>
            <th className="py-2 px-3 font-medium">Type</th>
            <th className="py-2 px-3 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-t border-border/40 align-top">
              <td className="py-2 px-3 font-mono text-xs">{f.name}</td>
              <td className="py-2 px-3 text-xs">{f.type}</td>
              <td className="py-2 px-3 text-xs">
                {f.required ? (
                  <Badge variant="default" className="text-[10px]">required</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">optional</Badge>
                )}
                {f.notes && <div className="mt-1 text-muted-foreground">{f.notes}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowSection({ flow }: { flow: Flow }) {
  const Icon = flow.icon;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/30">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">{flow.title}</CardTitle>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Entry:</span> <code className="text-xs">{flow.entryRoute}</code></p>
              <p><span className="font-medium text-foreground">Auth:</span> {flow.authMethod}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs font-medium text-foreground mr-1">States:</span>
              {flow.states.map((s) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Required fields</h3>
            <FieldsTable fields={flow.fields} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">State machine</h3>
            <MermaidDiagram chart={flow.stateDiagram} />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sequence diagram</h3>
          <MermaidDiagram chart={flow.diagram} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegistrationFlowsDocs() {
  return (
    <div className="container max-w-6xl py-8">
      <Helmet>
        <title>Registration Flows · Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Reference for Personal, Business, Institution, and Developer (TPP) registration flows on Kang Open Banking, including required fields, state machines, and sequence diagrams."
        />
        <link rel="canonical" href="https://kob.lovable.app/developer/registration-flows" />
      </Helmet>

      <header className="mb-10">
        <Badge variant="outline" className="mb-2">Reference</Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Registration Flows</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Reference for every Kang account type. Each section lists the required onboarding fields,
          the lifecycle states an entity passes through, and a sequence diagram of the calls and
          webhooks emitted during registration.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-2">Unified lifecycle</h2>
        <p className="mb-4 text-sm text-muted-foreground max-w-3xl">
          All four account types share the same outer state machine. Approval transitions are
          step-up MFA gated on the admin side and emit <code className="text-xs bg-muted px-1 rounded">registration.*</code> webhooks
          so downstream systems can automate handoffs.
        </p>
        <MermaidDiagram chart={unifiedDiagram} />
      </section>

      <section className="space-y-8">
        <h2 className="text-xl font-semibold">Flow-by-flow reference</h2>
        {FLOWS.map((f) => <FlowSection key={f.key} flow={f} />)}
      </section>

      <section className="mt-12 rounded-lg border border-border/60 bg-muted/30 p-6">
        <h2 className="text-base font-semibold mb-2">Registration lifecycle webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Subscribe to these event types to automate onboarding handoffs:
        </p>
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
          <li className="rounded border border-border/60 bg-background px-3 py-2">registration.pending</li>
          <li className="rounded border border-border/60 bg-background px-3 py-2">registration.under_review</li>
          <li className="rounded border border-border/60 bg-background px-3 py-2">registration.approved</li>
          <li className="rounded border border-border/60 bg-background px-3 py-2">registration.rejected</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Event payload schemas are documented in <a className="underline" href="/openapi.json">openapi.json</a> and
          validated client-side by <code className="text-xs bg-muted px-1 rounded">src/lib/webhook-event-schemas.ts</code>.
        </p>
      </section>
    </div>
  );
}
