import { Helmet } from "react-helmet-async";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function BudgetingGuide() {
  return (
    <>
      <Helmet>
        <title>Smart Budgeting API | Kang Open Banking Developer Docs</title>
        <meta
          name="description"
          content="Build budgeting, savings goals, and trilingual AI financial advice for XAF customers with the Kang Open Banking /v1/budgeting/* API."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/budgeting" />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://kangopenbanking.com/developer/guides/budgeting" />
        <meta property="og:title" content="Smart Budgeting API | Kang Open Banking" />
        <meta
          property="og:description"
          content="Endpoints, schemas, and integration guide for the Smart Budgeting product."
        />
        <meta property="og:image" content="https://kangopenbanking.com/images/og-social.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Smart Budgeting API | Kang Open Banking" />
        <meta
          name="twitter:description"
          content="Endpoints, schemas, and integration guide for the Smart Budgeting product."
        />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Developer", item: "https://kangopenbanking.com/developer" },
            { "@type": "ListItem", position: 2, name: "Guides", item: "https://kangopenbanking.com/developer/guides/go-live" },
            { "@type": "ListItem", position: 3, name: "Smart Budgeting", item: "https://kangopenbanking.com/developer/guides/budgeting" },
          ],
        })}</script>
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Smart Budgeting API</h1>
          <p className="text-lg text-muted-foreground">
            The <code>/v1/budgeting/*</code> endpoints power consumer budgets, savings goals, and the trilingual KOB AI Adviser
            (English, French, Cameroonian Pidgin). All amounts are zero-decimal XAF.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What you can build</h2>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Monthly budgets with per-category limits and live spending</li>
            <li>Savings goals with optional round-up automation</li>
            <li>Threshold, overspend, milestone, and Njangi alerts</li>
            <li>On-demand AI advice in EN / FR / PID</li>
            <li>Merchant and monthly analytics for richer dashboards</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Endpoint summary</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="px-4 py-2 text-left">Method</th><th className="px-4 py-2 text-left">Path</th><th className="px-4 py-2 text-left">Purpose</th></tr>
              </thead>
              <tbody>
                {[
                  ["GET",  "/v1/budgeting/budgets/current",                "Active budget + computed summary"],
                  ["POST", "/v1/budgeting/budgets",                        "Create a budget (archives previous active)"],
                  ["PATCH","/v1/budgeting/budgets/:id/categories/:key",    "Update a single category limit"],
                  ["GET",  "/v1/budgeting/alerts",                         "List recent alerts"],
                  ["PATCH","/v1/budgeting/alerts/:id/dismiss",             "Dismiss an alert"],
                  ["GET",  "/v1/budgeting/goals",                          "List active savings goals"],
                  ["POST", "/v1/budgeting/goals",                          "Create a savings goal"],
                  ["GET",  "/v1/budgeting/goals/:id/progress",             "Goal progress + milestones"],
                  ["GET",  "/v1/budgeting/insights?lang=en|fr|pid",        "Proactive AI tip"],
                  ["POST", "/v1/budgeting/insights/ask",                   "Ask the adviser a question"],
                  ["GET",  "/v1/budgeting/analytics/merchants",            "Top merchants for the period"],
                  ["GET",  "/v1/budgeting/analytics/monthly",              "Spend by month for charts"],
                  ["GET",  "/v1/budgeting/njangi/schedule",                "Upcoming Njangi contributions"],
                ].map(([m, p, d]) => (
                  <tr key={p} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{m}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Quickstart — create a budget</h2>
          <CodeBlock examples={[{
            language="bash"
            code: `curl -X POST https://api.kangopenbanking.com/v1/budgeting/budgets \\
  -H "Authorization: Bearer $KOB_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "March Budget",
    "period": "monthly",
    "total_limit": 250000,
    "categories": [
      { "id": "cat_food",      "limit": 90000 },
      { "id": "cat_transport", "limit": 45000 },
      { "id": "cat_utilities", "limit": 25000 },
      { "id": "cat_savings",   "limit": 25000 }
    ]
  }'`}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Ask the AI Adviser (Node.js)</h2>
          <CodeBlock examples={[{
            language="javascript"
            code: `import fetch from "node-fetch";

const r = await fetch("https://api.kangopenbanking.com/v1/budgeting/insights/ask", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.KOB_TOKEN}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    lang: "pid",
    question: "How I fit save 50000 XAF this month?"
  })
});
const { answer, confidence } = await r.json();
console.log(answer);`}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Ask the AI Adviser (Python)</h2>
          <CodeBlock examples={[{
            language="python"
            code: `import os, requests

r = requests.post(
    "https://api.kangopenbanking.com/v1/budgeting/insights/ask",
    headers={"Authorization": f"Bearer {os.environ['KOB_TOKEN']}"},
    json={"lang": "fr", "question": "Comment réduire mes dépenses de transport ?"},
    timeout=30,
)
print(r.json()["answer"])`}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Webhook events</h2>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><code>budget.threshold_reached</code> — a category passed 60/80/100%</li>
            <li><code>budget.overspent</code> — a category went over its limit</li>
            <li><code>goal.milestone_reached</code> — 25/50/75/100%</li>
            <li><code>njangi.contribution_due</code> — reminder before due date</li>
            <li><code>budget.unusual_transaction</code> — risk-flagged spend</li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
