/**
 * Statement PDF generator (Customer + Banking apps).
 *
 * Renders a Barclays-inspired professional statement:
 *   - Page 1: bank logo header, customer address block, account snapshot,
 *             "At a glance" totals, barcode + serial number, transactions table.
 *   - Pages 2+: header + continued transactions table only (no address).
 *   - Diagonal light-grey watermark on every page:
 *       "KANG STATEMENT"  (customer app)
 *       "BANK STATEMENT"  (banking app)
 */
import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

export type StatementSource = "customer" | "banking";

export interface StatementTx {
  date: string; // ISO
  description: string;
  type?: string;
  credit_debit_indicator?: "Credit" | "Debit" | string;
  amount: number;
  currency?: string;
}

export interface StatementInput {
  source: StatementSource;
  customer: {
    full_name: string;
    address_lines?: string[];
  };
  account: {
    holder_name?: string;
    account_no: string;
    sort_code?: string;
    iban?: string;
    swift?: string;
    currency: string;
  };
  bank: {
    name: string;
    address_lines?: string[];
    registration?: string;
  };
  period: {
    from: string; // ISO date
    to: string;   // ISO date
  };
  transactions: StatementTx[];
  openingBalance?: number;
}

const BRAND = "#0a4a8a";        // primary statement blue
const BRAND_SOFT = "#e8f1fb";   // table header tint
const GREY = "#6b7280";
const RULE = "#d8dde3";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number, ccy?: string): string {
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return ccy ? `${v} ${ccy}` : v;
}

function makeSerial(source: StatementSource, accountNo: string): string {
  const prefix = source === "customer" ? "KANG" : "BANK";
  const tail = (accountNo || "").replace(/\W/g, "").slice(-4).padStart(4, "0");
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}-${tail}-${stamp}-${rand}`;
}

function makeBarcodeDataUrl(value: string): string {
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, value, {
      format: "CODE128",
      displayValue: false,
      height: 40,
      margin: 0,
      width: 1.4,
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function drawWatermark(doc: jsPDF, text: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  // jsPDF GState for opacity
  const GState = (doc as any).GState;
  if (GState) doc.setGState(new GState({ opacity: 0.08 }));
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.text(text, w / 2, h / 2, { align: "center", angle: 30 });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

function drawHeader(
  doc: jsPDF,
  input: StatementInput,
  page: number,
  totalPagesPlaceholder: string,
) {
  const w = doc.internal.pageSize.getWidth();
  // Brand mark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(BRAND);
  doc.text(input.bank.name, 20, 18);

  // Statement period (top-center)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Statement date ${fmtDate(input.period.to)}`, w / 2 - 20, 14);
  doc.text(`Period ${fmtDate(input.period.from)} – ${fmtDate(input.period.to)}`, w / 2 - 20, 19);

  // Account title (top-right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND);
  doc.text(`${input.account.currency} Account`, w - 20, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GREY);
  doc.text(`Page ${page} ${totalPagesPlaceholder}`, w - 20, 19, { align: "right" });

  // Brand rule
  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.6);
  doc.line(20, 24, w - 20, 24);
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF, input: StatementInput, serial: string, page: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.line(20, h - 18, w - 20, h - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  const reg = input.bank.registration || `${input.bank.name}. All rights reserved.`;
  doc.text(reg, 20, h - 12);
  doc.text(`Serial: ${serial}`, w / 2, h - 12, { align: "center" });
  doc.text(`Page ${page}`, w - 20, h - 12, { align: "right" });
}

