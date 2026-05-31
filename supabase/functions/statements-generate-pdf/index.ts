// Server-side statement PDF generator.
// - Allocates a globally unique serial via allocate_statement_serial RPC.
// - Renders a Barclays-inspired A4 statement with watermark and barcode-style strip.
// - Logs every download to statement_download_audit and security_audit_logs.
// - Streams application/pdf bytes back to the caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import jsPDF from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers":
    "X-Statement-Serial, X-Statement-Tx-Count, X-Statement-Fee-Charged, X-Statement-Fee-Currency, X-Statement-Fee-Status, Content-Disposition",
};

type Source = "customer" | "banking";

interface ReqBody {
  source: Source;
  institution_id?: string;
  period_from: string;
  period_to: string;
  /** Mode: "paid" generates the PDF and charges; "free_preview" is disallowed here (server is paid-only entitlement). */
  mode?: "paid";
  /** Required when fee > 0: client-generated v4 UUID that prevents double-deduction on repeated clicks. */
  idempotency_key?: string;
}

const BRAND = "#0a4a8a";
const BRAND_SOFT = "#e8f1fb";
const GREY = "#6b7280";
const RULE = "#d8dde3";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function fmtMoney(n: number, ccy?: string) {
  const v = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return ccy ? `${v} ${ccy}` : v;
}

/** Render a deterministic, scannable-looking barcode-style strip from the serial. */
function drawBarcodeStrip(doc: jsPDF, serial: string, x: number, y: number) {
  // Hash-based bar widths so each unique serial yields a unique bar pattern.
  let hash = 0;
  for (let i = 0; i < serial.length; i++) hash = (hash * 31 + serial.charCodeAt(i)) >>> 0;
  const total = 60;
  let cx = x;
  doc.setFillColor(20, 20, 20);
  for (let i = 0; i < 90 && cx < x + total; i++) {
    const seed = (hash ^ (i * 2654435761)) >>> 0;
    const w = 0.3 + ((seed >> 4) & 0x7) * 0.18;
    if ((seed & 1) === 1) doc.rect(cx, y, w, 12, "F");
    cx += w + 0.25;
  }
}

