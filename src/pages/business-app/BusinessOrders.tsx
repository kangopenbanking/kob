import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

const BusinessOrders: React.FC = () => {
  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Manage your recent orders</p>
      </header>

      <Card className="border-0 shadow-md">
        <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Order management coming in Sprint 4
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessOrders;
