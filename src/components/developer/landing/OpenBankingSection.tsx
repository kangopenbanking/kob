import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Zap, ArrowRight } from "lucide-react";

export function OpenBankingSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Open Banking APIs</h2>
        <p className="text-muted-foreground max-w-2xl">
          PSD2-inspired account access and payment initiation for the CEMAC region.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Account Information (AISP)</CardTitle>
                <CardDescription>Consent-based access to accounts, balances & transaction history</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/developer/api/aisp">
              <Button variant="outline" size="sm">
                AISP Docs <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Payment Initiation (PISP)</CardTitle>
                <CardDescription>Initiate domestic & cross-border payments from bank accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/developer/api/pisp">
              <Button variant="outline" size="sm">
                PISP Docs <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
