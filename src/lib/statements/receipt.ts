/**
 * Generate a small "Statement Download Receipt" PDF.
 * Issued client-side after every successful statement download.
 */
import jsPDF from "jspdf";

export interface DownloadReceipt {
  source: "customer" | "banking";
  serial: string;
  period_from: string;
  period_to: string;
  tx_count: number;
  account_no: string;
  user_label: string;
  bank_name?: string;
  /** Amount actually deducted from the user's balance (0 when waived). */
  fee_amount?: number;
  fee_currency?: string;
  /** charged = funds debited; waived = free per admin config; replayed = idempotent re-download. */
  fee_status?: "charged" | "waived" | "replayed";
  idempotency_key?: string;
}

function d(iso: string) {
  const x = new Date(iso);
  return Number.isNaN(x.getTime())
    ? iso
    : x.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function downloadStatementReceipt(r: DownloadReceipt) {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor("#0a4a8a");
  doc.text("Statement Download Receipt", 14, 18);

  doc.setDrawColor("#0a4a8a");
  doc.setLineWidth(0.5);
  doc.line(14, 21, w - 14, 21);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 40, 40);

  const feeLabel = (() => {
    if (r.fee_status === "waived" || !r.fee_amount) return "Waived (free)";
    if (r.fee_status === "replayed") {
      return `${(r.fee_amount || 0).toLocaleString()} ${r.fee_currency || "XAF"} (already paid)`;
    }
    return `${(r.fee_amount || 0).toLocaleString()} ${r.fee_currency || "XAF"}`;
  })();

  const rows: Array<[string, string]> = [
    ["App", r.source === "customer" ? "Consumers App" : "Banking App"],
    ["Account holder", r.user_label],
    ["Account no.", r.account_no],
    ["Issuing bank", r.bank_name || (r.source === "customer" ? "Kang" : "—")],
    ["Period from", d(r.period_from)],
    ["Period to", d(r.period_to)],
    ["Transactions", String(r.tx_count)],
    ["Download fee", feeLabel],
    ["Statement serial", r.serial],
    ["Idempotency key", r.idempotency_key ? r.idempotency_key.slice(0, 18) + "…" : "—"],
    ["Downloaded at", new Date().toLocaleString("en-GB")],
  ];

  let y = 30;
  for (const [k, v] of rows) {
    doc.setTextColor("#6b7280");
    doc.text(k, 14, y);
    doc.setTextColor(20, 20, 20);
    doc.text(v, 60, y);
    y += 6;
  }

  doc.setDrawColor("#d8dde3");
  doc.line(14, y + 2, w - 14, y + 2);
  doc.setFontSize(7.5);
  doc.setTextColor("#6b7280");
  doc.text(
    "This receipt confirms a statement PDF was generated and downloaded against your account.",
    14,
    y + 8,
    { maxWidth: w - 28 }
  );
  doc.text(
    "If you did not initiate this download, contact support immediately.",
    14,
    y + 13,
    { maxWidth: w - 28 }
  );

  doc.save(`Statement-Receipt-${r.serial}.pdf`);
}
