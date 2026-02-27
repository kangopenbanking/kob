import React from 'react';
import { Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CustomerAppManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer App Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure and manage customer-facing mobile applications
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Customer App Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <Smartphone className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">
              Full admin management panel coming in Step 8
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerAppManagement;
