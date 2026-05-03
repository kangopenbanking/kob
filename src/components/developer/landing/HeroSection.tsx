import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function HeroSection() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-8 md:p-12 lg:p-16">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 max-w-3xl space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Developer Platform · v4.28.2
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Build the future of finance in <span className="text-primary">Cameroon</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
          One unified API for accounts, payments, mobile money, and credit scoring. Test instantly in our free sandbox — no credit card required.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link to="/developer/getting-started">
            <Button size="lg" className="text-base px-6">
              Get API Keys <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/developer/console">
            <Button size="lg" variant="outline" className="text-base px-6">
              <Play className="mr-2 h-4 w-4" /> Try the Console
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Free sandbox · OpenAPI 3.1 · SDKs in 6 languages · 99.9% uptime SLA
        </p>
      </div>
    </div>
  );
}
