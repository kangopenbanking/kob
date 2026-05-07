// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P9)
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, ArrowRight } from "lucide-react";

const LANGUAGES = [
  { slug: "typescript", name: "TypeScript / Node.js", desc: "npm package, ESM and CJS." },
  { slug: "python",     name: "Python",               desc: "PyPI package, sync and async." },
  { slug: "php",        name: "PHP / Laravel",        desc: "Composer package, Laravel facade." },
  { slug: "java",       name: "Java",                 desc: "Maven artifact, Spring Boot ready." },
  { slug: "go",         name: "Go",                   desc: "Go module with generics." },
  { slug: "ruby",       name: "Ruby / Rails",         desc: "Ruby gem, Rails-friendly." },
];

export default function SdkExamplesHub() {
  return (
    <div className="container max-w-5xl py-10 space-y-8">
      <Helmet>
        <title>SDK Examples — Kang Open Banking</title>
        <meta name="description" content="Copy-paste SDK examples for the Kang Open Banking API in TypeScript, Python, PHP, Java, Go and Ruby." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sdk-examples" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">SDK Examples</h1>
        <p className="text-muted-foreground max-w-2xl">
          Pick your language. Every example targets the public sandbox and runs against the test credentials at{" "}
          <Link to="/developer/sandbox" className="text-primary underline">/developer/sandbox</Link>.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LANGUAGES.map((l) => (
          <Card key={l.slug} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{l.name}</CardTitle>
              </div>
              <CardDescription>{l.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <a
                href={`/docs/public/sdk-examples/${l.slug}.md`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View examples <ArrowRight className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Each example covers</h2>
        <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
          <li>OAuth2 client credentials initialisation</li>
          <li>Charge creation with <code>Idempotency-Key</code></li>
          <li>Exponential backoff retry honouring <code>Retry-After</code></li>
          <li>Webhook signature verification (HMAC-SHA256, 5-minute window)</li>
        </ul>
      </section>
    </div>
  );
}
