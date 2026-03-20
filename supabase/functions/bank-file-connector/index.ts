import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── CSV Parser ───
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
  return { headers, rows };
}

// ─── Mapping Transforms ───
function applyTransform(value: string, transform: string): string {
  switch (transform) {
    case 'trim': return value.trim();
    case 'uppercase': return value.toUpperCase();
    case 'lowercase': return value.toLowerCase();
    case 'parseDecimal': return String(parseFloat(value.replace(/[^0-9.-]/g, '')) || 0);
    case 'parsePhone': {
      let phone = value.replace(/[^0-9+]/g, '');
      if (phone.startsWith('6') || phone.startsWith('2')) phone = '+237' + phone;
      return phone;
    }
    case 'maskAccount': return value.length > 4 ? '***' + value.slice(-4) : value;
    default: return value;
  }
}

function applyMapping(row: Record<string, string>, mappingJson: any): Record<string, any> {
  const result: Record<string, any> = {};
  const fields = mappingJson.fields || mappingJson;
  for (const [targetField, config] of Object.entries(fields as Record<string, any>)) {
    const sourceField = typeof config === 'string' ? config : config.source;
    let value = row[sourceField] || '';
    if (typeof config === 'object' && config.transforms) {
      for (const t of config.transforms) {
        value = applyTransform(value, t);
      }
    }
    if (typeof config === 'object' && config.default && !value) {
      value = config.default;
    }
    result[targetField] = value;
  }
  return result;
}

// ─── Validation ───
interface ValidationResult { valid: boolean; errors: string[] }

function validateRow(row: Record<string, any>, fileType: string): ValidationResult {
  const errors: string[] = [];
  
  if (fileType === 'accounts') {
    if (!row.external_account_id && !row.account_number) errors.push('Missing account identifier');
    if (!row.account_type) errors.push('Missing account_type');
  } else if (fileType === 'transactions') {
    if (!row.external_tx_id && !row.reference) errors.push('Missing transaction identifier');
    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount < 0) errors.push('Invalid amount');
    if (!row.booking_date) errors.push('Missing booking_date');
    if (row.booking_date) {
      const d = new Date(row.booking_date);
      if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) errors.push('Invalid booking_date range');
    }
    if (row.credit_debit && !['Credit', 'Debit', 'credit', 'debit', 'C', 'D'].includes(row.credit_debit)) errors.push('Invalid credit_debit indicator');
  } else if (fileType === 'balances') {
    const amount = parseFloat(row.amount);
    if (isNaN(amount)) errors.push('Invalid balance amount');
    if (!row.as_of_datetime && !row.balance_date) errors.push('Missing balance date');
  } else if (fileType === 'beneficiaries') {
    if (!row.beneficiary_name) errors.push('Missing beneficiary_name');
  }

  if (!row.currency) row.currency = 'XAF';
  
  return { valid: errors.length === 0, errors };
}

