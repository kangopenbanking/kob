import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SdkExamplesShowcase } from "@/components/developer/SdkExamplesShowcase";
import { ArrowRightLeft } from "lucide-react";

const fieldMap: Array<{
  obie: string;
  canonical: string;
  type: string;
  notes: string;
}> = [
  { obie: "AccountId", canonical: "transaction.account_id", type: "string (UUID)", notes: "Identical value, different casing." },
  { obie: "TransactionId", canonical: "transaction.transaction_id", type: "string", notes: "Identical value, different casing." },
  { obie: "Amount.Amount", canonical: "transaction.amount", type: "string (minor units)", notes: "OBIE wraps amount + currency in an object; the canonical schema keeps them flat." },
  { obie: "Amount.Currency", canonical: "transaction.currency", type: "string (ISO 4217)", notes: "Identical value, different nesting." },
  { obie: "CreditDebitIndicator", canonical: "transaction.type", type: "enum", notes: "Map: Credit → credit, Debit → debit. Canonical uses snake_case lowercase." },
  { obie: "BookingDateTime", canonical: "transaction.booking_date", type: "ISO 8601", notes: "Identical value, different casing." },
  { obie: "ValueDateTime", canonical: "transaction.value_date", type: "ISO 8601", notes: "Identical value, different casing." },
  { obie: "TransactionInformation", canonical: "transaction.description", type: "string", notes: "Free-text. OBIE allows up to 500 chars; canonical is unbounded." },
  { obie: "Status", canonical: "transaction.status", type: "enum", notes: "Map: Booked → booked, Pending → pending, Rejected → rejected." },
];

const sideBySide = `// Same transaction, two shapes — pick one and stick with it per integration

// Canonical Kang OB (recommended for new builds)
{
  "transaction_id": "txn_1f2e3d",
  "account_id": "acc_8f1d",
  "amount": "5000",
  "currency": "XAF",
  "type": "debit",
  "description": "MTN MoMo charge — order #1842",
  "booking_date": "2026-04-23T14:32:11Z",
  "value_date": "2026-04-23T14:32:11Z",
  "status": "booked"
}

// OBIE Read/Write Data API v3.1.10 (use ?format=obie)
{
  "AccountId": "acc_8f1d",
  "TransactionId": "txn_1f2e3d",
  "Amount": { "Amount": "5000", "Currency": "XAF" },
  "CreditDebitIndicator": "Debit",
  "TransactionInformation": "MTN MoMo charge — order #1842",
  "BookingDateTime": "2026-04-23T14:32:11Z",
  "ValueDateTime": "2026-04-23T14:32:11Z",
  "Status": "Booked"
}`;

