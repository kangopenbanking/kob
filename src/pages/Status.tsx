import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

export default function Status() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">System Status</h1>
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div>
            <h2 className="text-2xl font-semibold">All Systems Operational</h2>
            <p className="text-sm text-muted-foreground">Last updated: Just now</p>
          </div>
        </div>
      </Card>
      <div className="space-y-3">
        <Card className="p-4 flex justify-between items-center">
          <span className="font-medium">API Services</span>
          <Badge className="bg-green-500">Operational</Badge>
        </Card>
        <Card className="p-4 flex justify-between items-center">
          <span className="font-medium">Authentication</span>
          <Badge className="bg-green-500">Operational</Badge>
        </Card>
        <Card className="p-4 flex justify-between items-center">
          <span className="font-medium">Webhooks</span>
          <Badge className="bg-green-500">Operational</Badge>
        </Card>
      </div>
    </div>
  );
}