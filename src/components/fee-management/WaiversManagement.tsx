import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface WaiversManagementProps {
  institutions: any[];
  onRefresh: () => void;
}

export function WaiversManagement({ institutions }: WaiversManagementProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Fee Waivers & Discounts</CardTitle>
            <CardDescription>Manage promotional discounts and exceptions for institutions</CardDescription>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Waiver
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">
          No active waivers. Create promotional discounts, fixed discounts, or full fee waivers for specific institutions and transaction types.
        </p>
      </CardContent>
    </Card>
  );
}
