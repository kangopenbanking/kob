import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

const ACTION_OPTIONS = [
  'all', 'claim', 'release', 'transfer', 'escalate', 'note',
  'assignment_change', 'status_change', 'priority_change',
  'sla_warning', 'sla_breach',
];

interface Props {
  conversationId?: string;
  conversationLabel?: string;
}

export const AuditLogExportDialog: React.FC<Props> = ({ conversationId, conversationLabel }) => {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('all');
  const [busy, setBusy] = useState(false);

  const fetchRows = async () => {
    let q: any = (supabase.from('support_audit_logs' as any) as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(5000);
    if (action !== 'all') q = q.eq('action', action);
    if (from) q = q.gte('created_at', new Date(from).toISOString());
    if (to) q = q.lte('created_at', new Date(to).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    return (data as any[]) || [];
  };

  const downloadCsv = async () => {
    if (!conversationId) return;
    setBusy(true);
    try {
      const rows = await fetchRows();
      if (rows.length === 0) {
        toast({ title: 'Nothing to export', description: 'No audit entries match the selected filters.' });
        return;
      }
      const headers = ['created_at', 'action', 'actor_type', 'actor_id', 'details'];
      const escape = (v: any) => {
        const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${conversationId.slice(0, 8)}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'CSV exported', description: `${rows.length} entries downloaded.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!conversationId) return;
    setBusy(true);
    try {
      const rows = await fetchRows();
      if (rows.length === 0) {
        toast({ title: 'Nothing to export', description: 'No audit entries match the selected filters.' });
        return;
      }
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 15;
      let y = margin;
      doc.setFontSize(14);
      doc.text('Support Chat Audit Log', margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(`Conversation: ${conversationLabel || conversationId}`, margin, y);
      y += 4;
      const filterLine = `Filters — Action: ${action} | From: ${from || 'any'} | To: ${to || 'any'} | Generated: ${new Date().toLocaleString()}`;
      doc.text(filterLine, margin, y);
      y += 6;
      doc.setDrawColor(200);
      doc.line(margin, y, 210 - margin, y);
      y += 4;
      doc.setTextColor(0);
      doc.setFontSize(9);

      rows.forEach((r) => {
        if (y > 280) { doc.addPage(); y = margin; }
        const ts = new Date(r.created_at).toLocaleString();
        doc.setFont(undefined, 'bold');
        doc.text(`${ts}  ·  ${r.action}`, margin, y);
        y += 4;
        doc.setFont(undefined, 'normal');
        doc.setTextColor(90);
        doc.text(`Actor: ${r.actor_type}${r.actor_id ? ` (${String(r.actor_id).slice(0, 8)})` : ''}`, margin, y);
        y += 4;
        if (r.details && Object.keys(r.details).length > 0) {
          const detailsText = Object.entries(r.details)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' · ');
          const lines = doc.splitTextToSize(detailsText, 210 - margin * 2);
          doc.text(lines, margin, y);
          y += lines.length * 4;
        }
        doc.setTextColor(0);
        y += 2;
      });
      doc.save(`audit-${conversationId.slice(0, 8)}-${Date.now()}.pdf`);
      toast({ title: 'PDF exported', description: `${rows.length} entries downloaded.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!conversationId}>
          <Download className="mr-2 h-4 w-4" />
          Export audit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export audit log</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Action type</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a === 'all' ? 'All actions' : a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={downloadCsv} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              CSV
            </Button>
            <Button onClick={downloadPdf} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
