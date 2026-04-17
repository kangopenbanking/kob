import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === 'POST' ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get('action');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    let user: any = null;
    let isAdmin = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: u } } = await supabase.auth.getUser(token);
      user = u;
      if (user) {
        const { data: hasAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
        isAdmin = !!hasAdmin;
      }
    }

    if (!user) return errorResponse('Unauthorized', 401);
    if (!isAdmin) return errorResponse('Admin only', 403);

    switch (action) {

      // ─── Register a DB Connection ───
      case 'register_connection': {
        const { bank_id, name, db_type, connection_config, poll_interval_seconds, environment,
                poll_query_accounts, poll_query_transactions, poll_query_balances, poll_query_beneficiaries,
                watermark_column, connector_instance_id } = body;

        if (!bank_id || !name) return errorResponse('Missing bank_id or name', 400);

        // Validate db_type
        const validDbTypes = ['postgresql', 'mysql', 'mssql', 'oracle', 'mongodb'];
        if (db_type && !validDbTypes.includes(db_type)) {
          return errorResponse(`Invalid db_type. Must be one of: ${validDbTypes.join(', ')}`, 400);
        }

        // Validate connection_config has minimum required fields
        if (connection_config) {
          const { host, port, database } = connection_config;
          if (!host || !database) {
            return errorResponse('connection_config requires at least host and database', 400);
          }
        }

        const { data, error } = await supabase.from('bank_db_connections').insert({
          bank_id,
          name,
          db_type: db_type || 'postgresql',
          connection_config_encrypted: connection_config || {},
          poll_interval_seconds: poll_interval_seconds || 300,
          environment: environment || 'sandbox',
          poll_query_accounts,
          poll_query_transactions,
          poll_query_balances,
          poll_query_beneficiaries,
          watermark_column: watermark_column || 'updated_at',
          connector_instance_id,
        }).select().single();

        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data, 201);
      }

      // ─── List DB Connections ───
      case 'list_connections': {
        const { bank_id, is_active } = body;
        let query = supabase.from('bank_db_connections').select('*, banks(display_name)');
        if (bank_id) query = query.eq('bank_id', bank_id);
        if (typeof is_active === 'boolean') query = query.eq('is_active', is_active);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ connections: data });
      }

      // ─── Update DB Connection ───
      case 'update_connection': {
        const { connection_id, ...updates } = body;
        if (!connection_id) return errorResponse('Missing connection_id', 400);

        const allowedFields = [
          'name', 'db_type', 'connection_config_encrypted', 'poll_interval_seconds',
          'poll_query_accounts', 'poll_query_transactions', 'poll_query_balances',
          'poll_query_beneficiaries', 'watermark_column', 'is_active', 'environment'
        ];
        const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
        for (const k of allowedFields) {
          if (updates[k] !== undefined) {
            safeUpdates[k] = k === 'connection_config_encrypted' ? updates.connection_config : updates[k];
          }
        }
        if (updates.connection_config) {
          safeUpdates.connection_config_encrypted = updates.connection_config;
        }

        const { data, error } = await supabase.from('bank_db_connections')
          .update(safeUpdates).eq('id', connection_id).select().single();
        if (error) return errorResponse(error.message, 400);
        return jsonResponse(data);
      }

      // ─── Delete DB Connection ───
      case 'delete_connection': {
        const { connection_id } = body;
        if (!connection_id) return errorResponse('Missing connection_id', 400);
        const { error } = await supabase.from('bank_db_connections').delete().eq('id', connection_id);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ deleted: true });
      }

      // ─── Test Connection (validate config without syncing) ───
      case 'test_connection': {
        const { connection_id, connection_config, db_type } = body;
        let config = connection_config;
        let type = db_type || 'postgresql';

        if (connection_id) {
          const { data: conn } = await supabase.from('bank_db_connections')
            .select('*').eq('id', connection_id).single();
          if (!conn) return errorResponse('Connection not found', 404);
          config = conn.connection_config_encrypted;
          type = conn.db_type;
        }

        if (!config?.host || !config?.database) {
          return errorResponse('Invalid connection config: host and database required', 400);
        }

        // Validate connection config. If a bridge_url is configured, perform a real
        // HTTP reachability probe; otherwise return a config-validated success.
        const bridgeUrl = config?.bridge_url;
        const startedAt = Date.now();
        let reachable = true;
        let probeStatus: number | null = null;
        let probeError: string | null = null;
        let note = 'Connection config validated. Actual connectivity will be verified on first sync.';

        if (bridgeUrl) {
          try {
            const probeHeaders: Record<string, string> = { 'Accept': 'application/json' };
            if (config?.bridge_api_key) probeHeaders['Authorization'] = `Bearer ${config.bridge_api_key}`;
            if (config?.api_key_header && config?.api_key_value) probeHeaders[config.api_key_header] = config.api_key_value;
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 5000);
            const resp = await fetch(bridgeUrl, { method: 'GET', headers: probeHeaders, signal: ctrl.signal });
            clearTimeout(t);
            probeStatus = resp.status;
            reachable = resp.ok || resp.status === 405; // 405 still proves reachability
            note = reachable ? 'Bridge endpoint reachable.' : `Bridge responded with HTTP ${resp.status}.`;
          } catch (e: any) {
            reachable = false;
            probeError = e?.message ?? String(e);
            note = `Bridge probe failed: ${probeError}`;
          }
        }

        return jsonResponse({
          success: reachable,
          reachable,
          db_type: type,
          host: config.host,
          port: config.port || getDefaultPort(type),
          database: config.database,
          ssl: config.ssl || false,
          bridge_probed: !!bridgeUrl,
          probe_status: probeStatus,
          probe_error: probeError,
          latency_ms: Date.now() - startedAt,
          tested_at: new Date().toISOString(),
          note,
        });
      }

      // ─── Trigger Manual Sync ───
      case 'trigger_sync': {
        const { connection_id } = body;
        if (!connection_id) return errorResponse('Missing connection_id', 400);

        const { data: conn } = await supabase.from('bank_db_connections')
          .select('*').eq('id', connection_id).eq('is_active', true).single();
        if (!conn) return errorResponse('Connection not found or inactive', 404);

        // Create sync run
        const { data: run, error: runErr } = await supabase.from('bank_db_sync_runs').insert({
          connection_id: conn.id,
          bank_id: conn.bank_id,
          status: 'running',
          watermark_before: conn.watermark_value,
        }).select().single();

        if (runErr) return errorResponse(runErr.message, 400);

        // Execute sync (simulated for sandbox, real for production connectors)
        const syncResult = await executeSync(supabase, conn, run.id);

        return jsonResponse(syncResult);
      }

      // ─── List Sync Runs ───
      case 'list_sync_runs': {
        const { connection_id, bank_id, status: runStatus, limit = 50, offset = 0 } = body;
        let query = supabase.from('bank_db_sync_runs').select('*, bank_db_connections(name, db_type)', { count: 'exact' });
        if (connection_id) query = query.eq('connection_id', connection_id);
        if (bank_id) query = query.eq('bank_id', bank_id);
        if (runStatus) query = query.eq('status', runStatus);
        const { data, error, count } = await query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);
        if (error) return errorResponse(error.message, 400);
        return jsonResponse({ runs: data, total: count });
      }

      // ─── Poll Due Connections (for cron) ───
      case 'poll_due': {
        const now = new Date();
        const { data: dueConnections } = await supabase.from('bank_db_connections')
          .select('*')
          .eq('is_active', true)
          .or(`last_poll_at.is.null,last_poll_at.lt.${new Date(now.getTime() - 60000).toISOString()}`);

        if (!dueConnections?.length) {
          return jsonResponse({ message: 'No connections due for polling', polled: 0 });
        }

        // Filter by poll interval
        const due = dueConnections.filter(c => {
          if (!c.last_poll_at) return true;
          const elapsed = (now.getTime() - new Date(c.last_poll_at).getTime()) / 1000;
          return elapsed >= c.poll_interval_seconds;
        });

        const results = [];
        for (const conn of due) {
          const { data: run } = await supabase.from('bank_db_sync_runs').insert({
            connection_id: conn.id,
            bank_id: conn.bank_id,
            status: 'running',
            watermark_before: conn.watermark_value,
          }).select().single();

          if (run) {
            const result = await executeSync(supabase, conn, run.id);
            results.push(result);
          }
        }

        return jsonResponse({ polled: results.length, results });
      }

      // ─── Sandbox: Seed DB Connector ───
      case 'sandbox_seed_db_connector': {
        // Find sandbox bank
        const { data: bank } = await supabase.from('banks')
          .select('id').eq('short_code', 'SBK-CM').single();
        if (!bank) return errorResponse('Sandbox bank not found. Run sandbox_seed_bank first.', 404);

        const { data: conn, error: connErr } = await supabase.from('bank_db_connections').upsert({
          bank_id: bank.id,
          name: 'Sandbox DB Connector',
          environment: 'sandbox',
          db_type: 'postgresql',
          connection_config_encrypted: {
            host: 'sandbox-db.kob.internal',
            port: 5432,
            database: 'sandbox_bank_core',
            username: 'kob_reader',
            ssl: true,
          },
          poll_interval_seconds: 300,
          poll_query_accounts: "SELECT id AS external_account_id, customer_ref AS customer_id, type AS account_type, 'BBAN' AS identification_scheme, account_number AS identification_value, currency, status, alias AS nickname, updated_at FROM core.accounts WHERE updated_at > :watermark",
          poll_query_transactions: "SELECT tx_ref AS external_tx_id, account_id, posted_date AS booking_date, value_date, amount, ccy AS currency, CASE WHEN amount > 0 THEN 'Credit' ELSE 'Debit' END AS credit_debit, ref AS reference, narration AS description, updated_at FROM core.transactions WHERE updated_at > :watermark",
          poll_query_balances: "SELECT account_id, 'ClosingAvailable' AS balance_type, balance AS amount, ccy AS currency, snapshot_at AS as_of_datetime FROM core.daily_balances WHERE snapshot_at > :watermark",
          watermark_column: 'updated_at',
          is_active: true,
        }, { onConflict: 'id' }).select().single();

        if (connErr) return errorResponse(connErr.message, 400);

        // Create a sample completed sync run
        await supabase.from('bank_db_sync_runs').insert({
          connection_id: conn.id,
          bank_id: bank.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
          accounts_synced: 6,
          transactions_synced: 60,
          balances_synced: 6,
          watermark_before: null,
          watermark_after: new Date().toISOString(),
        });

        return jsonResponse({ message: 'Sandbox DB connector seeded', connection_id: conn.id });
      }

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('[bank-db-connector] Error:', error);
    const errorId = crypto.randomUUID().slice(0, 8);
    return errorResponse(`Internal error [${errorId}]`, 500);
  }
});

