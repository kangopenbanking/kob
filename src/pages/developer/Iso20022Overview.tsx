import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function Iso20022Overview() {
  return (
    <>
      <Helmet>
        <title>ISO 20022 Guide | Kang Open Banking Developer Docs</title>
        <meta name="description" content="ISO 20022 financial messaging via the Kang Open Banking API. Parse and generate pain.001, pacs.008, camt.052/053/054, and 4 more message types." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/iso20022" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">ISO 20022</h1>
          <p className="text-lg text-muted-foreground">
            The Kang API supports 9 ISO 20022 message types for financial messaging. Parse incoming bank statements, generate payment instructions, and handle status reports — all via REST API.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="messages">Supported Message Types</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Message</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Direction</th>
                  <th className="text-left p-3 font-medium text-foreground">Endpoint</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["pain.001.001.09", "Customer Credit Transfer Init", "Parse", "/v1/standards/iso20022/pain001/parse"],
                  ["pacs.008.001.08", "FI-to-FI Customer Credit Transfer", "Generate", "/v1/standards/iso20022/pacs008/generate"],
                  ["pacs.002.001.10", "Payment Status Report", "Generate", "/v1/standards/iso20022/pacs002/generate"],
                  ["pacs.004.001.11", "Payment Return", "Generate", "/v1/standards/iso20022/pacs004/generate"],
                  ["pacs.009.001.10", "FI Credit Transfer", "Generate", "/v1/standards/iso20022/pacs009/generate"],
                  ["camt.052.001.08", "Bank-to-Customer Account Report", "Parse", "/v1/standards/iso20022/camt052/parse"],
                  ["camt.053.001.08", "Bank-to-Customer Statement", "Parse", "/v1/standards/iso20022/camt053/parse"],
                  ["camt.054.001.08", "Debit/Credit Notification", "Parse", "/v1/standards/iso20022/camt054/parse"],
                  ["camt.056.001.10", "Payment Cancellation Request", "Generate", "/v1/standards/iso20022/camt056/generate"],
                ].map(([msg, type, dir, endpoint]) => (
                  <tr key={msg} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{msg}</td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                    <td className="p-3 text-muted-foreground">{dir}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground break-all">{endpoint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="generate-pacs008">Example: Generate pacs.008</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/standards/iso20022/pacs008/generate \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "message_id": "MSG-2026-03-27-001",
    "creation_date_time": "2026-03-27T14:32:00Z",
    "number_of_transactions": 1,
    "settlement_method": "CLRG",
    "transactions": [{
      "instruction_id": "INSTR-001",
      "end_to_end_id": "E2E-2026-001",
      "amount": "500000",
      "currency": "XAF",
      "debtor": {
        "name": "Kang Fintech SARL",
        "account": { "iban": "CM2110001000020123456789012" }
      },
      "creditor": {
        "name": "Supplier SARL",
        "account": { "iban": "CM2110002000030987654321098" }
      },
      "purpose": "SUPP"
    }]
  }'

# Response contains generated XML in data.xml field`, language: "bash" }]} title="Generate pacs.008 Payment" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="parse-camt054">Example: Parse camt.054</h2>
          <CodeBlock examples={[{ code: `curl -X POST https://api.kangopenbanking.com/v1/standards/iso20022/camt054/parse \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/xml" \\
  --data-binary @notification.xml

# Response: Structured JSON with parsed notification entries
{
  "data": {
    "message_id": "CAMT054-2026-001",
    "entries": [
      {
        "amount": "250000",
        "currency": "XAF",
        "credit_debit": "CRDT",
        "status": "BOOK",
        "reference": "REF-001"
      }
    ]
  }
}`, language: "bash" }]} title="Parse camt.054 Notification" />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
