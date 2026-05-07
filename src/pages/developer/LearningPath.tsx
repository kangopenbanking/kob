// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6)
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

const STEPS = [
  { to: "/developer/quick-start",            title: "1. Quickstart",     mins: "2 min", desc: "Register and grab your sandbox credentials." },
  { to: "/developer/authentication/oauth2",  title: "2. Authentication", mins: "5 min", desc: "OAuth2 client credentials, scopes, and refresh tokens." },
  { to: "/developer/guides/first-charge",    title: "3. First charge",   mins: "5 min", desc: "Create a mobile-money charge end-to-end." },
  { to: "/developer/api/error-codes",        title: "4. Errors",         mins: "10 min", desc: "RFC 7807 problem details and the full error catalog." },
  { to: "/developer/api/rate-limits",        title: "5. Rate limits",    mins: "5 min", desc: "Quotas, headers, and backoff." },
  { to: "/developer/api/idempotency",        title: "6. Idempotency",    mins: "5 min", desc: "Safe retries for payments." },
];

export default function LearningPath() {
  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <Helmet>
        <title>Learning Path — Kang Open Banking</title>
        <meta name="description" content="Six-step developer learning path from registration to production-ready integration." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/learn" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Developer Learning Path</h1>
        <p className="text-muted-foreground">
          From zero to a production-ready integration in about 30 minutes. Follow the steps in order.
        </p>
      </header>

      <ol className="space-y-4">
        {STEPS.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{s.title}</CardTitle>
                    <CardDescription>{s.desc}</CardDescription>
                  </div>
                  <Badge variant="outline">{s.mins}</Badge>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="pt-6 flex items-start gap-3 text-sm">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
          <p className="text-muted-foreground">
            Done with the path? Browse{" "}
            <Link to="/developer/sdk-examples" className="text-primary underline">SDK examples</Link>{" "}
            in your language, or jump into the{" "}
            <Link to="/developer/api-explorer" className="text-primary underline">API explorer</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
