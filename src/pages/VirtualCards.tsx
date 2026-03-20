import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VirtualCards = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Virtual Cards</h1>
        <p className="text-muted-foreground mt-1">
          USD virtual cards for online purchases worldwide.
        </p>
      </div>

      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <CreditCard className="h-10 w-10 text-primary" />
          </div>
          <Badge variant="secondary" className="mb-4 text-xs font-semibold">
            Coming Soon
          </Badge>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Virtual Cards — Coming Soon
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mb-8">
            USD virtual cards for online purchases worldwide. This feature is currently under development and will be available soon.
          </p>
          <Button variant="outline" className="rounded-full" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default VirtualCards;