function drawFirstPageMeta(doc: jsPDF, input: StatementInput, serial: string): number {
  // Customer address (left)
  let y = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text((input.customer.full_name || "").toUpperCase(), 20, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50, 50, 50);
  for (const line of input.customer.address_lines || []) {
    doc.text(line, 20, y);
    y += 4.5;
  }

  // Account info (right column)
  const rightX = doc.internal.pageSize.getWidth() - 90;
  let ry = 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND);
  doc.text("Account information", rightX, ry);
  ry += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  const acctRows: Array<[string, string | undefined]> = [
    ["Holder", input.account.holder_name || input.customer.full_name],
    ["Account no.", input.account.account_no],
    ["Sort code", input.account.sort_code],
    ["IBAN", input.account.iban],
    ["SWIFT/BIC", input.account.swift],
    ["Currency", input.account.currency],
  ];
  for (const [k, v] of acctRows) {
    if (!v) continue;
    doc.setTextColor(GREY);
    doc.text(`${k}`, rightX, ry);
    doc.setTextColor(20, 20, 20);
    doc.text(String(v), rightX + 28, ry);
    ry += 4.8;
  }

  // Bank address block (small, under account info)
  ry += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND);
  doc.text("Issuing bank", rightX, ry);
  ry += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(input.bank.name, rightX, ry);
  ry += 4;
  for (const line of input.bank.address_lines || []) {
    doc.text(line, rightX, ry);
    ry += 4;
  }

  y = Math.max(y, ry) + 4;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(`Your ${input.bank.name} Account statement`, 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(GREY);
  doc.text("Current account statement", 20, y);
  y += 8;

  // "At a glance" panel
  const moneyIn = input.transactions
    .filter((t) => (t.credit_debit_indicator || "").toLowerCase() === "credit")
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const moneyOut = input.transactions
    .filter((t) => (t.credit_debit_indicator || "").toLowerCase() !== "credit")
    .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const start = input.openingBalance || 0;
  const end = start + moneyIn - moneyOut;

  const panelX = doc.internal.pageSize.getWidth() - 90;
  const panelY = y - 2;
  doc.setFillColor(BRAND_SOFT);
  doc.rect(panelX, panelY, 70, 32, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND);
  doc.text("At a glance", panelX + 3, panelY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  const glance: Array<[string, string]> = [
    ["Start balance", fmtMoney(start, input.account.currency)],
    ["Money in", fmtMoney(moneyIn, input.account.currency)],
    ["Money out", fmtMoney(moneyOut, input.account.currency)],
  ];
  let gy = panelY + 11;
  for (const [k, v] of glance) {
    doc.setTextColor(GREY);
    doc.text(k, panelX + 3, gy);
    doc.setTextColor(20, 20, 20);
    doc.text(v, panelX + 67, gy, { align: "right" });
    gy += 4.8;
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("End balance", panelX + 3, gy);
  doc.text(fmtMoney(end, input.account.currency), panelX + 67, gy, { align: "right" });

  // Barcode + serial (left, opposite the panel)
  const barcode = makeBarcodeDataUrl(serial);
  if (barcode) {
    doc.addImage(barcode, "PNG", 20, y, 60, 14);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  doc.text(`Statement serial: ${serial}`, 20, y + 18);
  doc.text(`Issued: ${new Date().toLocaleString("en-GB")}`, 20, y + 22);

  return y + 36;
}

function drawTableHeader(doc: jsPDF, y: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(BRAND);
  doc.rect(20, y, w - 40, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("Your transactions", 23, y + 5.5);
  y += 8;

  doc.setFillColor(BRAND_SOFT);
  doc.rect(20, y, w - 40, 7, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND);
  doc.text("Date", 23, y + 5);
  doc.text("Description", 50, y + 5);
  doc.text("Money out", w - 80, y + 5, { align: "right" });
  doc.text("Money in", w - 50, y + 5, { align: "right" });
  doc.text("Balance", w - 23, y + 5, { align: "right" });
  return y + 9;
}

export async function generateStatementPdf(input: StatementInput): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const watermark = input.source === "customer" ? "KANG STATEMENT" : "BANK STATEMENT";
  const serial = makeSerial(input.source, input.account.account_no);

  let page = 1;
  drawWatermark(doc, watermark);
  drawHeader(doc, input, page, "");
  let y = drawFirstPageMeta(doc, input, serial);
  y = drawTableHeader(doc, y);

  // Sort oldest → newest
  const txs = [...input.transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let running = input.openingBalance || 0;
  // Opening balance row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(fmtDate(input.period.from), 23, y + 4);
  doc.text("Start balance", 50, y + 4);
  doc.text(fmtMoney(running, input.account.currency), w - 23, y + 4, { align: "right" });
  y += 7;

  for (const t of txs) {
    if (y > h - 30) {
      drawFooter(doc, input, serial, page);
      doc.addPage();
      page += 1;
      drawWatermark(doc, watermark);
      drawHeader(doc, input, page, "");
      y = 32;
      y = drawTableHeader(doc, y);
    }
    const isCredit = (t.credit_debit_indicator || "").toLowerCase() === "credit";
    const amount = Math.abs(t.amount || 0);
    if (isCredit) running += amount; else running -= amount;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.text(fmtDate(t.date), 23, y + 4);
    const desc = doc.splitTextToSize(t.description || t.type || "Transaction", w - 145);
    doc.text(desc, 50, y + 4);
    if (!isCredit) doc.text(fmtMoney(amount), w - 80, y + 4, { align: "right" });
    else doc.text(fmtMoney(amount), w - 50, y + 4, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmtMoney(running, input.account.currency), w - 23, y + 4, { align: "right" });

    const rows = Array.isArray(desc) ? desc.length : 1;
    y += Math.max(6, rows * 4.5) + 1.5;

    // Thin row divider
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.1);
    doc.line(20, y, w - 20, y);
    y += 1.5;
  }

  // End balance row
  if (y > h - 30) {
    drawFooter(doc, input, serial, page);
    doc.addPage();
    page += 1;
    drawWatermark(doc, watermark);
    drawHeader(doc, input, page, "");
    y = 32;
  }
  doc.setFillColor(BRAND_SOFT);
  doc.rect(20, y, w - 40, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND);
  doc.text(`End balance on ${fmtDate(input.period.to)}`, 23, y + 5.5);
  doc.setTextColor(20, 20, 20);
  doc.text(fmtMoney(running, input.account.currency), w - 23, y + 5.5, { align: "right" });

  drawFooter(doc, input, serial, page);

  const filename = `${input.source === "customer" ? "KANG" : "BANK"}-Statement-${serial}.pdf`;
  doc.save(filename);
}
