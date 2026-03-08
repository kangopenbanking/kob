import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, ShoppingBag, Clock } from 'lucide-react';

const BusinessHome: React.FC = () => {
  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Welcome to your business dashboard.</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available</p>
              <p className="text-xl font-bold">XAF 0</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md">
          <CardContent className="p-4 space-y-2">
            <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary-foreground">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">XAF 0</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4">
          <button className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-2xl gap-2 hover:bg-muted/50 transition-colors">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">New Order</span>
          </button>
          <button className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-2xl gap-2 hover:bg-muted/50 transition-colors">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessHome;
