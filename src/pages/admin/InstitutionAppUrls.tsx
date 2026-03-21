import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SearchFilter } from '@/components/SearchFilter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Check, Link2, Link} from "lucide-react";
import { toast } from 'sonner';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

const BASE_URL = 'https://kangopenbanking.com';

const InstitutionAppUrls: React.FC = () => {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: institutions, isLoading } = useQuery({
    queryKey: ['institutions-app-urls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, institution_name, institution_type, status, logo_url, primary_color')
        .order('institution_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = institutions?.filter((inst) =>
    inst.institution_name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const copyUrl = async (id: string) => {
    const url = `${BASE_URL}/bank/${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'default';
      case 'pending': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Link} title="Institution App URLs" description="Manage institution-specific application URLs and endpoints" />

      <SearchFilter
        searchTerm={search}
        onSearchChange={setSearch}
        placeholder="Search institutions..."
      />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Institution</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>PWA URL</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading institutions…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No institutions found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inst) => {
                const pwaUrl = `${BASE_URL}/bank/${inst.id}`;
                return (
                  <TableRow key={inst.id}>
                    <TableCell>
                      {inst.logo_url ? (
                        <img
                          src={inst.logo_url}
                          alt={inst.institution_name}
                          className="h-8 w-8 rounded-md object-contain"
                        />
                      ) : (
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary"
                          style={inst.primary_color ? { backgroundColor: inst.primary_color + '22', color: inst.primary_color } : undefined}
                        >
                          {inst.institution_name.charAt(0)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{inst.institution_name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{inst.institution_type ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(inst.status)}>{inst.status ?? 'unknown'}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs text-foreground break-all">
                        {pwaUrl}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => copyUrl(inst.id)} title="Copy URL">
                          {copiedId === inst.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon" asChild title="Open PWA">
                          <a href={pwaUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-3">
          <img src="/kfs-logo.png" alt="Kang" className="h-8 w-8 rounded-md object-contain" />
          <div>
            <p className="text-sm font-semibold text-foreground">Kang Consumer App</p>
            <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">https://kangopenbanking.com/app</code>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="icon" onClick={async () => { await navigator.clipboard.writeText('https://kangopenbanking.com/app'); toast.success('Kang app URL copied'); }} title="Copy URL">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" asChild title="Open Kang App">
              <a href="https://kangopenbanking.com/app" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-3">
          <img src="/kob-logo.png" alt="KOB Business" className="h-8 w-8 rounded-md object-contain" />
          <div>
            <p className="text-sm font-semibold text-foreground">KOB Business App</p>
            <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">https://kangopenbanking.com/biz</code>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="icon" onClick={async () => { await navigator.clipboard.writeText('https://kangopenbanking.com/biz'); toast.success('Business app URL copied'); }} title="Copy URL">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" asChild title="Open Business App">
              <a href="https://kangopenbanking.com/biz" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} institution{filtered.length !== 1 ? 's' : ''}. Each URL launches the institution-branded PWA onboarding flow.
      </p>
    </div>
  );
};

export default InstitutionAppUrls;
