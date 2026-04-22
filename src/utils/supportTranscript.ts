// Export a Live Support conversation transcript as a downloadable PDF.
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptOptions {
  conversationId: string;
  subject?: string;
  departmentName?: string;
  createdAt?: string;
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
  if (opts.createdAt) { doc.text(`Started: ${format(new Date(opts.createdAt), 'PPpp')}`, margin, y); y += 14; }
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
    y += 8;
    if (y > pageHeight - margin) { doc.addPage(); y = margin; }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
  }

  const safeSubject = (opts.subject || 'support').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 40);
  doc.save(`kang-support-${safeSubject}-${opts.conversationId.slice(0, 8)}.pdf`);
}
