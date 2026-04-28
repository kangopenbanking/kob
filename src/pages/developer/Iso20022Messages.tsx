import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const parseCamt052 = `curl -X POST https://api.kangopenbanking.com/v1/standards/iso20022/camt052/parse \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/xml" \\
  -d '<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.08">
  <BkToCstmrAcctRpt>
    <GrpHdr>
      <MsgId>MSG-2026-001</MsgId>
      <CreDtTm>2026-04-01T10:00:00Z</CreDtTm>
    </GrpHdr>
    <Rpt>
      <Id>RPT-001</Id>
      <Acct><Id><IBAN>CM2110001000020123456789</IBAN></Id></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="XAF">1500000</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
    </Rpt>
  </BkToCstmrAcctRpt>
</Document>'`;

const parseResponse = `{
  "data": {
    "message_type": "camt.052.001.08",
    "group_header": {
      "message_id": "MSG-2026-001",
      "creation_datetime": "2026-04-01T10:00:00Z"
    },
    "reports": [
      {
        "id": "RPT-001",
        "account": { "iban": "CM2110001000020123456789" },
        "balances": [
          {
            "type": "ClosingBooked",
            "amount": 1500000,
            "currency": "XAF",
            "credit_debit": "Credit"
          }
        ]
      }
    ]
  }
}`;

const generatePacs008 = `curl -X POST https://api.kangopenbanking.com/v1/standards/iso20022/pacs008/generate \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message_id": "PACS-2026-001",
    "payment_information": {
      "amount": 250000,
      "currency": "XAF",
      "debtor": {
        "name": "Acme Corp SARL",
        "account": "CM2110001000020123456789"
      },
      "creditor": {
        "name": "Supplier Ltd",
        "account": "CM2110002000030987654321"
      },
      "remittance_info": "Invoice INV-2026-042"
    }
  }'`;

export default function Iso20022Messages() {
  return (
    <>
      <Helmet>
        <title>ISO 20022 Messages | Kang Open Banking Developer Docs</title>
        <meta name="description" content="ISO 20022 message reference for Kang Open Banking. Parse camt.052/053/054 statements and generate pain.001, pacs.008, pacs.002 payment messages." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/iso20022/messages" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">ISO 20022 Message Reference</h1>
          <p className="text-lg text-muted-foreground">
            Detailed reference for all 9 ISO 20022 message types supported by the Kang API. Each message type includes endpoint, request/response format, and field mappings.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="overview">Message Types</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Message</th>
                  <th className="text-left p-3 font-medium text-foreground">Name</th>
                  <th className="text-left p-3 font-medium text-foreground">Direction</th>
                  <th className="text-left p-3 font-medium text-foreground">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["pain.001.001.09", "Customer Credit Transfer Initiation", "Parse", "/v1/standards/iso20022/pain001/parse"],
                  ["pacs.008.001.08", "FI-to-FI Customer Credit Transfer", "Generate", "/v1/standards/iso20022/pacs008/generate"],
                  ["pacs.002.001.10", "Payment Status Report", "Generate", "/v1/standards/iso20022/pacs002/generate"],
                  ["pacs.004.001.11", "Payment Return", "Generate", "/v1/standards/iso20022/pacs004/generate"],
                  ["pacs.009.001.10", "FI Credit Transfer", "Generate", "/v1/standards/iso20022/pacs009/generate"],
                  ["camt.052.001.08", "Intraday Account Report", "Parse", "/v1/standards/iso20022/camt052/parse"],
                  ["camt.053.001.08", "End-of-Day Statement", "Parse", "/v1/standards/iso20022/camt053/parse"],
                  ["camt.054.001.08", "Debit/Credit Notification", "Parse", "/v1/standards/iso20022/camt054/parse"],
                  ["camt.056.001.10", "Payment Cancellation Request", "Generate", "/v1/standards/iso20022/camt056/generate"],
                ].map(([msg, name, dir, endpoint]) => (
                  <tr key={msg} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{msg}</td>
                    <td className="p-3 text-muted-foreground">{name}</td>
                    <td className="p-3 text-muted-foreground">{dir}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground break-all">{endpoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="parse-camt052">Parse: camt.052 (Intraday Report)</h2>
          <p className="text-muted-foreground mb-4">
            Submit raw XML and receive structured JSON with account balances and transaction entries.
          </p>
          <CodeBlock examples={[{ code: parseCamt052, language: "bash", label: "cURL" }]} />
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Response</h3>
          <CodeBlock examples={[{ code: parseResponse, language: "json" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="generate-pacs008">Generate: pacs.008 (Credit Transfer)</h2>
          <p className="text-muted-foreground mb-4">
            Submit JSON payment details and receive a valid ISO 20022 XML message ready for SWIFT or CEMAC RTGS submission.
          </p>
          <CodeBlock examples={[{ code: generatePacs008, language: "bash", label: "cURL" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="field-mapping">Field Mapping Reference</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">JSON Field</th>
                  <th className="text-left p-3 font-medium text-foreground">ISO 20022 XPath</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["message_id", "GrpHdr/MsgId", "string"],
                  ["creation_datetime", "GrpHdr/CreDtTm", "ISO 8601"],
                  ["amount", "CdtTrfTxInf/Amt/InstdAmt", "decimal"],
                  ["currency", "CdtTrfTxInf/Amt/InstdAmt/@Ccy", "string"],
                  ["debtor.name", "CdtTrfTxInf/Dbtr/Nm", "string"],
                  ["debtor.account", "CdtTrfTxInf/DbtrAcct/Id/IBAN", "string"],
                  ["creditor.name", "CdtTrfTxInf/Cdtr/Nm", "string"],
                  ["creditor.account", "CdtTrfTxInf/CdtrAcct/Id/IBAN", "string"],
                  ["remittance_info", "CdtTrfTxInf/RmtInf/Ustrd", "string"],
                ].map(([json, xpath, type]) => (
                  <tr key={json} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{json}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{xpath}</td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
