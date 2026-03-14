import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Users, Key } from 'lucide-react';

const ROLE_CATEGORIES = [
  {
    category: 'Platform',
    roles: [
      { role: 'admin', scope: 'Global', desc: 'Full platform access — manage all entities, users, compliance' },
      { role: 'moderator', scope: 'Global', desc: 'Content moderation and marketplace oversight' },
    ]
  },
  {
    category: 'Institution',
    roles: [
      { role: 'institution (owner)', scope: 'Institution', desc: 'Full institution management — team, settings, API clients' },
      { role: 'staff', scope: 'Institution', desc: 'FI Portal access — customer management, transactions, reporting' },
    ]
  },
  {
    category: 'Merchant',
    roles: [
      { role: 'merchant (owner)', scope: 'Merchant', desc: 'Full merchant management — payments, payouts, API keys' },
      { role: 'merchant_staff', scope: 'Merchant', desc: 'Limited access — POS, counter booking, transactions' },
    ]
  },
  {
    category: 'Developer',
    roles: [
      { role: 'developer', scope: 'Developer Org', desc: 'API integration — sandbox/production apps, webhook config' },
      { role: 'tpp', scope: 'Developer Org', desc: 'Third-party provider — AISP/PISP consent management' },
    ]
  },
  {
    category: 'Personal',
    roles: [
      { role: 'personal', scope: 'User', desc: 'Personal banking — transfers, payments, credit score' },
    ]
  }
];

export default function RolesPermissions() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Roles & Permissions</h1>
        <p className="text-muted-foreground mt-2">RBAC model enforced across all platform APIs and portals</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> RBAC Architecture</CardTitle>
          <CardDescription>Role-based access control with entity-scoped memberships</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>The platform uses a two-layer permission model:</p>
            <ul className="space-y-1 ml-4">
              <li>1. <strong>System Roles</strong> — Global roles stored in <code>user_roles</code> (admin, personal, merchant, etc.)</li>
              <li>2. <strong>Entity Memberships</strong> — Scoped roles stored in <code>identity_memberships</code> (owner, manager, viewer per entity)</li>
            </ul>
            <p className="mt-2">Permission checks use <code>has_role()</code> and <code>has_permission()</code> SECURITY DEFINER functions to prevent RLS bypass.</p>
          </div>
        </CardContent>
      </Card>

      {ROLE_CATEGORIES.map((cat) => (
        <Card key={cat.category}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {cat.category} Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cat.roles.map((r) => (
                  <TableRow key={r.role}>
                    <TableCell><Badge variant="outline" className="font-mono">{r.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.scope}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.desc}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Permission Scopes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              'accounts.read', 'accounts.write', 'transactions.read', 'transactions.write',
              'payments.initiate', 'payments.approve', 'consents.manage', 'api_keys.manage',
              'webhooks.manage', 'team.manage', 'settlement.configure', 'reports.view'
            ].map((scope) => (
              <div key={scope} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                <code className="text-xs font-mono text-primary">{scope}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