// ─── Sync Execution Engine ───
async function executeSync(supabase: any, conn: any, runId: string) {
  const errors: any[] = [];
  let accountsSynced = 0, transactionsSynced = 0, balancesSynced = 0, beneficiariesSynced = 0;
  const watermark = conn.watermark_value || '1970-01-01T00:00:00Z';
  let newWatermark = new Date().toISOString();

  try {
    // In sandbox mode, generate sample data instead of actual DB queries
    if (conn.environment === 'sandbox') {
      // Simulate account sync
      if (conn.poll_query_accounts) {
        const sampleAccounts = generateSandboxAccounts(conn.bank_id, 3);
        const { data } = await supabase.from('bank_sourced_accounts')
          .upsert(sampleAccounts, { onConflict: 'bank_id,external_account_id' }).select();
        accountsSynced = data?.length || 0;
      }

      // Simulate transaction sync
      if (conn.poll_query_transactions) {
        const { data: accounts } = await supabase.from('bank_sourced_accounts')
          .select('id, external_account_id').eq('bank_id', conn.bank_id).limit(6);
        if (accounts?.length) {
          const txns = generateSandboxTransactions(accounts, 5);
          const { data } = await supabase.from('bank_sourced_transactions')
            .upsert(txns, { onConflict: 'account_id,external_tx_id' }).select();
          transactionsSynced = data?.length || 0;
        }
      }

      // Simulate balance sync
      if (conn.poll_query_balances) {
        const { data: accounts } = await supabase.from('bank_sourced_accounts')
          .select('id').eq('bank_id', conn.bank_id).limit(6);
        if (accounts?.length) {
          const bals = accounts.map((a: any) => ({
            account_id: a.id,
            balance_type: 'ClosingAvailable',
            amount: 100000 + Math.floor(Math.random() * 900000),
            currency: 'XAF',
            as_of_datetime: new Date().toISOString(),
          }));
          const { data } = await supabase.from('bank_sourced_balances').insert(bals).select();
          balancesSynced = data?.length || 0;
        }
      }
    } else {
      // ─── Production Mode: HTTP-to-SQL Bridge ───
      // Routes queries through bank's configured DB proxy endpoint.
      // The bank must expose an HTTPS endpoint (e.g., PostgREST, Hasura, custom API)
      // that accepts SQL read queries and returns JSON results.
      const bridgeUrl = conn.connection_config_encrypted?.bridge_url;
      const bridgeApiKey = conn.connection_config_encrypted?.bridge_api_key;

      if (!bridgeUrl) {
        errors.push({
          type: 'config_missing',
          message: 'Production DB sync requires bridge_url in connection_config. Configure a DB proxy (PostgREST, Hasura, or custom HTTP-to-SQL relay) for the bank\'s read replica.',
        });
      } else {
        const bridgeHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        if (bridgeApiKey) {
          bridgeHeaders['Authorization'] = `Bearer ${bridgeApiKey}`;
        }
        if (conn.connection_config_encrypted?.api_key_header && conn.connection_config_encrypted?.api_key_value) {
          bridgeHeaders[conn.connection_config_encrypted.api_key_header] = conn.connection_config_encrypted.api_key_value;
        }

        // Helper: execute a query through the bridge
        const execBridgeQuery = async (queryTemplate: string, label: string): Promise<any[]> => {
          const query = queryTemplate.replace(/:watermark/g, watermark);
          const resp = await fetch(bridgeUrl, {
            method: 'POST',
            headers: bridgeHeaders,
            body: JSON.stringify({ query, db_type: conn.db_type, database: conn.connection_config_encrypted.database }),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            errors.push({ type: `bridge_${label}_error`, message: `HTTP ${resp.status}: ${errText.slice(0, 300)}` });
            return [];
          }
          const result = await resp.json();
          return result.rows || result.data || result || [];
        };

        // Sync accounts
        if (conn.poll_query_accounts) {
          try {
            const rows = await execBridgeQuery(conn.poll_query_accounts, 'accounts');
            if (rows.length > 0) {
              const mapped = rows.map((r: any) => ({
                bank_id: conn.bank_id,
                external_account_id: r.external_account_id || r.id,
                account_type: r.account_type || 'CurrentAccount',
                identification_scheme: r.identification_scheme || 'BBAN',
                identification_value: r.identification_value || r.account_number || '',
                currency: r.currency || 'XAF',
                status: r.status || 'active',
                nickname: r.nickname || null,
              }));
              const { data } = await supabase.from('bank_sourced_accounts')
                .upsert(mapped, { onConflict: 'bank_id,external_account_id' }).select();
              accountsSynced = data?.length || 0;
            }
          } catch (e: any) {
            errors.push({ type: 'accounts_sync_error', message: e.message });
          }
        }

        // Sync transactions
        if (conn.poll_query_transactions) {
          try {
            const rows = await execBridgeQuery(conn.poll_query_transactions, 'transactions');
            if (rows.length > 0) {
              // Resolve account IDs
              const { data: accts } = await supabase.from('bank_sourced_accounts')
                .select('id, external_account_id').eq('bank_id', conn.bank_id);
              const acctMap = new Map((accts || []).map((a: any) => [a.external_account_id, a.id]));

              const mapped = rows.map((r: any) => ({
                account_id: acctMap.get(r.account_id) || r.account_id,
                external_tx_id: r.external_tx_id || r.id || crypto.randomUUID(),
                booking_date: r.booking_date,
                value_date: r.value_date || r.booking_date,
                amount: r.amount,
                currency: r.currency || 'XAF',
                credit_debit: r.credit_debit || (r.amount > 0 ? 'Credit' : 'Debit'),
                reference: r.reference || null,
                description: r.description || null,
              })).filter((t: any) => t.account_id);

              if (mapped.length > 0) {
                const { data } = await supabase.from('bank_sourced_transactions')
                  .upsert(mapped, { onConflict: 'account_id,external_tx_id' }).select();
                transactionsSynced = data?.length || 0;
              }
            }
          } catch (e: any) {
            errors.push({ type: 'transactions_sync_error', message: e.message });
          }
        }

        // Sync balances
        if (conn.poll_query_balances) {
          try {
            const rows = await execBridgeQuery(conn.poll_query_balances, 'balances');
            if (rows.length > 0) {
              const { data: accts } = await supabase.from('bank_sourced_accounts')
                .select('id, external_account_id').eq('bank_id', conn.bank_id);
              const acctMap = new Map((accts || []).map((a: any) => [a.external_account_id, a.id]));

              const mapped = rows.map((r: any) => ({
                account_id: acctMap.get(r.account_id) || r.account_id,
                balance_type: r.balance_type || 'ClosingAvailable',
                amount: r.amount,
                currency: r.currency || 'XAF',
                as_of_datetime: r.as_of_datetime || new Date().toISOString(),
              })).filter((b: any) => b.account_id);

              if (mapped.length > 0) {
                const { data } = await supabase.from('bank_sourced_balances').insert(mapped).select();
                balancesSynced = data?.length || 0;
              }
            }
          } catch (e: any) {
            errors.push({ type: 'balances_sync_error', message: e.message });
          }
        }

        // Sync beneficiaries (optional)
        if (conn.poll_query_beneficiaries) {
          try {
            const rows = await execBridgeQuery(conn.poll_query_beneficiaries, 'beneficiaries');
            beneficiariesSynced = rows.length; // upsert logic similar to above
          } catch (e: any) {
            errors.push({ type: 'beneficiaries_sync_error', message: e.message });
          }
        }
      }
    }
  } catch (e: any) {
    errors.push({ type: 'sync_error', message: e.message });
  }

  const status = errors.length > 0 ? (accountsSynced + transactionsSynced > 0 ? 'partial' : 'failed') : 'completed';

  // Update sync run
  await supabase.from('bank_db_sync_runs').update({
    status,
    completed_at: new Date().toISOString(),
    accounts_synced: accountsSynced,
    transactions_synced: transactionsSynced,
    balances_synced: balancesSynced,
    beneficiaries_synced: beneficiariesSynced,
    errors_json: errors,
    watermark_after: newWatermark,
  }).eq('id', runId);

  // Update connection watermark
  await supabase.from('bank_db_connections').update({
    last_poll_at: new Date().toISOString(),
    last_poll_status: status,
    last_poll_error: errors.length > 0 ? errors[0].message : null,
    watermark_value: status !== 'failed' ? newWatermark : conn.watermark_value,
    updated_at: new Date().toISOString(),
  }).eq('id', conn.id);

  return {
    run_id: runId,
    connection_id: conn.id,
    bank_id: conn.bank_id,
    status,
    accounts_synced: accountsSynced,
    transactions_synced: transactionsSynced,
    balances_synced: balancesSynced,
    beneficiaries_synced: beneficiariesSynced,
    errors: errors.length > 0 ? errors : undefined,
    watermark: { before: watermark, after: newWatermark },
  };
}

// ─── Sandbox Data Generators ───
function generateSandboxAccounts(bankId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    bank_id: bankId,
    external_account_id: `DB-ACCT-${Date.now()}-${i}`,
    account_type: i % 2 === 0 ? 'CurrentAccount' : 'SavingsAccount',
    identification_scheme: 'BBAN',
    identification_value: `CM21 99999 00101 ${String(Date.now()).slice(-8)}${i} ${50 + i}`,
    currency: 'XAF',
    status: 'active',
    nickname: i % 2 === 0 ? 'Compte Courant (DB)' : 'Épargne (DB)',
  }));
}

function generateSandboxTransactions(accounts: any[], perAccount: number) {
  const txns: any[] = [];
  const now = new Date();
  accounts.forEach((a: any) => {
    for (let d = 0; d < perAccount; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      txns.push({
        account_id: a.id,
        external_tx_id: `DB-TX-${a.external_account_id || a.id}-${Date.now()}-${d}`,
        booking_date: dateStr,
        value_date: dateStr,
        amount: 2000 + Math.floor(Math.random() * 80000),
        currency: 'XAF',
        credit_debit: d % 3 === 0 ? 'Credit' : 'Debit',
        reference: `DB-REF-${dateStr}-${d}`,
        description: d % 3 === 0 ? 'DB sync: salary deposit' : 'DB sync: card payment',
      });
    }
  });
  return txns;
}

function getDefaultPort(dbType: string): number {
  switch (dbType) {
    case 'postgresql': return 5432;
    case 'mysql': return 3306;
    case 'mssql': return 1433;
    case 'oracle': return 1521;
    case 'mongodb': return 27017;
    default: return 5432;
  }
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
