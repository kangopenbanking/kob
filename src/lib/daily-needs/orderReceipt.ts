import jsPDF from "jspdf";
import { format } from "date-fns";

export interface OrderReceiptItem {
  name: string;
  quantity: number;
  unit_price_xaf: number;
  total_xaf: number;
}

export interface OrderReceiptData {
  id: string;
  status: string;
  vertical?: string | null;
  store_name?: string | null;
  subtotal_xaf: number;
  delivery_fee_xaf: number;
  service_fee_xaf: number;
  total_xaf: number;
  delivery_address?: string | null;
  delivery_phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
  items: OrderReceiptItem[];
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : format(d, "MMM d, yyyy · HH:mm");
}

export function downloadOrderReceipt(o: OrderReceiptData) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  const shortId = o.id.slice(0, 8).toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#0a4a8a");
  doc.text("Daily Needs Order Receipt", 14, 18);

  doc.setDrawColor("#0a4a8a");
  doc.setLineWidth(0.5);
  doc.line(14, 21, w - 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);

  const meta: Array<[string, string]> = [
    ["Order #", shortId],
    ["Status", o.status.replace(/_/g, " ")],
    ["Type", (o.vertical || "—").toString()],
    ["Store", o.store_name || "—"],
    ["Placed", fmtDate(o.created_at)],
    ["Last updated", fmtDate(o.updated_at)],
    ...(o.delivered_at ? ([["Delivered", fmtDate(o.delivered_at)]] as Array<[string, string]>) : []),
  ];

  let y = 30;
  for (const [k, v] of meta) {
    doc.setTextColor("#6b7280");
    doc.text(k, 14, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(v), 50, y);
    y += 6;
  }

  y += 2;
  doc.setDrawColor("#d8dde3");
  doc.line(14, y, w - 14, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#0a4a8a");
  doc.text("Items", 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Qty", 14, y);
  doc.text("Item", 26, y);
  doc.text("Unit", w - 50, y, { align: "right" });
  doc.text("Total", w - 14, y, { align: "right" });
  y += 2;
  doc.setDrawColor("#e5e7eb");
  doc.line(14, y, w - 14, y);
  y += 5;

  for (const it of o.items) {
    if (y > 180) { doc.addPage(); y = 20; }
    doc.text(String(it.quantity), 14, y);
    const nameLines = doc.splitTextToSize(it.name, w - 80);
    doc.text(nameLines, 26, y);
    doc.text(Number(it.unit_price_xaf).toLocaleString(), w - 50, y, { align: "right" });
    doc.text(Number(it.total_xaf).toLocaleString(), w - 14, y, { align: "right" });
    y += Math.max(5, nameLines.length * 4.5);
  }

  y += 2;
  doc.line(14, y, w - 14, y);
  y += 6;

  const totals: Array<[string, number]> = [
    ["Subtotal", o.subtotal_xaf],
    ["Delivery fee", o.delivery_fee_xaf],
    ["Service fee", o.service_fee_xaf],
  ];
  for (const [k, v] of totals) {
    doc.setTextColor("#6b7280");
    doc.text(k, 14, y);
    doc.setTextColor(20, 20, 20);
    doc.text(`${Number(v).toLocaleString()} XAF`, w - 14, y, { align: "right" });
    y += 5;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#0a4a8a");
  doc.text("Total", 14, y + 2);
  doc.text(`${Number(o.total_xaf).toLocaleString()} XAF`, w - 14, y + 2, { align: "right" });
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor("#0a4a8a");
  doc.text("Delivery", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  const addrLines = doc.splitTextToSize(o.delivery_address || "—", w - 28);
  doc.text(addrLines, 14, y);
  y += addrLines.length * 4.5;
  if (o.delivery_phone) { doc.text(`Phone: ${o.delivery_phone}`, 14, y); y += 5; }
  if (o.notes) {
    const noteLines = doc.splitTextToSize(`Notes: ${o.notes}`, w - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 4.5;
  }

  doc.setFontSize(7.5);
  doc.setTextColor("#6b7280");
  doc.text(
    "Thank you for your order. Keep this receipt for your records.",
    14,
    y + 8,
    { maxWidth: w - 28 },
  );

  doc.save(`Order-${shortId}.pdf`);
}
