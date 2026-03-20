import React, { useState, useEffect } from 'react';
import { Store, Crown, Plus, Edit2, Trash2, Eye, EyeOff, Loader2, Save, Search, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export default function AdminMarketplace() {
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Plan form
  const [planDialog, setPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('30');
  const [planFeatures, setPlanFeatures] = useState('');
  const [planActive, setPlanActive] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [plansRes, subsRes, storesRes] = await Promise.all([
        supabase.from('pos_subscription_plans').select('*').order('price'),
        supabase.from('pos_store_subscriptions').select('*, pos_subscription_plans(name, price), pos_store_profiles!pos_store_subscriptions_merchant_id_fkey(store_name, is_published, status)').order('created_at', { ascending: false }),
        supabase.from('pos_store_profiles').select('*').order('created_at', { ascending: false }),
      ]);
      setPlans(plansRes.data || []);
      setSubscriptions(subsRes.data || []);
      setStores(storesRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openPlanForm = (plan?: any) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanName(plan.name);
      setPlanPrice(String(plan.price));
      setPlanDuration(String(plan.duration_days));
      setPlanFeatures(Array.isArray(plan.features_json) ? plan.features_json.join('\n') : '');
      setPlanActive(plan.is_active);
    } else {
      setEditingPlan(null);
      setPlanName(''); setPlanPrice(''); setPlanDuration('30'); setPlanFeatures(''); setPlanActive(true);
    }
    setPlanDialog(true);
  };

  const savePlan = async () => {
    setSavingPlan(true);
    try {
      const payload = {
        name: planName,
        price: Number(planPrice),
        currency: 'XAF',
        duration_days: Number(planDuration),
        features_json: planFeatures.split('\n').filter(Boolean),
        is_active: planActive,
      };
      if (editingPlan) {
        await supabase.from('pos_subscription_plans').update(payload).eq('id', editingPlan.id);
      } else {
        await supabase.from('pos_subscription_plans').insert(payload);
      }
      toast.success(editingPlan ? 'Plan updated' : 'Plan created');
      setPlanDialog(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Delete this plan?')) return;
    await supabase.from('pos_subscription_plans').delete().eq('id', planId);
    toast.success('Plan deleted');
    loadAll();
  };

  const toggleStoreVisibility = async (storeId: string, currentPublished: boolean) => {
    await supabase.from('pos_store_profiles').update({ is_published: !currentPublished }).eq('id', storeId);
    toast.success(`Store ${!currentPublished ? 'published' : 'hidden'}`);
    loadAll();
  };

  const filteredStores = stores.filter(s =>
    !search || s.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    totalPlans: plans.length,
    activeSubs: subscriptions.filter(s => s.status === 'active').length,
    publishedStores: stores.filter(s => s.is_published).length,
    totalStores: stores.length,
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Store} title="Marketplace Management" description="Manage subscription plans, merchant subscriptions, and store visibility" />


      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Subscription Plans', value: stats.totalPlans, icon: Crown, color: 'text-amber-500' },
          { label: 'Active Subscriptions', value: stats.activeSubs, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Published Stores', value: stats.publishedStores, icon: Eye, color: 'text-primary' },
          { label: 'Total Stores', value: stats.totalStores, icon: Store, color: 'text-muted-foreground' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value}</p>
                </div>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="subscriptions">Merchant Subscriptions</TabsTrigger>
          <TabsTrigger value="stores">Store Visibility</TabsTrigger>
        </TabsList>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Manage marketplace listing plans for merchants</CardDescription>
              </div>
              <Button onClick={() => openPlanForm()} className="gap-2">
                <Plus className="w-4 h-4" /> Add Plan
              </Button>
            </CardHeader>
            <CardContent>
              {plans.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No plans yet. Create your first plan.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map(plan => (
                    <Card key={plan.id} className="relative">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold">{plan.name}</h3>
                            <p className="text-2xl font-extrabold text-primary mt-1">{plan.price?.toLocaleString()} XAF</p>
                            <p className="text-xs text-muted-foreground">{plan.duration_days} days</p>
                          </div>
                          <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {plan.features_json && Array.isArray(plan.features_json) && (
                          <ul className="mt-3 space-y-1">
                            {plan.features_json.map((f: string, i: number) => (
                              <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CheckCircle2 className="w-3 h-3 text-primary" />{f}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" variant="outline" onClick={() => openPlanForm(plan)} className="gap-1">
                            <Edit2 className="w-3 h-3" /> Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={() => deletePlan(plan.id)}>
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Merchant Subscriptions</CardTitle>
              <CardDescription>View all merchant marketplace subscriptions</CardDescription>
            </CardHeader>
            <CardContent>
             <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Store Published</TableHead>
                    <TableHead>Starts</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscriptions yet</TableCell>
                    </TableRow>
                  ) : subscriptions.map(sub => {
                    const isExpired = new Date(sub.expires_at) < new Date();
                    const storeProfile = sub.pos_store_profiles;
                    return (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium text-sm">
                          {storeProfile?.store_name || (
                            <span className="text-muted-foreground italic text-xs">No store profile</span>
                          )}
                        </TableCell>
                        <TableCell>{sub.pos_subscription_plans?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={isExpired ? 'destructive' : sub.status === 'active' ? 'default' : 'secondary'}>
                            {isExpired ? 'Expired' : sub.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {storeProfile ? (
                            <Badge variant={storeProfile.is_published ? 'default' : 'secondary'}>
                              {storeProfile.is_published ? 'Yes' : 'No'}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{new Date(sub.starts_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">
                          <span className={isExpired ? 'text-destructive font-medium' : ''}>
                            {new Date(sub.expires_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stores Tab */}
        <TabsContent value="stores">
          <Card>
            <CardHeader>
              <CardTitle>Store Visibility</CardTitle>
              <CardDescription>Override store visibility on the consumer marketplace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search stores..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No stores found</TableCell>
                    </TableRow>
                  ) : filteredStores.map(store => (
                    <TableRow key={store.id}>
                      <TableCell className="font-medium">{store.store_name}</TableCell>
                      <TableCell>{store.category || '—'}</TableCell>
                      <TableCell>{store.city || '—'}</TableCell>
                      <TableCell>{store.rating?.toFixed(1) || '0.0'}</TableCell>
                      <TableCell>
                        <Badge variant={store.is_published ? 'default' : 'secondary'}>
                          {store.is_published ? 'Published' : 'Hidden'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => toggleStoreVisibility(store.id, store.is_published)}>
                          {store.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Plan Form Dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Plan' : 'New Subscription Plan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Plan Name *</Label>
              <Input value={planName} onChange={e => setPlanName(e.target.value)} placeholder="e.g. Basic, Pro, Premium" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (XAF) *</Label>
                <Input type="number" value={planPrice} onChange={e => setPlanPrice(e.target.value)} placeholder="5000" />
              </div>
              <div>
                <Label>Duration (days) *</Label>
                <Input type="number" value={planDuration} onChange={e => setPlanDuration(e.target.value)} placeholder="30" />
              </div>
            </div>
            <div>
              <Label>Features (one per line)</Label>
              <textarea
                className="w-full h-24 text-sm border rounded-lg p-2 bg-background"
                value={planFeatures}
                onChange={e => setPlanFeatures(e.target.value)}
                placeholder="Marketplace listing&#10;QR payments&#10;Consumer app visibility"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={planActive} onCheckedChange={setPlanActive} />
              <Label>Active</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
              <Button onClick={savePlan} disabled={savingPlan || !planName || !planPrice}>
                {savingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingPlan ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