// ─── SHA-256 Hash ───
async function computeSHA256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Pain.001 Generator ───
function generatePain001(batch: any, items: any[], bank: any): string {
  const now = new Date().toISOString();
  const msgId = `KOB-${batch.id.slice(0, 8)}-${Date.now()}`;
  const totalAmount = items.reduce((s: number, i: any) => s + Number(i.amount), 0);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${now}</CreDtTm>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>Kang Open Banking</Nm><Id><OrgId><Othr><Id>KOB-CM</Id></Othr></OrgId></Id></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${batch.id}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${items.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <ReqdExctnDt><Dt>${now.slice(0, 10)}</Dt></ReqdExctnDt>
      <Dbtr><Nm>Kang Open Banking Platform</Nm></Dbtr>
      <DbtrAcct><Id><Othr><Id>KOB-MAIN</Id></Othr></Id><Ccy>XAF</Ccy></DbtrAcct>
      <DbtrAgt><FinInstnId><BICFI>${bank?.swift_bic || 'NOTPROVIDED'}</BICFI></FinInstnId></DbtrAgt>
${items.map((item: any, idx: number) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${item.reference}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="${item.currency || 'XAF'}">${Number(item.amount).toFixed(2)}</InstdAmt></Amt>
        <CdtrAgt><FinInstnId><BICFI>${item.beneficiary_bank_code || 'NOTPROVIDED'}</BICFI></FinInstnId></CdtrAgt>
        <Cdtr><Nm>${item.beneficiary_name}</Nm></Cdtr>
        <CdtrAcct><Id><Othr><Id>${item.beneficiary_account_number}</Id></Othr></Id></CdtrAcct>
        <RmtInf><Ustrd>${item.narration || ''}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join('\n')}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

// ─── CSV Batch Generator ───
function generateBatchCSV(items: any[]): string {
  const headers = ['reference', 'beneficiary_name', 'beneficiary_account_number', 'beneficiary_bank_code', 'amount', 'currency', 'narration'];
  const rows = items.map((i: any) => headers.map(h => `"${(i[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// ─── Sandbox File Generator ───
function generateSandboxCSV(fileType: string): string {
  if (fileType === 'accounts') {
    return `external_account_id,account_type,identification_scheme,identification_value,currency,status,nickname
SBX-ACC-001,CurrentAccount,CM_RIB,10001-00001-0000000001-01,XAF,active,Compte Courant
SBX-ACC-002,SavingsAccount,CM_RIB,10001-00001-0000000002-02,XAF,active,Epargne
SBX-ACC-003,CurrentAccount,CM_RIB,10001-00002-0000000003-03,XAF,active,Business Account`;
  } else if (fileType === 'transactions') {
    return `external_tx_id,account_id,booking_date,value_date,amount,currency,credit_debit,reference,description
SBX-TX-001,SBX-ACC-001,2026-03-15,2026-03-15,50000,XAF,Credit,SAL-2026-03,Salary March
SBX-TX-002,SBX-ACC-001,2026-03-16,2026-03-16,15000,XAF,Debit,MTN-TOP,MTN Mobile Recharge
SBX-TX-003,SBX-ACC-001,2026-03-17,2026-03-17,25000,XAF,Debit,RENT-03,Rent Payment
SBX-TX-004,SBX-ACC-002,2026-03-18,2026-03-18,100000,XAF,Credit,DEP-001,Cash Deposit
SBX-TX-005,SBX-ACC-001,2026-03-15,2026-03-15,50000,XAF,Credit,SAL-2026-03,Salary March`;
  } else if (fileType === 'balances') {
    return `account_id,balance_type,amount,currency,as_of_datetime
SBX-ACC-001,ClosingAvailable,185000,XAF,2026-03-18T23:59:59Z
SBX-ACC-002,ClosingAvailable,350000,XAF,2026-03-18T23:59:59Z
SBX-ACC-003,ClosingAvailable,1200000,XAF,2026-03-18T23:59:59Z`;
  } else if (fileType === 'beneficiaries') {
    return `account_id,beneficiary_name,scheme_name,identification,bank_id_code
SBX-ACC-001,Jean Pierre Kamga,CM_RIB,20002-00005-0000000099-88,AFRILAND
SBX-ACC-001,Marie Ngono,CM_MOBILE,+237670123456,MTN_CM`;
  } else if (fileType === 'payment_status') {
    return `reference,status,executed_at,bank_tx_id,reason_code,reason_message
ref-001,executed,2026-03-19T10:00:00Z,BNK-TX-9001,,
ref-002,executed,2026-03-19T10:01:00Z,BNK-TX-9002,,
ref-003,failed,,,,Insufficient funds in debtor account`;
  }
  return '';
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let action: string;
    let params: any;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      action = url.searchParams.get('action') || '';
      params = Object.fromEntries(url.searchParams.entries());
    } else {
      const body = await req.json().catch(() => ({}));
      action = body.action || '';
      params = body;
    }

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ═══════════════════════════════════════════════════
    // UPLOAD & REGISTRY
    // ═══════════════════════════════════════════════════
    
    if (action === 'upload_file') {
      const { bank_id, file_type, environment = 'sandbox', file_content, filename } = params;
      if (!bank_id || !file_type || !file_content || !filename) {
        return new Response(JSON.stringify({ error: 'Missing required fields: bank_id, file_type, file_content, filename' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(file_content);
      const fileHash = await computeSHA256(data);

      // Check for duplicate
      const { data: existing } = await supabase
        .from('bank_file_uploads')
        .select('id')
        .eq('bank_id', bank_id)
        .eq('file_type', file_type)
        .eq('file_hash_sha256', fileHash)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'Duplicate file — same content already uploaded', existing_file_id: existing.id }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Store in bucket
      const storagePath = `${bank_id}/${environment}/${file_type}/${Date.now()}_${filename}`;
      const { error: storageError } = await supabase.storage
        .from('bank-files')
        .upload(storagePath, data, { contentType: 'text/csv', upsert: false });

      if (storageError) {
        console.error('Storage error:', storageError);
        return new Response(JSON.stringify({ error: 'Failed to store file', details: storageError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Register in DB
      const { data: fileRecord, error: dbError } = await supabase
        .from('bank_file_uploads')
        .insert({
          bank_id,
          environment,
          file_type,
          original_filename: filename,
          storage_path: storagePath,
          file_hash_sha256: fileHash,
          file_size: data.length,
          uploaded_by: params.uploaded_by || 'portal',
          uploader_user_id: params.uploader_user_id || null,
          status: 'received'
        })
        .select()
        .single();

      if (dbError) {
        return new Response(JSON.stringify({ error: 'Failed to register file', details: dbError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ file: fileRecord }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_files') {
      let query = supabase.from('bank_file_uploads').select('*, banks(display_name, short_code)').order('created_at', { ascending: false });
      if (params.bank_id) query = query.eq('bank_id', params.bank_id);
      if (params.file_type) query = query.eq('file_type', params.file_type);
      if (params.status) query = query.eq('status', params.status);
      query = query.limit(params.limit || 100);

      const { data, error } = await query;
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ files: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_file') {
      const { file_id } = params;
      const { data: file } = await supabase.from('bank_file_uploads').select('*, banks(display_name)').eq('id', file_id).single();
      const { data: rows } = await supabase.from('bank_file_rows').select('*').eq('file_id', file_id).order('row_number');
      const { data: runs } = await supabase.from('ingestion_runs').select('*').eq('file_id', file_id).order('started_at', { ascending: false });
      return new Response(JSON.stringify({ file, rows, runs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'download_file') {
      const { file_id } = params;
      const { data: file } = await supabase.from('bank_file_uploads').select('storage_path').eq('id', file_id).single();
      if (!file?.storage_path) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: signedUrl } = await supabase.storage.from('bank-files').createSignedUrl(file.storage_path, 3600);
      return new Response(JSON.stringify({ url: signedUrl?.signedUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════
    // MAPPING MANAGEMENT
    // ═══════════════════════════════════════════════════

    if (action === 'create_mapping') {
      const { bank_id, file_type, mapping_json } = params;
      // Deactivate existing active mapping for this bank+file_type
      await supabase.from('bank_data_mappings').update({ is_active: false }).eq('bank_id', bank_id).eq('file_type', file_type).eq('is_active', true);
      
      const { data: maxVersion } = await supabase.from('bank_data_mappings').select('version').eq('bank_id', bank_id).eq('file_type', file_type).order('version', { ascending: false }).limit(1).maybeSingle();
      
      const { data, error } = await supabase.from('bank_data_mappings').insert({
        bank_id, file_type,
        version: (maxVersion?.version || 0) + 1,
        mapping_json, is_active: true
      }).select().single();

      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ mapping: data }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'list_mappings') {
      let query = supabase.from('bank_data_mappings').select('*, banks(display_name)').order('created_at', { ascending: false });
      if (params.bank_id) query = query.eq('bank_id', params.bank_id);
      if (params.active_only) query = query.eq('is_active', true);
      const { data } = await query;
      return new Response(JSON.stringify({ mappings: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'preview_mapping') {
      const { file_id, mapping_id } = params;
      const { data: file } = await supabase.from('bank_file_uploads').select('storage_path').eq('id', file_id).single();
      const { data: mapping } = await supabase.from('bank_data_mappings').select('mapping_json').eq('id', mapping_id).single();
      if (!file || !mapping) return new Response(JSON.stringify({ error: 'File or mapping not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: fileData } = await supabase.storage.from('bank-files').download(file.storage_path);
      const text = await fileData!.text();
      const { rows } = parseCSV(text);
      const preview = rows.slice(0, 5).map(r => applyMapping(r, mapping.mapping_json));
      return new Response(JSON.stringify({ preview, total_rows: rows.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════
    // INGESTION PIPELINE
    // ═══════════════════════════════════════════════════

    if (action === 'run_ingestion') {
      const { file_id } = params;
      
      // Get file record
      const { data: file } = await supabase.from('bank_file_uploads').select('*').eq('id', file_id).single();
      if (!file) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Update status to validating
      await supabase.from('bank_file_uploads').update({ status: 'validating' }).eq('id', file_id);

      // Get mapping profile
      const { data: mapping } = await supabase.from('bank_data_mappings')
        .select('mapping_json')
        .eq('bank_id', file.bank_id)
        .eq('file_type', file.file_type)
        .eq('is_active', true)
        .maybeSingle();

      // Download file
      const { data: fileData } = await supabase.storage.from('bank-files').download(file.storage_path!);
      const text = await fileData!.text();
      const { rows } = parseCSV(text);

      // Create ingestion run
      const { data: run } = await supabase.from('ingestion_runs').insert({
        file_id, bank_id: file.bank_id, status: 'running',
        correlation_id: file.correlation_id
      }).select().single();

      let rowsOk = 0, rowsInvalid = 0, rowsDuplicate = 0;
      const fileRows: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const normalized = mapping ? applyMapping(rawRow, mapping.mapping_json) : rawRow;
        normalized.currency = normalized.currency || 'XAF';

        const validation = validateRow(normalized, file.file_type);
        
        if (!validation.valid) {
          rowsInvalid++;
          fileRows.push({
            file_id, row_number: i + 1,
            raw_json: rawRow, normalized_json: normalized,
            status: 'invalid',
            error_id: `ERR-${file_id.slice(0, 8)}-${i + 1}`,
            error_details: validation.errors.join('; ')
          });
          continue;
        }

        // Attempt upsert based on file_type
        let upsertError = null;
        let isDuplicate = false;

        if (file.file_type === 'accounts') {
          const extId = normalized.external_account_id || normalized.account_number || `${file.bank_id}-${i}`;
          const { error: existsErr, data: existingAcc } = await supabase
            .from('bank_sourced_accounts')
            .select('id')
            .eq('bank_id', file.bank_id)
            .eq('external_account_id', extId)
            .maybeSingle();
          
          if (existingAcc) {
            isDuplicate = true;
            // Update existing
            await supabase.from('bank_sourced_accounts').update({
              account_type: normalized.account_type || 'CurrentAccount',
              identification_scheme: normalized.identification_scheme,
              identification_value: normalized.identification_value,
              currency: normalized.currency,
              status: normalized.status || 'active',
              nickname: normalized.nickname,
              source_file_id: file_id,
              source_row_number: i + 1,
              updated_at: new Date().toISOString()
            }).eq('id', existingAcc.id);
          } else {
            const { error } = await supabase.from('bank_sourced_accounts').insert({
              bank_id: file.bank_id,
              external_account_id: extId,
              account_type: normalized.account_type || 'CurrentAccount',
              identification_scheme: normalized.identification_scheme,
              identification_value: normalized.identification_value,
              currency: normalized.currency,
              status: normalized.status || 'active',
              nickname: normalized.nickname,
              source_file_id: file_id,
              source_row_number: i + 1
            });
            upsertError = error;
          }
        } else if (file.file_type === 'transactions') {
          const extTxId = normalized.external_tx_id || `${file.bank_id}-${normalized.booking_date}-${normalized.amount}-${normalized.reference || i}`;
          
          // Find account
          const accountId = normalized.account_id;
          const { data: account } = await supabase.from('bank_sourced_accounts')
            .select('id')
            .eq('bank_id', file.bank_id)
            .eq('external_account_id', accountId)
            .maybeSingle();

          if (!account) {
            rowsInvalid++;
            fileRows.push({
              file_id, row_number: i + 1,
              raw_json: rawRow, normalized_json: normalized,
              status: 'invalid',
              error_id: `ERR-${file_id.slice(0, 8)}-${i + 1}`,
              error_details: `Account not found: ${accountId}`
            });
            continue;
          }

          const { data: existingTx } = await supabase.from('bank_sourced_transactions')
            .select('id').eq('external_tx_id', extTxId).eq('account_id', account.id).maybeSingle();

          if (existingTx) {
            isDuplicate = true;
          } else {
            const creditDebit = (normalized.credit_debit || 'Debit').toLowerCase().startsWith('c') ? 'Credit' : 'Debit';
            const { error } = await supabase.from('bank_sourced_transactions').insert({
              account_id: account.id,
              external_tx_id: extTxId,
              booking_date: normalized.booking_date,
              value_date: normalized.value_date || normalized.booking_date,
              amount: parseFloat(normalized.amount),
              currency: normalized.currency,
              credit_debit: creditDebit,
              reference: normalized.reference,
              description: normalized.description,
              source_file_id: file_id,
              source_row_number: i + 1
            });
            upsertError = error;
          }
        } else if (file.file_type === 'balances') {
          const accountId = normalized.account_id;
          const { data: account } = await supabase.from('bank_sourced_accounts')
            .select('id').eq('bank_id', file.bank_id).eq('external_account_id', accountId).maybeSingle();
          
          if (!account) {
            rowsInvalid++;
            fileRows.push({
              file_id, row_number: i + 1, raw_json: rawRow, normalized_json: normalized,
              status: 'invalid', error_details: `Account not found: ${accountId}`
            });
            continue;
          }

          const asOf = normalized.as_of_datetime || normalized.balance_date || new Date().toISOString();
          const { data: existingBal } = await supabase.from('bank_sourced_balances')
            .select('id').eq('account_id', account.id).eq('as_of_datetime', asOf).maybeSingle();

          if (existingBal) {
            isDuplicate = true;
            await supabase.from('bank_sourced_balances').update({
              amount: parseFloat(normalized.amount),
              balance_type: normalized.balance_type || 'ClosingAvailable',
              currency: normalized.currency,
              source_file_id: file_id, source_row_number: i + 1
            }).eq('id', existingBal.id);
          } else {
            const { error } = await supabase.from('bank_sourced_balances').insert({
              account_id: account.id,
              balance_type: normalized.balance_type || 'ClosingAvailable',
              amount: parseFloat(normalized.amount),
              currency: normalized.currency,
              as_of_datetime: asOf,
              source_file_id: file_id, source_row_number: i + 1
            });
            upsertError = error;
          }
        } else if (file.file_type === 'beneficiaries') {
          const accountId = normalized.account_id;
          const { data: account } = await supabase.from('bank_sourced_accounts')
            .select('id').eq('bank_id', file.bank_id).eq('external_account_id', accountId).maybeSingle();
          
          if (!account) {
            rowsInvalid++;
            fileRows.push({
              file_id, row_number: i + 1, raw_json: rawRow, normalized_json: normalized,
              status: 'invalid', error_details: `Account not found: ${accountId}`
            });
            continue;
          }

          const { data: existingBen } = await supabase.from('bank_sourced_beneficiaries')
            .select('id').eq('account_id', account.id).eq('beneficiary_name', normalized.beneficiary_name).maybeSingle();

          if (existingBen) { isDuplicate = true; } else {
            const { error } = await supabase.from('bank_sourced_beneficiaries').insert({
              account_id: account.id,
              beneficiary_name: normalized.beneficiary_name,
              scheme_name: normalized.scheme_name,
              identification: normalized.identification,
              bank_id_code: normalized.bank_id_code,
              source_file_id: file_id, source_row_number: i + 1
            });
            upsertError = error;
          }
        }

        if (isDuplicate) {
          rowsDuplicate++;
          fileRows.push({ file_id, row_number: i + 1, raw_json: rawRow, normalized_json: normalized, status: 'duplicate' });
        } else if (upsertError) {
          rowsInvalid++;
          fileRows.push({ file_id, row_number: i + 1, raw_json: rawRow, normalized_json: normalized, status: 'invalid', error_details: upsertError.message });
        } else {
          rowsOk++;
          fileRows.push({ file_id, row_number: i + 1, raw_json: rawRow, normalized_json: normalized, status: 'ok' });
        }
      }

      // Batch insert file rows (in chunks of 100)
      for (let c = 0; c < fileRows.length; c += 100) {
        await supabase.from('bank_file_rows').insert(fileRows.slice(c, c + 100));
      }

      // Update run
      const totals = { rows_total: rows.length, rows_ok: rowsOk, rows_invalid: rowsInvalid, rows_duplicate: rowsDuplicate };
      await supabase.from('ingestion_runs').update({
        finished_at: new Date().toISOString(),
        totals_json: totals,
        status: rowsInvalid > 0 && rowsOk === 0 ? 'failed' : 'completed'
      }).eq('id', run!.id);

      // Update file status
      await supabase.from('bank_file_uploads').update({
        status: rowsOk > 0 ? 'processed' : 'failed',
        processed_at: new Date().toISOString(),
        error_summary: rowsInvalid > 0 ? `${rowsInvalid} invalid rows` : null
      }).eq('id', file_id);

      return new Response(JSON.stringify({ run_id: run!.id, totals }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'get_ingestion_run') {
      const { run_id } = params;
      const { data } = await supabase.from('ingestion_runs').select('*, bank_file_uploads(original_filename, file_type)').eq('id', run_id).single();
      return new Response(JSON.stringify({ run: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'download_errors') {
      const { file_id } = params;
      const { data: errorRows } = await supabase.from('bank_file_rows')
        .select('row_number, raw_json, error_id, error_details')
        .eq('file_id', file_id)
        .in('status', ['invalid', 'duplicate'])
        .order('row_number');

      const csv = ['row_number,status,error_id,error_details,raw_data',
        ...(errorRows || []).map(r => `${r.row_number},"${r.error_id || ''}","${(r.error_details || '').replace(/"/g, '""')}","${JSON.stringify(r.raw_json || {}).replace(/"/g, '""')}"`)
      ].join('\n');

      return new Response(csv, { headers: { ...corsHeaders, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=errors_${file_id.slice(0, 8)}.csv` } });
    }

    // ═══════════════════════════════════════════════════
    // BATCH PAYMENT GENERATOR
    // ═══════════════════════════════════════════════════

    if (action === 'create_batch') {
      const { bank_id, environment = 'sandbox', batch_type = 'outgoing_transfers', items, created_by } = params;
      if (!bank_id || !items || !Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ error: 'bank_id and items[] required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const totalAmount = items.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

      const { data: batch, error: batchErr } = await supabase.from('bank_batch_jobs').insert({
        bank_id, environment, batch_type, created_by,
        totals_json: { count: items.length, total_amount: totalAmount },
        status: 'draft'
      }).select().single();

      if (batchErr) return new Response(JSON.stringify({ error: batchErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const batchItems = items.map((item: any) => ({
        batch_id: batch!.id,
        beneficiary_name: item.beneficiary_name,
        beneficiary_account_number: item.beneficiary_account_number,
        beneficiary_bank_code: item.beneficiary_bank_code || null,
        amount: Number(item.amount),
        currency: item.currency || 'XAF',
        narration: item.narration || null,
        reference: item.reference || crypto.randomUUID(),
        internal_payment_id: item.internal_payment_id || null
      }));

      const { error: itemsErr } = await supabase.from('bank_batch_items').insert(batchItems);
      if (itemsErr) return new Response(JSON.stringify({ error: itemsErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      return new Response(JSON.stringify({ batch }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'generate_batch_file') {
      const { batch_id, format = 'csv' } = params;
      
      const { data: batch } = await supabase.from('bank_batch_jobs').select('*, banks(display_name, swift_bic, short_code)').eq('id', batch_id).single();
      if (!batch) return new Response(JSON.stringify({ error: 'Batch not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: items } = await supabase.from('bank_batch_items').select('*').eq('batch_id', batch_id);
      if (!items?.length) return new Response(JSON.stringify({ error: 'No items in batch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      let fileContent: string;
      let filename: string;
      let contentType: string;

      if (format === 'pain001') {
        fileContent = generatePain001(batch, items, batch.banks);
        filename = `pain001_${batch_id.slice(0, 8)}_${Date.now()}.xml`;
        contentType = 'application/xml';
      } else {
        fileContent = generateBatchCSV(items);
        filename = `batch_${batch_id.slice(0, 8)}_${Date.now()}.csv`;
        contentType = 'text/csv';
      }

      const encoder = new TextEncoder();
      const data = encoder.encode(fileContent);
      const fileHash = await computeSHA256(data);
      const storagePath = `${batch.bank_id}/${batch.environment}/payment_instructions/${filename}`;

      await supabase.storage.from('bank-files').upload(storagePath, data, { contentType, upsert: false });

      const { data: fileRecord } = await supabase.from('bank_file_uploads').insert({
        bank_id: batch.bank_id, environment: batch.environment,
        file_type: 'payment_instructions',
        original_filename: filename, storage_path: storagePath,
        file_hash_sha256: fileHash, file_size: data.length,
        uploaded_by: 'admin', status: 'processed'
      }).select().single();

      // Update batch with file reference
      await supabase.from('bank_batch_jobs').update({
        file_id: fileRecord!.id, status: 'generated', updated_at: new Date().toISOString()
      }).eq('id', batch_id);

      // Update items to submitted
      await supabase.from('bank_batch_items').update({ status: 'submitted' }).eq('batch_id', batch_id);

      return new Response(JSON.stringify({ file: fileRecord, content: fileContent }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'list_batches') {
      let query = supabase.from('bank_batch_jobs').select('*, banks(display_name, short_code)').order('created_at', { ascending: false });
      if (params.bank_id) query = query.eq('bank_id', params.bank_id);
      if (params.status) query = query.eq('status', params.status);
      query = query.limit(params.limit || 100);
      const { data } = await query;
      return new Response(JSON.stringify({ batches: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_batch') {
      const { batch_id } = params;
      const { data: batch } = await supabase.from('bank_batch_jobs').select('*, banks(display_name)').eq('id', batch_id).single();
      const { data: items } = await supabase.from('bank_batch_items').select('*').eq('batch_id', batch_id).order('created_at');
      const { data: events } = await supabase.from('bank_status_events')
        .select('*')
        .in('batch_item_id', (items || []).map((i: any) => i.id))
        .order('created_at');
      return new Response(JSON.stringify({ batch, items, events }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'download_batch_file') {
      const { batch_id } = params;
      const { data: batch } = await supabase.from('bank_batch_jobs').select('file_id').eq('id', batch_id).single();
      if (!batch?.file_id) return new Response(JSON.stringify({ error: 'No file generated' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: file } = await supabase.from('bank_file_uploads').select('storage_path').eq('id', batch.file_id).single();
      const { data: signedUrl } = await supabase.storage.from('bank-files').createSignedUrl(file!.storage_path!, 3600);
      return new Response(JSON.stringify({ url: signedUrl?.signedUrl }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════
    // STATUS FILE INGESTION + RECONCILIATION
    // ═══════════════════════════════════════════════════

    if (action === 'ingest_status_file') {
      const { file_id } = params;
      
      const { data: file } = await supabase.from('bank_file_uploads').select('*').eq('id', file_id).single();
      if (!file) return new Response(JSON.stringify({ error: 'File not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: fileData } = await supabase.storage.from('bank-files').download(file.storage_path!);
      const text = await fileData!.text();
      const { rows } = parseCSV(text);

      let matched = 0, unmatched = 0, executed = 0, failed = 0;
      const mismatches: any[] = [];

      for (const row of rows) {
        const reference = row.reference || row.ref;
        if (!reference) { unmatched++; mismatches.push({ row, reason: 'missing_reference' }); continue; }

        const { data: item } = await supabase.from('bank_batch_items')
          .select('id, batch_id, amount, status')
          .eq('reference', reference)
          .maybeSingle();

        if (!item) { unmatched++; mismatches.push({ reference, reason: 'unknown_reference' }); continue; }

        matched++;
        const newStatus = (row.status || '').toLowerCase();

        // Record status event
        await supabase.from('bank_status_events').insert({
          batch_item_id: item.id,
          status: newStatus,
          bank_tx_id: row.bank_tx_id || null,
          raw_row_json: row
        });

        // Update item status
        if (newStatus === 'executed' || newStatus === 'completed' || newStatus === 'success') {
          await supabase.from('bank_batch_items').update({ status: 'executed', bank_response_code: row.reason_code || null, bank_response_message: row.reason_message || null }).eq('id', item.id);
          executed++;
        } else if (newStatus === 'failed' || newStatus === 'rejected') {
          await supabase.from('bank_batch_items').update({ status: 'failed', bank_response_code: row.reason_code || null, bank_response_message: row.reason_message || null }).eq('id', item.id);
          failed++;
        }
      }

      // Update batch aggregate status
      if (matched > 0) {
        const batchRef = rows[0]?.reference;
        const { data: sampleItem } = await supabase.from('bank_batch_items').select('batch_id').eq('reference', batchRef).maybeSingle();
        if (sampleItem) {
          const { data: allItems } = await supabase.from('bank_batch_items').select('status').eq('batch_id', sampleItem.batch_id);
          const statuses = allItems?.map((i: any) => i.status) || [];
          const allExecuted = statuses.every((s: string) => s === 'executed');
          const allFailed = statuses.every((s: string) => s === 'failed');
          const batchStatus = allExecuted ? 'executed' : allFailed ? 'failed' : 'partially_failed';
          await supabase.from('bank_batch_jobs').update({ status: batchStatus, updated_at: new Date().toISOString() }).eq('id', sampleItem.batch_id);
        }
      }

      // Update file status
      await supabase.from('bank_file_uploads').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', file_id);

      return new Response(JSON.stringify({
        summary: { matched, unmatched, executed, failed, total_rows: rows.length },
        mismatches
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_reconciliation_summary') {
      const { batch_id } = params;
      const { data: batch } = await supabase.from('bank_batch_jobs').select('*').eq('id', batch_id).single();
      const { data: items } = await supabase.from('bank_batch_items').select('*').eq('batch_id', batch_id);
      
      const summary = {
        batch_id,
        batch_status: batch?.status,
        total_items: items?.length || 0,
        executed: items?.filter((i: any) => i.status === 'executed').length || 0,
        failed: items?.filter((i: any) => i.status === 'failed').length || 0,
        pending: items?.filter((i: any) => i.status === 'pending' || i.status === 'submitted').length || 0,
        total_amount: items?.reduce((s: number, i: any) => s + Number(i.amount), 0) || 0,
        executed_amount: items?.filter((i: any) => i.status === 'executed').reduce((s: number, i: any) => s + Number(i.amount), 0) || 0,
        failed_amount: items?.filter((i: any) => i.status === 'failed').reduce((s: number, i: any) => s + Number(i.amount), 0) || 0
      };

      return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══════════════════════════════════════════════════
    // SANDBOX
    // ═══════════════════════════════════════════════════

    if (action === 'generate_sandbox_files') {
      const { bank_id, file_types } = params;
      const types = file_types || ['accounts', 'transactions', 'balances', 'beneficiaries', 'payment_status'];
      const results: any[] = [];

      for (const ft of types) {
        const content = generateSandboxCSV(ft);
        if (!content) continue;
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const fileHash = await computeSHA256(data);
        const filename = `sandbox_${ft}_${Date.now()}.csv`;
        const storagePath = `${bank_id}/sandbox/${ft}/${filename}`;

        await supabase.storage.from('bank-files').upload(storagePath, data, { contentType: 'text/csv', upsert: true });

        const { data: record } = await supabase.from('bank_file_uploads').insert({
          bank_id, environment: 'sandbox', file_type: ft,
          original_filename: filename, storage_path: storagePath,
          file_hash_sha256: fileHash, file_size: data.length,
          uploaded_by: 'admin', status: 'received'
        }).select().single();

        results.push(record);
      }

      return new Response(JSON.stringify({ files: results }), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('bank-file-connector error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      error_id: crypto.randomUUID().slice(0, 8)
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
