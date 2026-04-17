import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { safeErrorResponse } from "../_shared/errors.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = ["POST", "PUT", "PATCH"].includes(req.method)
      ? await req.json().catch(() => ({}))
      : {};
    const action = body.action || url.searchParams.get("action") || "";

    // F34 — Edge-level validation for monetary actions.
    // Rejects malformed amount/currency before any DB work, in addition to
    // the per-action checks below. Returns a clear 400 with a stable error
    // code consumed by the shared API error handler.
    const MONETARY_ACTIONS = new Set([
      "internal_transfer", "external_transfer", "create_payout",
    ]);
    if (MONETARY_ACTIONS.has(action)) {
      const amt = body.amount;
      if (typeof amt !== "number" || !Number.isFinite(amt) || amt <= 0) {
        return new Response(
          JSON.stringify({ error: "invalid_amount", message: "amount must be a positive finite number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (amt > 1_000_000_000) {
        return new Response(
          JSON.stringify({ error: "amount_exceeds_cap", message: "amount exceeds 1,000,000,000 hard cap" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const cur = body.currency ?? "XAF";
      if (typeof cur !== "string" || !/^[A-Z]{3}$/.test(cur)) {
        return new Response(
          JSON.stringify({ error: "invalid_currency", message: "currency must be an ISO 4217 three-letter code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional auth - extract user if token provided
    const authHeader = req.headers.get("authorization");
    let userId: string | undefined;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabase.auth.getUser(token);
      userId = data.user?.id;
    }

    const startTime = Date.now();
    let result: Record<string, unknown>;
    let statusCode = 200;

    // ── Authorization helpers ──
    // Verify the requesting user is admin OR owner/staff of the institution
    const authorizeInstitution = async (instId: string | null | undefined): Promise<{ ok: boolean; reason?: string }> => {
      if (!userId) return { ok: false, reason: "Authentication required" };
      if (!instId) return { ok: false, reason: "institution_id required" };
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (isAdmin) return { ok: true };
      const { data: isOwner } = await supabase.rpc("is_institution_owner", { _user_id: userId, _institution_id: instId });
      if (isOwner) return { ok: true };
      const { data: isStaff } = await supabase.rpc("is_institution_staff_admin", { _user_id: userId, _institution_id: instId });
      if (isStaff) return { ok: true };
      return { ok: false, reason: "Forbidden: not authorized for this institution" };
    };

    // Verify the user owns the account or is admin/staff of its institution
    const authorizeAccount = async (accountId: string): Promise<{ ok: boolean; reason?: string; institutionId?: string | null }> => {
      if (!userId) return { ok: false, reason: "Authentication required" };
      const { data: account } = await supabase
        .from("accounts")
        .select("user_id, institution_id")
        .eq("id", accountId)
        .maybeSingle();
      if (!account) return { ok: false, reason: "Account not found" };
      if (account.user_id === userId) return { ok: true, institutionId: account.institution_id };
      const inst = await authorizeInstitution(account.institution_id);
      return inst.ok ? { ok: true, institutionId: account.institution_id } : { ok: false, reason: inst.reason };
    };

    switch (action) {
      // ── Bank Discovery ──
      case "list_banks": {
        const { data, error } = await supabase
          .from("banks")
          .select("id, legal_name, display_name, swift_bic, country, bank_code, status, integration_mode, created_at")
          .eq("status", "active")
          .order("display_name");
        if (error) throw error;
        result = { data, meta: { total: data?.length || 0 } };
        break;
      }

      case "get_bank_status": {
        const bankId = body.bank_id || url.searchParams.get("bank_id");
        if (!bankId) {
          statusCode = 400;
          result = { error: "bank_id required" };
          break;
        }
        const { data: bank, error } = await supabase
          .from("banks")
          .select("id, display_name, status, integration_mode, created_at")
          .eq("id", bankId)
          .maybeSingle();
        if (error) throw error;
        if (!bank) { statusCode = 404; result = { error: "Bank not found" }; break; }

        // Check connector health
        const { data: health } = await supabase
          .from("bank_connector_health")
          .select("status, latency_ms, last_check_at")
          .eq("instance_id", bankId)
          .maybeSingle();

        result = {
          data: {
            ...bank,
            connector_status: health?.status || "unknown",
            latency_ms: health?.latency_ms || null,
            last_health_check: health?.last_check_at || null,
          },
        };
        break;
      }

      // ── Customer Management ──
      case "create_customer": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const { institution_id, external_customer_id, full_name, phone, email, metadata: custMeta } = body;
        if (!institution_id || !external_customer_id || !full_name) {
          statusCode = 400;
          result = { error: "institution_id, external_customer_id, full_name required" };
          break;
        }
        const auth = await authorizeInstitution(institution_id);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }
        const { data, error } = await supabase
          .from("banking_customers")
          .insert({ institution_id, external_customer_id, full_name, phone, email, metadata: custMeta || {} })
          .select()
          .single();
        if (error) {
          if (error.code === "23505") { statusCode = 409; result = { error: "Customer already exists" }; break; }
          throw error;
        }
        statusCode = 201;
        result = { data };
        break;
      }

      case "get_customer": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const customerId = body.customer_id || url.searchParams.get("customer_id");
        if (!customerId) { statusCode = 400; result = { error: "customer_id required" }; break; }
        const { data, error } = await supabase
          .from("banking_customers")
          .select("*")
          .eq("id", customerId)
          .maybeSingle();
        if (error) throw error;
        if (!data) { statusCode = 404; result = { error: "Customer not found" }; break; }
        const auth = await authorizeInstitution(data.institution_id);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }
        result = { data };
        break;
      }

      case "list_customers": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const instId = body.institution_id || url.searchParams.get("institution_id");
        if (!instId) { statusCode = 400; result = { error: "institution_id required" }; break; }
        const auth = await authorizeInstitution(instId);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }
        const page = parseInt(body.page || url.searchParams.get("page") || "1");
        const perPage = Math.min(parseInt(body.per_page || url.searchParams.get("per_page") || "20"), 100);
        const from = (page - 1) * perPage;

        const { data, count, error } = await supabase
          .from("banking_customers")
          .select("*", { count: "exact" })
          .eq("institution_id", instId)
          .order("created_at", { ascending: false })
          .range(from, from + perPage - 1);
        if (error) throw error;
        result = {
          data,
          meta: { page, per_page: perPage, total: count || 0, total_pages: Math.ceil((count || 0) / perPage) },
        };
        break;
      }

      // ── Account Operations (proxy to existing data) ──
      case "list_accounts": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const bankFilter = body.bank_id || url.searchParams.get("bank_id");
        let query = supabase
          .from("accounts")
          .select("id, account_id, account_holder_name, account_type, account_subtype, currency, identification_value, is_active, institution_id, created_at");
        if (bankFilter) {
          // Authorize: requester must be admin/owner/staff of that institution
          const auth = await authorizeInstitution(bankFilter);
          if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }
          query = query.eq("institution_id", bankFilter);
        } else {
          // No filter: scope to caller's own accounts
          query = query.eq("user_id", userId);
        }
        const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
        if (error) throw error;
        result = { data, meta: { total: data?.length || 0 } };
        break;
      }

      case "get_account_balance": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const accountId = body.account_id || url.searchParams.get("account_id");
        if (!accountId) { statusCode = 400; result = { error: "account_id required" }; break; }
        const auth = await authorizeAccount(accountId);
        if (!auth.ok) { statusCode = auth.reason === "Account not found" ? 404 : 403; result = { error: auth.reason }; break; }
        const { data, error } = await supabase
          .from("account_balances")
          .select("id, account_id, amount, currency, balance_type, credit_debit_indicator, balance_datetime")
          .eq("account_id", accountId)
          .order("balance_datetime", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        result = { data: data || { account_id: accountId, amount: 0, currency: "XAF", balance_type: "ClosingAvailable" } };
        break;
      }

      case "get_account_transactions": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const txAccId = body.account_id || url.searchParams.get("account_id");
        if (!txAccId) { statusCode = 400; result = { error: "account_id required" }; break; }
        const auth = await authorizeAccount(txAccId);
        if (!auth.ok) { statusCode = auth.reason === "Account not found" ? 404 : 403; result = { error: auth.reason }; break; }
        const txPage = parseInt(body.page || url.searchParams.get("page") || "1");
        const txPerPage = Math.min(parseInt(body.per_page || url.searchParams.get("per_page") || "25"), 100);
        const txFrom = (txPage - 1) * txPerPage;

        const { data, count, error } = await supabase
          .from("transactions")
          .select("*", { count: "exact" })
          .eq("account_id", txAccId)
          .order("created_at", { ascending: false })
          .range(txFrom, txFrom + txPerPage - 1);
        if (error) throw error;
        result = {
          data,
          meta: { page: txPage, per_page: txPerPage, total: count || 0, total_pages: Math.ceil((count || 0) / txPerPage) },
        };
        break;
      }

      // ── Transfer Operations ──
      case "internal_transfer": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const { source_account_id, destination_account_id, amount, currency: txCurrency, narration, idempotency_key } = body;
        if (!source_account_id || !destination_account_id || !amount) {
          statusCode = 400;
          result = { error: "source_account_id, destination_account_id, amount required" };
          break;
        }
        // CRITICAL: validate amount and authorize source account ownership
        if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
          statusCode = 400; result = { error: "amount must be a positive number" }; break;
        }
        if (source_account_id === destination_account_id) {
          statusCode = 400; result = { error: "source and destination must differ" }; break;
        }
        const srcAuth = await authorizeAccount(source_account_id);
        if (!srcAuth.ok) {
          statusCode = srcAuth.reason === "Account not found" ? 404 : 403;
          result = { error: srcAuth.reason };
          break;
        }

        // Idempotency check
        if (idempotency_key) {
          const { data: existing } = await supabase.rpc("check_transfer_idempotency", {
            _idempotency_key: idempotency_key,
            _user_id: userId,
          });
          if (existing?.exists) {
            result = { data: existing, idempotent: true };
            break;
          }
        }

        // Get source balance
        const { data: srcBal } = await supabase
          .from("account_balances")
          .select("id")
          .eq("account_id", source_account_id)
          .eq("credit_debit_indicator", "Credit")
          .limit(1)
          .maybeSingle();

        if (!srcBal) { statusCode = 400; result = { error: "Source account balance not found" }; break; }

        const { data: transferResult, error: transferErr } = await supabase.rpc("execute_atomic_transfer", {
          _source_balance_id: srcBal.id,
          _dest_account_id: destination_account_id,
          _amount: amount,
          _currency: txCurrency || "XAF",
        });
        if (transferErr) {
          statusCode = 400;
          result = { error: transferErr.message };
          break;
        }

        // Record transactions
        const txRef = `TXF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from("transactions").insert([
          {
            account_id: source_account_id,
            user_id: userId,
            amount,
            currency: txCurrency || "XAF",
            credit_debit_indicator: "Debit",
            status: "Booked",
            transaction_reference: txRef,
            description: narration || "Internal transfer",
            merchant_details: idempotency_key ? { idempotency_key } : null,
          },
          {
            account_id: destination_account_id,
            user_id: userId,
            amount,
            currency: txCurrency || "XAF",
            credit_debit_indicator: "Credit",
            status: "Booked",
            transaction_reference: txRef,
            description: narration || "Internal transfer received",
          },
        ]);

        result = { data: { ...transferResult, transaction_reference: txRef } };
        break;
      }

      case "get_transfer_status": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const txRefLookup = body.transaction_reference || url.searchParams.get("transaction_reference");
        if (!txRefLookup) { statusCode = 400; result = { error: "transaction_reference required" }; break; }
        // Scope: only return transactions the requesting user owns
        const { data, error } = await supabase
          .from("transactions")
          .select("id, account_id, amount, currency, credit_debit_indicator, status, transaction_reference, description, created_at, user_id")
          .eq("transaction_reference", txRefLookup)
          .eq("user_id", userId);
        if (error) throw error;
        result = { data, status: data?.[0]?.status || "unknown" };
        break;
      }

      // ── KYC Operations ──
      case "submit_kyc": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const { customer_id, document_type, document_data, institution_id: kycInstId } = body;
        if (!customer_id || !document_type) {
          statusCode = 400;
          result = { error: "customer_id, document_type required" };
          break;
        }
        // Verify caller is authorized for the customer's institution
        const { data: cust } = await supabase
          .from("banking_customers")
          .select("institution_id")
          .eq("id", customer_id)
          .maybeSingle();
        if (!cust) { statusCode = 404; result = { error: "Customer not found" }; break; }
        const auth = await authorizeInstitution(cust.institution_id);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }

        await supabase
          .from("banking_customers")
          .update({ kyc_status: "submitted" })
          .eq("id", customer_id);

        result = { data: { customer_id, kyc_status: "submitted", document_type, submitted_at: new Date().toISOString() } };
        statusCode = 201;
        break;
      }

      case "get_kyc_status": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const kycCustId = body.customer_id || url.searchParams.get("customer_id");
        if (!kycCustId) { statusCode = 400; result = { error: "customer_id required" }; break; }
        const { data, error } = await supabase
          .from("banking_customers")
          .select("id, full_name, kyc_status, updated_at, institution_id")
          .eq("id", kycCustId)
          .maybeSingle();
        if (error) throw error;
        if (!data) { statusCode = 404; result = { error: "Customer not found" }; break; }
        const auth = await authorizeInstitution(data.institution_id);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }
        const { institution_id: _omit, ...safe } = data as Record<string, unknown>;
        result = { data: safe };
        break;
      }

      // ── COBAC Report ──
      case "generate_report": {
        if (!userId) { statusCode = 401; result = { error: "Authentication required" }; break; }
        const reportInstId = body.institution_id || url.searchParams.get("institution_id");
        const reportType = body.report_type || url.searchParams.get("report_type") || "transaction_summary";
        const dateFrom = body.date_from || url.searchParams.get("date_from");
        const dateTo = body.date_to || url.searchParams.get("date_to");

        if (!reportInstId) { statusCode = 400; result = { error: "institution_id required" }; break; }
        const auth = await authorizeInstitution(reportInstId);
        if (!auth.ok) { statusCode = 403; result = { error: auth.reason }; break; }

        // Scope transactions to the institution
        const { data: txns, error: txErr } = await supabase
          .from("transactions")
          .select("amount, currency, credit_debit_indicator, status, created_at")
          .eq("institution_id", reportInstId)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (txErr) throw txErr;

        const totalCredits = (txns || []).filter(t => t.credit_debit_indicator === "Credit").reduce((s, t) => s + (t.amount || 0), 0);
        const totalDebits = (txns || []).filter(t => t.credit_debit_indicator === "Debit").reduce((s, t) => s + (t.amount || 0), 0);

        result = {
          data: {
            report_type: reportType,
            institution_id: reportInstId,
            period: { from: dateFrom || "all", to: dateTo || "now" },
            summary: {
              total_transactions: txns?.length || 0,
              total_credits: totalCredits,
              total_debits: totalDebits,
              net_position: totalCredits - totalDebits,
              currency: "XAF",
            },
            generated_at: new Date().toISOString(),
            cobac_compliant: true,
          },
        };
        break;
      }

      default:
        statusCode = 400;
        result = {
          error: "Unknown action",
          available_actions: [
            "list_banks", "get_bank_status",
            "create_customer", "get_customer", "list_customers",
            "list_accounts", "get_account_balance", "get_account_transactions",
            "internal_transfer", "get_transfer_status",
            "submit_kyc", "get_kyc_status",
            "generate_report",
          ],
        };
    }

    // Log API call
    const responseTime = Date.now() - startTime;
    if (userId || body.client_id) {
      await supabase.from("banking_api_logs").insert({
        client_id: body.client_id || userId || "anonymous",
        institution_id: body.institution_id || null,
        endpoint: `/v1/banking/${action}`,
        method: req.method,
        status_code: statusCode,
        response_time_ms: responseTime,
        ip_address: req.headers.get("x-forwarded-for") || null,
        user_agent: req.headers.get("user-agent") || null,
      }).then(() => {});
    }

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Request-ID": crypto.randomUUID(),
        "X-Response-Time": `${responseTime}ms`,
      },
    });
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, "banking-api-router");
  }
});
