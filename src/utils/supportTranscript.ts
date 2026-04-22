// Export a Live Support conversation transcript as a downloadable PDF.
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptOptions {
  conversationId: string;
  subject?: string;
  departmentName?: string;
  createdAt?: string;
  /** Optional: last activity timestamp, used in filename + header date range. */
  updatedAt?: string;
  /** Optional: SLA target (minutes) included in the header for context. */
  slaTargetMinutes?: number;
  /** Optional: First-response timestamp included in the header. */
  firstResponseAt?: string | null;
}

/** Strip diacritics & non-filename-safe characters. */
function safeSlug(input: string, max = 40): string {
  return (input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, max) || 'support';
}

export async function exportConversationToPdf(opts: TranscriptOptions): Promise<void> {
  const { data: messages, error } = await supabase
    .from('support_messages')
    .select('id, sender_type, content, file_url, file_type, created_at')
    .eq('conversation_id', opts.conversationId)
    .order('created_at', { ascending: true }) as any;

  if (error) throw error;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kang — Support Transcript', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Subject: ${opts.subject || 'Support chat'}`, margin, y); y += 14;
  if (opts.departmentName) { doc.text(`Department: ${opts.departmentName}`, margin, y); y += 14; }
  doc.text(`Conversation ID: ${opts.conversationId}`, margin, y); y += 14;

  // Date range (started → last activity)
  const started = opts.createdAt ? format(new Date(opts.createdAt), 'PPpp') : '—';
  const lastActivity = opts.updatedAt ? format(new Date(opts.updatedAt), 'PPpp') : started;
  doc.text(`Date range: ${started}  →  ${lastActivity}`, margin, y); y += 14;

  if (opts.slaTargetMinutes) {
    const slaLine = opts.firstResponseAt
      ? `SLA target: ${opts.slaTargetMinutes} min · First response: ${format(new Date(opts.firstResponseAt), 'PPpp')}`
      : `SLA target: ${opts.slaTargetMinutes} min · First response: pending`;
    doc.text(slaLine, margin, y); y += 14;
  }

  // Attachments summary (collected before rendering body)
  const attachments = (messages || []).filter((m: any) => m.file_url) as any[];
  doc.text(`Messages: ${(messages || []).length}  ·  Attachments: ${attachments.length}`, margin, y); y += 14;
  doc.text(`Exported: ${format(new Date(), 'PPpp')}`, margin, y); y += 18;

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y); y += 16;

  doc.setTextColor(20);
  doc.setFontSize(10);

  for (const msg of messages || []) {
    const sender =
      msg.sender_type === 'user' ? 'Customer' :
      msg.sender_type === 'agent' ? 'Support agent' : 'System';
    const time = format(new Date(msg.created_at), 'PP HH:mm');

    doc.setFont('helvetica', 'bold');
    const header = `${sender}  ·  ${time}`;
    doc.text(header, margin, y);
    y += 14;

    doc.setFont('helvetica', 'normal');
    const body = msg.content || (msg.file_url ? `[attachment: ${msg.file_type || 'file'}]` : '(empty)');
    const lines = doc.splitTextToSize(body, maxWidth);
    for (const line of lines) {
      if (y > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 13;
    }

    // If the message also has an attachment alongside text, list it explicitly
    if (msg.file_url && msg.content) {
      const attachLine = `↳ Attachment: ${msg.file_type || 'file'} · ${msg.file_url}`;
      const wrapped = doc.splitTextToSize(attachLine, maxWidth);
      doc.setTextColor(110);
      for (const line of wrapped) {
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 12;
      }
      doc.setTextColor(20);
    }

    y += 8;
    if (y > pageHeight - margin) { doc.addPage(); y = margin; }
  }

  // Attachment index appendix — enriched with storage metadata for auditing
  if (attachments.length) {
    if (y > pageHeight - margin - 80) { doc.addPage(); y = margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Attachments', margin, y); y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text('Uploader identity is the first folder segment of the storage path (user UUID or guest_<id>).', margin, y);
    y += 14;
    doc.setFontSize(9);

    // Resolve per-file metadata in parallel from storage.objects
    const enriched = await Promise.all(attachments.map(async (m) => {
      const path: string = m.file_url || '';
      const slash = path.indexOf('/');
      const folder = slash > 0 ? path.slice(0, slash) : '';
      const filename = slash > 0 ? path.slice(slash + 1) : path;
      let sizeBytes: number | undefined;
      let mimeType: string | undefined = m.file_type || undefined;
      let lastModified: string | undefined;
      try {
        const { data } = await supabase.storage
          .from('support-attachments')
          .list(folder, { search: filename, limit: 1 }) as any;
        const obj = (data || [])[0];
        if (obj) {
          sizeBytes = obj.metadata?.size ?? obj?.size;
          mimeType = obj.metadata?.mimetype || obj.metadata?.contentType || mimeType;
          lastModified = obj.updated_at || obj.created_at;
        }
      } catch { /* best-effort — leave fields undefined */ }
      return { msg: m, path, folder, filename, sizeBytes, mimeType, lastModified };
    }));

    enriched.forEach((a, idx) => {
      const time = format(new Date(a.msg.created_at), 'PP HH:mm');
      const sizeLabel = a.sizeBytes != null
        ? a.sizeBytes < 1024
          ? `${a.sizeBytes} B`
          : a.sizeBytes < 1024 * 1024
            ? `${(a.sizeBytes / 1024).toFixed(1)} KB`
            : `${(a.sizeBytes / (1024 * 1024)).toFixed(2)} MB`
        : 'unknown size';

      const lines = [
        `${idx + 1}. [${time}] ${a.msg.sender_type === 'agent' ? 'Agent' : a.msg.sender_type === 'user' ? 'Customer' : 'System'}`,
        `   Path:     ${a.path}`,
        `   Uploader: ${a.folder || '—'}`,
        `   MIME:     ${a.mimeType || 'unknown'}`,
        `   Size:     ${sizeLabel}`,
      ];
      if (a.lastModified) lines.push(`   Stored:   ${format(new Date(a.lastModified), 'PPpp')}`);

      for (const l of lines) {
        const wrapped = doc.splitTextToSize(l, maxWidth);
        for (const w of wrapped) {
          if (y > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(w, margin, y); y += 12;
        }
      }
      y += 4;
    });
    doc.setTextColor(20);
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  // Filename: kang-support-<subject>-<YYYYMMDD>-<id>.pdf
  const dateTag = format(new Date(opts.updatedAt || opts.createdAt || new Date()), 'yyyyMMdd');
  const subjectSlug = safeSlug(opts.subject || 'support');
  doc.save(`kang-support-${subjectSlug}-${dateTag}-${opts.conversationId.slice(0, 8)}.pdf`);
}
