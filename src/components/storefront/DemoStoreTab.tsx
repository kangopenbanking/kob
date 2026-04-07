import React, { useState } from 'react';
import { Sparkles, Trash2, Loader2, Package, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface DemoStoreTabProps {
  merchantId: string | null;
  onDataChanged?: () => void;
}

export function DemoStoreTab({ merchantId, onDataChanged }: DemoStoreTabProps) {
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleCreate = async () => {
    if (!merchantId) return;
    setCreating(true);
    setLastResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-demo-store`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'create', merchant_id: merchantId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setLastResult({ type: 'created', ...result });
      toast.success('Demo store created with sample products!');
      onDataChanged?.();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to create demo store'));
    } finally {
      setCreating(false);
    }
  };

  const handleReset = async () => {
    if (!merchantId) return;
    setResetting(true);
    setLastResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-demo-store`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'reset', merchant_id: merchantId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setLastResult({ type: 'reset', ...result });
      toast.success('All POS demo data has been reset');
      onDataChanged?.();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to reset demo data'));
    } finally {
      setResetting(false);
    }
  };

  if (!merchantId) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No merchant account found. Register as a merchant first.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      {/* Create Demo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">Create Demo Store</CardTitle>
              <CardDescription className="text-xs">Populate with 10 sample products, categories & inventory</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>This will create:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>3 categories</strong> — Food & Beverages, Electronics, Fashion</li>
              <li><strong>10 products</strong> with multiple variants and XAF pricing</li>
              <li><strong>Stock inventory</strong> seeded (10–50 units per variant)</li>
              <li><strong>Default location</strong> (Douala) if none exists</li>
              <li><strong>Store profile</strong> if none exists</li>
            </ul>
          </div>
          <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            {creating ? 'Creating...' : 'Create Demo Store'}
          </Button>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-sm">Reset POS Data</CardTitle>
              <CardDescription className="text-xs">Remove ALL products, orders, inventory & cart data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 text-destructive font-medium">
              <AlertTriangle className="w-3 h-3" /> This action is irreversible
            </p>
            <p>Deletes in correct FK order:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>All inventory movements & stock levels</li>
              <li>All orders, payments, returns, refund records</li>
              <li>All consumer carts & items</li>
              <li>All products, variants, images, category links</li>
              <li>All categories & integration mappings</li>
            </ul>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full gap-2" disabled={resetting}>
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {resetting ? 'Resetting...' : 'Reset All POS Data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all POS data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL products, orders, inventory, carts, and related data for this merchant. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Result */}
      {lastResult && (
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              )}
              <span className="text-sm font-medium">{lastResult.message}</span>
              <Badge variant="outline" className="text-xs ml-auto">
                {lastResult.type === 'created' ? 'Created' : 'Reset'}
              </Badge>
            </div>
            {lastResult.stats && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Categories: <strong>{lastResult.stats.categories}</strong></span>
                <span>Products: <strong>{lastResult.stats.products}</strong></span>
                <span>Variants: <strong>{lastResult.stats.variants}</strong></span>
                <span>Inventory: <strong>{lastResult.stats.inventory_items}</strong></span>
              </div>
            )}
            {lastResult.deleted && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Products deleted: <strong>{lastResult.deleted.products}</strong></span>
                <span>Orders deleted: <strong>{lastResult.deleted.orders}</strong></span>
                <span>Carts deleted: <strong>{lastResult.deleted.carts}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
