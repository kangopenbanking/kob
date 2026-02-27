import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, Eye, Send, Download, Plus, ArrowUpRight, ArrowDownLeft, ShoppingBag } from 'lucide-react';
import { useCustomerTenant } from '@/components/customer-app/CustomerTenantProvider';

const quickActions = [
  { label: 'Send', icon: Send, path: 'transfer', color: 'bg-[hsl(210,80%,93%)]' },
  { label: 'Receive', icon: Download, path: 'request', color: 'bg-[hsl(150,40%,90%)]' },
  { label: 'Add', icon: Plus, path: 'bank', color: 'bg-[hsl(25,80%,92%)]' },
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

      {/* Balance Card */}
      <div className="rounded-3xl bg-[hsl(225,50%,22%)] p-6">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-[hsl(0,0%,100%)]/60">Total Balance</p>
          <Eye className="h-4 w-4 text-[hsl(0,0%,100%)]/60" strokeWidth={1.5} />
        </div>
        <p className="mt-2 text-3xl font-bold text-[hsl(0,0%,100%)]">
          XAF 485,000
        </p>
        <p className="mt-1 text-xs text-[hsl(150,60%,65%)]">
          + 12,500 today
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-center gap-6">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(`/app/${institutionId}/${action.path}`)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${action.color}`}>
              <action.icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
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
      </div>
    </div>
  );
};

export default CustomerHome;