export default function ObieMigration() {
  return (
    <GuidePageShell
      eyebrow="Migration"
      title="Transaction vs TransactionOBIE — field mapping & migration guide"
      description="Pick the right transaction schema for your integration and migrate cleanly when your needs change. As of API v4.17.0, both shapes are first-class — but they live in separate schemas so SDK generators stay clean."
      readTime="6 min read"
      level="Intermediate"
      seoTitle="OBIE Field Migration Guide | Kang Open Banking"
      seoDescription="Side-by-side mapping between the canonical Transaction schema and the OBIE Read/Write Data API v3.1 TransactionOBIE schema, with code examples in cURL, Node.js and Python."
      primaryCta={{ label: "Open API Explorer", to: "/developer/api-explorer" }}
      secondaryCta={{ label: "View v4.17.0 changelog", to: "/developer/changelog#v4-17-0" }}
      toc={[
        { id: "why", label: "Why two schemas?" },
        { id: "mapping", label: "Field mapping" },
        { id: "side-by-side", label: "Side-by-side example" },
        { id: "examples", label: "Code examples" },
        { id: "deprecation", label: "Deprecation timeline" },
      ]}
    >
      <GuideSectionBlock id="why" title="Why two schemas?">
        <p>
          The canonical <code>Transaction</code> schema uses snake_case and a flat
          shape that mirrors the rest of the Kang OB API (e.g. <code>amount</code>,{" "}
          <code>currency</code>, <code>booking_date</code>). It is the recommended
          choice for greenfield integrations and is what every Kang SDK returns by
          default.
        </p>
        <p>
          The <code>TransactionOBIE</code> schema is a faithful representation of
          the <strong>OBIE Read/Write Data API v3.1.10</strong>{" "}
          <code>OBReadTransaction6</code> object. It uses PascalCase and nests{" "}
          <code>Amount</code>/<code>Currency</code> inside an{" "}
          <code>Amount</code> object. Use it when:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You are reusing UK/EU OBIE-aligned client libraries.</li>
          <li>You need to forward payloads to a downstream OBIE-certified system unchanged.</li>
          <li>Your bank partner mandates the OBIE shape for AISP responses.</li>
        </ul>
        <GuideCallout variant="warning" title="Why we split them in v4.17.0">
          Until v4.16, both shapes shared the <code>Transaction</code> schema with
          mixed snake_case + PascalCase fields. SDK generators (OpenAPI Generator,
          openapi-typescript, NSwag, kiota) emitted classes with duplicate fields
          for the same value, breaking serialisation. v4.17.0 keeps the legacy
          aliases on <code>Transaction</code> (marked <code>deprecated</code>) and
          publishes the clean OBIE shape under <code>TransactionOBIE</code>.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="mapping" title="Field mapping table">
        <p>
          Every field on <code>TransactionOBIE</code> has a 1:1 counterpart on the
          canonical <code>Transaction</code> schema. The only structural difference
          is that OBIE wraps <code>Amount</code> and <code>Currency</code> in an{" "}
          <code>Amount</code> object.
        </p>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      TransactionOBIE
                    </Badge>
                  </span>
                </TableHead>
                <TableHead className="w-[40px] text-center">
                  <ArrowRightLeft className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                </TableHead>
                <TableHead className="w-[240px]">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Transaction (canonical)
                  </Badge>
                </TableHead>
                <TableHead className="w-[160px]">Type</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fieldMap.map((row) => (
                <TableRow key={row.obie}>
                  <TableCell className="font-mono text-xs">{row.obie}</TableCell>
                  <TableCell className="text-center text-muted-foreground">→</TableCell>
                  <TableCell className="font-mono text-xs">{row.canonical}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.type}</TableCell>
                  <TableCell className="text-sm">{row.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="side-by-side" title="Side-by-side example">
        <p>
          The same transaction, served by the same endpoint, in both shapes. Add{" "}
          <code>?format=obie</code> to the query string to receive the OBIE
          variant.
        </p>
        <CodeBlock examples={[{ language: "json", label: "Both schemas", code: sideBySide }]} />
      </GuideSectionBlock>

      <GuideSectionBlock id="examples" title="Code examples — fetch and normalise">
        <p>
          The snippets below show how to call the transactions endpoint with the
          OBIE shape and map it back to a flat domain object. They are the same
          examples featured in the SDK Examples component and are kept in sync
          with the OpenAPI spec.
        </p>
        <SdkExamplesShowcase />
      </GuideSectionBlock>

      <GuideSectionBlock id="deprecation" title="Deprecation timeline">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>v4.17.0 (current)</strong> — PascalCase aliases on{" "}
            <code>Transaction</code> are flagged <code>deprecated: true</code> with
            an <code>x-replacement</code> pointer to the matching{" "}
            <code>TransactionOBIE</code> field. Both still serialise; no runtime
            change.
          </li>
          <li>
            <strong>v4.x (next 12 months)</strong> — Deprecation warnings emitted
            in API responses via the <code>Deprecation</code> and{" "}
            <code>Sunset</code> HTTP headers (RFC&nbsp;8594).
          </li>
          <li>
            <strong>v5.0.0</strong> — PascalCase aliases removed from{" "}
            <code>Transaction</code>. Consumers that need OBIE must use{" "}
            <code>TransactionOBIE</code> by then. Documented in the changelog at
            least 90 days before release per Standing Order P10 (Living Docs).
          </li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
