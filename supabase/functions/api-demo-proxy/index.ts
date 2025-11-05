import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (IP -> { count, resetAt })
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

// Hash IP address for privacy
async function hashIpAddress(ipAddress: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ipAddress);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Mock data generators
function generateMockAccountBalance() {
  return {
    account_id: "ACC-DEMO-001",
    account_name: "Demo Checking Account",
    currency: "XAF",
    available_balance: 1250000 + Math.random() * 500000,
    current_balance: 1500000 + Math.random() * 500000,
    balance_type: "InterimAvailable",
    balance_datetime: new Date().toISOString(),
  };
}

function generateMockTransactions() {
  const merchants = ["SuperMarket Express", "Gas Station", "Restaurant Le Bistro", "Amazon", "Netflix"];
  const types = ["debit", "credit"];
  
  return Array.from({ length: 5 }, (_, i) => ({
    transaction_id: `TXN-DEMO-${1000 + i}`,
    amount: (Math.random() * 50000 + 5000).toFixed(2),
    currency: "XAF",
    type: types[Math.floor(Math.random() * types.length)],
    merchant_name: merchants[Math.floor(Math.random() * merchants.length)],
    transaction_date: new Date(Date.now() - i * 86400000).toISOString(),
    status: "completed",
  }));
}

function generateMockPaymentStatus() {
  const statuses = ["completed", "pending", "processing"];
  return {
    payment_id: `PAY-DEMO-${Date.now()}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    amount: 25000,
    currency: "XAF",
    created_at: new Date().toISOString(),
    recipient: "Demo Merchant",
  };
}

function generateMockCreditScore() {
  return {
    score: Math.floor(Math.random() * 200) + 600,
    score_type: "CrediQ",
    calculated_at: new Date().toISOString(),
    factors: [
      { name: "Payment History", weight: 35, score: Math.floor(Math.random() * 100) },
      { name: "Credit Utilization", weight: 30, score: Math.floor(Math.random() * 100) },
      { name: "Credit Age", weight: 15, score: Math.floor(Math.random() * 100) },
      { name: "Account Diversity", weight: 10, score: Math.floor(Math.random() * 100) },
      { name: "Recent Inquiries", weight: 10, score: Math.floor(Math.random() * 100) },
    ],
  };
}

function generateMockLoanCalculation(amount: number, term: number) {
  const rate = 0.12; // 12% annual rate
  const monthlyRate = rate / 12;
  const monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, term)) / 
                         (Math.pow(1 + monthlyRate, term) - 1);
  
  return {
    loan_amount: amount,
    interest_rate: rate * 100,
    term_months: term,
    monthly_payment: monthlyPayment.toFixed(2),
    total_payment: (monthlyPayment * term).toFixed(2),
    total_interest: (monthlyPayment * term - amount).toFixed(2),
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    console.log('Processing API demo request...');

    // Rate limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    
    if (!checkRateLimit(ipAddress)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please try again in a minute.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        }
      );
    }

    const { endpoint, method = 'GET', platform, body } = await req.json();

    console.log(`Demo request: ${method} ${endpoint} from ${platform}`);

    let responseData: any;
    let success = true;
    let errorMessage: string | null = null;

    // Route to appropriate mock data
    try {
      switch (endpoint) {
        case 'webhook-test':
          responseData = {
            message: 'Webhook test successful',
            received_at: new Date().toISOString(),
            data: body || {},
          };
          break;

        case 'account-balance':
        case 'get-balance':
          responseData = generateMockAccountBalance();
          break;

        case 'transactions':
        case 'get-transactions':
          responseData = {
            transactions: generateMockTransactions(),
            total_count: 5,
            page: 1,
          };
          break;

        case 'payment-status':
        case 'check-payment':
          responseData = generateMockPaymentStatus();
          break;

        case 'http-test':
        case 'connector-test':
        case 'resource-test':
          responseData = {
            status: 'connected',
            message: 'Connection successful',
            timestamp: new Date().toISOString(),
            api_version: 'v1',
          };
          break;

        case 'create-payment':
          responseData = {
            payment_id: `PAY-DEMO-${Date.now()}`,
            status: 'initiated',
            amount: body?.amount || 10000,
            currency: body?.currency || 'XAF',
            created_at: new Date().toISOString(),
          };
          break;

        case 'loan-calculation':
        case 'calculate-loan':
          const amount = body?.amount || 500000;
          const term = body?.term_months || 12;
          responseData = generateMockLoanCalculation(amount, term);
          break;

        case 'credit-score':
        case 'check-credit':
          responseData = generateMockCreditScore();
          break;

        case 'user-account':
        case 'account-info':
          responseData = {
            user_id: 'USER-DEMO-001',
            account_type: 'Personal',
            account_status: 'active',
            created_at: '2024-01-15T10:00:00Z',
            kyc_status: 'verified',
          };
          break;

        case 'mobile-money-transfer':
          responseData = {
            transaction_id: `MM-DEMO-${Date.now()}`,
            status: 'processing',
            amount: body?.amount || 5000,
            phone_number: body?.phone_number || '+237670000000',
            provider: body?.provider || 'MTN',
            created_at: new Date().toISOString(),
          };
          break;

        case 'dashboard-data':
          responseData = {
            total_users: 1250,
            active_accounts: 1100,
            total_transactions: 45678,
            total_volume: 125500000,
            metrics_date: new Date().toISOString(),
          };
          break;

        default:
          responseData = {
            message: 'Demo endpoint called successfully',
            endpoint,
            method,
            timestamp: new Date().toISOString(),
          };
      }
    } catch (endpointError) {
      console.error('Error generating mock data:', endpointError);
      success = false;
      errorMessage = 'Failed to generate demo data';
      responseData = null;
    }

    const responseTime = Date.now() - startTime;

    // Log to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const ipHash = ipAddress !== 'unknown' ? await hashIpAddress(ipAddress) : null;

    await supabase.from('api_demo_logs').insert({
      endpoint,
      method,
      platform: platform || 'unknown',
      ip_address_hash: ipHash,
      success,
      response_time_ms: responseTime,
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({
        success,
        data: responseData,
        error: errorMessage,
        meta: {
          response_time_ms: responseTime,
          demo_mode: true,
          endpoint,
          method,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: success ? 200 : 500,
      }
    );

  } catch (error) {
    console.error('Error processing demo request:', error);

    const responseTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to process demo request',
        meta: {
          response_time_ms: responseTime,
          demo_mode: true,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});