function watermark(doc: jsPDF, text: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  const GState = (doc as any).GState;
  if (GState) doc.setGState(new GState({ opacity: 0.08 }));
  doc.setTextColor(120, 120, 120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(72);
  doc.text(text, w / 2, h / 2, { align: "center", angle: 30 });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

function drawHeader(doc: jsPDF, bankName: string, currency: string, period: { from: string; to: string }, page: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(BRAND);
  doc.text(bankName, 20, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  doc.text(`Statement date ${fmtDate(period.to)}`, w / 2 - 20, 14);
  doc.text(`Period ${fmtDate(period.from)} – ${fmtDate(period.to)}`, w / 2 - 20, 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BRAND);
  doc.text(`${currency} Account`, w - 20, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(GREY);
  doc.text(`Page ${page}`, w - 20, 19, { align: "right" });

  doc.setDrawColor(BRAND);
  doc.setLineWidth(0.6);
  doc.line(20, 24, w - 20, 24);
  doc.setTextColor(0, 0, 0);
}

function drawFooter(doc: jsPDF, registration: string, serial: string, page: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  doc.line(20, h - 18, w - 20, h - 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(GREY);
  doc.text(registration, 20, h - 12);
  doc.text(`Serial: ${serial}`, w / 2, h - 12, { align: "center" });
  doc.text(`Page ${page}`, w - 20, h - 12, { align: "right" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.source || !body.period_from || !body.period_to) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve profile + account + bank + transactions server-side.
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, phone_number, address, city, country_code")
      .eq("id", user.id)
      .maybeSingle();

    let acctQuery = admin
      .from("accounts")
      .select(
        "id, account_id, account_holder_name, currency, identification_value, swift_bic, rib_bank_code, rib_branch_code, rib_account_number, rib_key, institution_id"
      )
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (body.source === "banking" && body.institution_id) {
      acctQuery = acctQuery.eq("institution_id", body.institution_id);
    }
    const { data: accts } = await acctQuery.limit(1);
    const acct = (accts || [])[0] as any;
    if (!acct) {
      return new Response(JSON.stringify({ error: "no_account" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bankName = "Kang";
    let bankAddress: string[] = ["Kang Open Banking S.A.", "Douala, Cameroon"];
    let bankRegistration = "Kang Open Banking S.A. — Douala, Cameroon";
    let scopeId = "kang";

    if (body.source === "banking" && body.institution_id) {
      const { data: inst } = await admin
        .from("institutions")
        .select("institution_name, address, country")
        .eq("id", body.institution_id)
        .maybeSingle();
      if (inst) {
        bankName = (inst as any).institution_name || bankName;
        bankAddress = [(inst as any).address, (inst as any).country].filter(Boolean) as string[];
        bankRegistration = `${bankName} — issued via Kang Open Banking`;
      }
      scopeId = body.institution_id;
    }

    // Transactions in period
    let txQuery = admin
      .from("transactions")
      .select(
        "amount, currency, credit_debit_indicator, transaction_type, transaction_information, booking_datetime, created_at"
      )
      .gte("created_at", body.period_from)
      .lte("created_at", body.period_to)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (body.source === "banking") {
      txQuery = txQuery.eq("account_id", acct.id);
    } else {
      txQuery = txQuery.eq("user_id", user.id);
    }
    const { data: txs } = await txQuery;

    const accountNo = acct.account_id || acct.identification_value || "ACCT";

    // Allocate a unique serial atomically.
    const { data: serialData, error: serialErr } = await admin.rpc(
      "allocate_statement_serial",
      {
        p_source: body.source,
        p_scope_id: scopeId,
        p_account_no: accountNo,
        p_user_id: user.id,
        p_period_from: body.period_from,
        p_period_to: body.period_to,
      }
    );
    if (serialErr || !serialData) {
      return new Response(JSON.stringify({ error: "serial_failed", details: serialErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serial = String(serialData);

    // Resolve effective fee (per app + institution type) with global fallback
    let institutionType: string | null = null;
    if (body.source === "banking" && body.institution_id) {
      const { data: instType } = await admin
        .from("institutions")
        .select("institution_type")
        .eq("id", body.institution_id)
        .maybeSingle();
      institutionType = (instType as any)?.institution_type ?? null;
    }
    const { data: feeCfg } = await admin.rpc("resolve_statement_fee", {
      p_source: body.source,
      p_institution_type: institutionType,
    });
    const feeAmount = Number((feeCfg as any)?.fee_amount ?? 0);
    const feeEnabled = !!(feeCfg as any)?.is_enabled;
    const feeCurrency = String((feeCfg as any)?.currency ?? "XAF");
    const feeIsFree = !feeEnabled || feeAmount <= 0;

    let feeCharged = 0;
    let feeStatus: "charged" | "waived" | "replayed" = feeIsFree ? "waived" : "charged";

    if (!feeIsFree) {
      const idemKey = (body.idempotency_key || "").trim();
      if (!idemKey || !/^[0-9a-f-]{16,}$/i.test(idemKey)) {
        return new Response(
          JSON.stringify({
            error: "idempotency_key_required",
            message:
              "An idempotency key is required to safely charge the download fee. Please retry from the preview screen.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: chargeResult, error: chargeErr } = await admin.rpc("charge_statement_fee_v2", {
        p_user_id: user.id,
        p_account_id: acct.id,
        p_amount: feeAmount,
        p_currency: feeCurrency,
        p_source: body.source,
        p_serial: serial,
        p_idempotency_key: idemKey,
      });
      if (chargeErr) {
        return new Response(
          JSON.stringify({ error: "fee_charge_failed", message: chargeErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const status = (chargeResult as any)?.status;
      const replay = !!(chargeResult as any)?.replay;

      if (status === "insufficient_funds") {
        return new Response(
          JSON.stringify({
            error: "insufficient_funds",
            message: `Your balance is too low to cover the ${feeAmount.toLocaleString()} ${feeCurrency} statement download fee. Please top up and try again.`,
            fee_amount: feeAmount,
            currency: feeCurrency,
            available: (chargeResult as any)?.available,
            shortfall: Math.max(0, feeAmount - Number((chargeResult as any)?.available ?? 0)),
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === "no_balance") {
        return new Response(
          JSON.stringify({
            error: "no_balance",
            message: "No account balance is available to deduct the statement download fee. Please fund your account and try again.",
            fee_amount: feeAmount,
            currency: feeCurrency,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === "charged") {
        feeCharged = feeAmount;
        feeStatus = replay ? "replayed" : "charged";
      } else if (status === "skipped") {
        feeStatus = "waived";
      } else {
        // Unexpected — surface as 409 conflict so UI can guide the user
        return new Response(
          JSON.stringify({
            error: "fee_charge_conflict",
            message: "We could not finalise the statement charge. Please refresh and try again.",
            details: chargeResult,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }


    // Build PDF
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const wmText = body.source === "customer" ? "KANG STATEMENT" : "BANK STATEMENT";
    const currency = acct.currency || "XAF";

    let page = 1;
    watermark(doc, wmText);
    drawHeader(doc, bankName, currency, { from: body.period_from, to: body.period_to }, page);

    // Customer address
    let y = 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text((profile?.full_name || user.email || "Account holder").toUpperCase(), 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const addrLines = [profile?.address, profile?.city, profile?.country_code, profile?.phone_number]
      .filter(Boolean) as string[];
    for (const l of addrLines) {
      doc.text(l, 20, y);
      y += 4.5;
    }

    // Account info right column
    const rightX = w - 90;
    let ry = 36;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(BRAND);
    doc.text("Account information", rightX, ry);
    ry += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rib = [acct.rib_bank_code, acct.rib_branch_code, acct.rib_account_number, acct.rib_key]
      .filter(Boolean)
      .join("-");
    const acctRows: Array<[string, string | undefined]> = [
      ["Holder", acct.account_holder_name || profile?.full_name],
      ["Account no.", accountNo],
      ["Sort code", acct.rib_branch_code],
      ["IBAN", rib || acct.identification_value],
      ["SWIFT/BIC", acct.swift_bic],
      ["Currency", currency],
    ];
    for (const [k, v] of acctRows) {
      if (!v) continue;
      doc.setTextColor(GREY);
      doc.text(String(k), rightX, ry);
      doc.setTextColor(20, 20, 20);
      doc.text(String(v), rightX + 28, ry);
      ry += 4.8;
    }
    ry += 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(BRAND);
    doc.text("Issuing bank", rightX, ry);
    ry += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);
    doc.text(bankName, rightX, ry);
    ry += 4;
    for (const l of bankAddress) {
      doc.text(l, rightX, ry);
      ry += 4;
    }
    y = Math.max(y, ry) + 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text(`Your ${bankName} Account statement`, 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(GREY);
    doc.text("Current account statement", 20, y);
    y += 8;

    // At a glance
    const moneyIn = (txs || [])
      .filter((t: any) => (t.credit_debit_indicator || "").toLowerCase() === "credit")
      .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
    const moneyOut = (txs || [])
      .filter((t: any) => (t.credit_debit_indicator || "").toLowerCase() !== "credit")
      .reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
    const start = 0;
    const end = start + moneyIn - moneyOut;

    const panelX = w - 90;
    const panelY = y - 2;
    doc.setFillColor(BRAND_SOFT);
    doc.rect(panelX, panelY, 70, 32, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(BRAND);
    doc.text("At a glance", panelX + 3, panelY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rows: Array<[string, string]> = [
      ["Start balance", fmtMoney(start, currency)],
      ["Money in", fmtMoney(moneyIn, currency)],
      ["Money out", fmtMoney(moneyOut, currency)],
    ];
    let gy = panelY + 11;
    for (const [k, v] of rows) {
      doc.setTextColor(GREY);
      doc.text(k, panelX + 3, gy);
      doc.setTextColor(20, 20, 20);
      doc.text(v, panelX + 67, gy, { align: "right" });
      gy += 4.8;
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("End balance", panelX + 3, gy);
    doc.text(fmtMoney(end, currency), panelX + 67, gy, { align: "right" });

    // Barcode strip + serial (left)
    drawBarcodeStrip(doc, serial, 20, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(GREY);
    doc.text(`Statement serial: ${serial}`, 20, y + 16);
    doc.text(`Issued: ${new Date().toLocaleString("en-GB")}`, 20, y + 20);
    y += 36;

    // Transactions table
    const drawTableHead = (yy: number) => {
      doc.setFillColor(BRAND);
      doc.rect(20, yy, w - 40, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Your transactions", 23, yy + 5.5);
      yy += 8;
      doc.setFillColor(BRAND_SOFT);
      doc.rect(20, yy, w - 40, 7, "F");
      doc.setFontSize(8.5);
      doc.setTextColor(BRAND);
      doc.text("Date", 23, yy + 5);
      doc.text("Description", 50, yy + 5);
      doc.text("Money out", w - 80, yy + 5, { align: "right" });
      doc.text("Money in", w - 50, yy + 5, { align: "right" });
      doc.text("Balance", w - 23, yy + 5, { align: "right" });
      return yy + 9;
    };

    y = drawTableHead(y);

    let running = 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 20, 20);
    doc.text(fmtDate(body.period_from), 23, y + 4);
    doc.text("Start balance", 50, y + 4);
    doc.text(fmtMoney(running, currency), w - 23, y + 4, { align: "right" });
    y += 7;

    for (const t of (txs || []) as any[]) {
      if (y > h - 30) {
        drawFooter(doc, bankRegistration, serial, page);
        doc.addPage();
        page += 1;
        watermark(doc, wmText);
        drawHeader(doc, bankName, currency, { from: body.period_from, to: body.period_to }, page);
        y = 32;
        y = drawTableHead(y);
      }
      const isCredit = (t.credit_debit_indicator || "").toLowerCase() === "credit";
      const amount = Math.abs(t.amount || 0);
      if (isCredit) running += amount;
      else running -= amount;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);
      doc.text(fmtDate(t.booking_datetime || t.created_at), 23, y + 4);
      const desc = doc.splitTextToSize(
        t.transaction_information || t.transaction_type || "Transaction",
        w - 145
      );
      doc.text(desc, 50, y + 4);
      if (!isCredit) doc.text(fmtMoney(amount), w - 80, y + 4, { align: "right" });
      else doc.text(fmtMoney(amount), w - 50, y + 4, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(fmtMoney(running, currency), w - 23, y + 4, { align: "right" });

      const rowCount = Array.isArray(desc) ? desc.length : 1;
      y += Math.max(6, rowCount * 4.5) + 1.5;
      doc.setDrawColor(RULE);
      doc.setLineWidth(0.1);
      doc.line(20, y, w - 20, y);
      y += 1.5;
    }

    if (y > h - 30) {
      drawFooter(doc, bankRegistration, serial, page);
      doc.addPage();
      page += 1;
      watermark(doc, wmText);
      drawHeader(doc, bankName, currency, { from: body.period_from, to: body.period_to }, page);
      y = 32;
    }
    doc.setFillColor(BRAND_SOFT);
    doc.rect(20, y, w - 40, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(BRAND);
    doc.text(`End balance on ${fmtDate(body.period_to)}`, 23, y + 5.5);
    doc.setTextColor(20, 20, 20);
    doc.text(fmtMoney(running, currency), w - 23, y + 5.5, { align: "right" });

    drawFooter(doc, bankRegistration, serial, page);

    // Audit log
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    const ua = req.headers.get("user-agent") || null;
    await admin.from("statement_download_audit").insert({
      user_id: user.id,
      source: body.source,
      scope_id: scopeId,
      account_no: accountNo,
      serial,
      period_from: body.period_from,
      period_to: body.period_to,
      tx_count: (txs || []).length,
      ip_address: ip,
      user_agent: ua,
    });
    await admin.from("security_audit_logs").insert({
      user_id: user.id,
      action: "statement_download",
      metadata: {
        source: body.source,
        scope_id: scopeId,
        serial,
        period_from: body.period_from,
        period_to: body.period_to,
        tx_count: (txs || []).length,
        fee_amount: feeCharged,
        fee_currency: feeCurrency,
        fee_status: feeStatus,
        institution_type: institutionType,
        idempotency_key: body.idempotency_key ?? null,
      },
      ip_address: ip,
      user_agent: ua,
    });

    const ab = doc.output("arraybuffer") as ArrayBuffer;
    const filename = `${body.source === "customer" ? "KANG" : "BANK"}-Statement-${serial}.pdf`;
    return new Response(ab, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Statement-Serial": serial,
        "X-Statement-Tx-Count": String((txs || []).length),
        "X-Statement-Fee-Charged": String(feeCharged),
        "X-Statement-Fee-Currency": feeCurrency,
        "X-Statement-Fee-Status": feeStatus,
      },
    });
  } catch (e) {
    console.error("statements-generate-pdf error", e);
    return new Response(JSON.stringify({ error: "internal", message: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
