import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, Eye, Send, Download, Plus, ArrowUpRight, ArrowDownLeft, ShoppingBag, Lock } from 'lucide-react';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

const quickActions = [
  { label: 'Send', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]', requiresAccount: true },
  { label: 'Receive', icon: Download, path: 'request', color: 'bg-[hsl(150,40%,90%)]', requiresAccount: true },
  { label: 'Add', icon: Plus, path: 'bank', color: 'bg-[hsl(25,80%,92%)]', requiresAccount: false },
];

const recentActivities = [
  { name: 'Grocery Store', type: 'Shopping', amount: -12500, icon: ShoppingBag, color: 'bg-[hsl(25,80%,92%)]' },
  { name: 'Salary Deposit', type: 'Income', amount: 350000, icon: ArrowDownLeft, color: 'bg-[hsl(150,40%,90%)]' },
  { name: 'Transfer to John', type: 'Transfer', amount: -25000, icon: ArrowUpRight, color: 'bg-[hsl(210,80%,93%)]' },
];

const CustomerHome: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const tenant = useCustomerTenant();
  const { user } = useCustomerAuth();

  const isViewOnly = user?.isViewOnly ?? false;

  const handleAction = (path: string, requiresAccount: boolean) => {
    if (requiresAccount && isViewOnly) {
      navigate(`/app/${institutionId}/onboarding`);
      return;
    }
    navigate(`/app/${institutionId}/${path}`);
  };

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Welcome back</p>
          <h1 className="text-lg font-bold text-foreground">{tenant.name}</h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
          <Bell className="h-5 w-5 text-foreground" strokeWidth={1.5} />
        </button>
      </div>

      {/* View-Only Banner */}
      {isViewOnly && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-[hsl(50,80%,90%)] p-3">
          <Lock className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          <div className="flex-1">
            <p className="text-xs font-semibold text-foreground">View-Only Mode</p>
            <p className="text-[11px] text-muted-foreground">Link an account to unlock transactions</p>
          </div>
          <button
            onClick={() => navigate(`/app/${institutionId}/onboarding`)}
            className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Link
          </button>
        </div>
      )}

      {/* Balance Card */}
      <div className="rounded-3xl bg-[hsl(225,50%,22%)] p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Total Balance</p>
          <Eye className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
        </div>
        <p className="mt-2 text-3xl font-bold text-[hsl(0,0%,100%)]">
          {isViewOnly ? '---' : 'XAF 485,000'}
        </p>
        {!isViewOnly && (
          <p className="mt-1 text-xs text-[hsl(150,60%,65%)]">+ 12,500 today</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-center gap-6">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => handleAction(action.path, action.requiresAccount)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
              <action.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              {action.requiresAccount && isViewOnly && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/80">
                  <Lock className="h-3 w-3 text-background" strokeWidth={2} />
                </div>
              )}
            </div>
            <span className="text-xs font-semibold text-foreground">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Recent Activities */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent Activities
          </p>
          <button
            onClick={() => navigate(`/app/${institutionId}/activity`)}
            className="text-xs font-semibold text-primary"
          >
            See All
          </button>
        </div>
        {isViewOnly ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-border p-8">
            <Lock className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground">Link an account to see activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((item, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.color}`}>
                  <item.icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.type}</p>
                </div>
                <p className={`text-sm font-bold ${item.amount > 0 ? 'text-[hsl(150,60%,40%)]' : 'text-foreground'}`}>
                  {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()} XAF
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerHome;
