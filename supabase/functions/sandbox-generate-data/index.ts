import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateRandomAccount(userId: string) {
  const accountTypes = ['Current', 'Savings', 'Business'];
  const currencies = ['XAF', 'USD', 'EUR'];
  const names = ['John Doe', 'Jane Smith', 'Acme Corp', 'Tech Solutions Ltd', 'Global Trading'];
  
  return {
    user_id: userId,
    account_id: `ACC${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    account_holder_name: names[Math.floor(Math.random() * names.length)],
    account_type: accountTypes[Math.floor(Math.random() * accountTypes.length)] as any,
    account_subtype: 'Current' as any,
    currency: currencies[Math.floor(Math.random() * currencies.length)],
    identification_scheme: 'LOCAL_BANK' as any,
    identification_value: `${Math.floor(100000000 + Math.random() * 900000000)}`,
    is_active: true,
  };
}

function generateRandomTransaction(accountId: string, userId: string) {
  const types = ['credit', 'debit'];
  const descriptions = [
    'Grocery Purchase',
    'Salary Payment',
    'Online Shopping',
    'Utility Bill',
    'Restaurant',
    'Gas Station',
    'ATM Withdrawal',
    'Bank Transfer',
    'Mobile Money',
  ];

  const type = types[Math.floor(Math.random() * types.length)];
  const amount = Math.floor(Math.random() * 50000) + 1000;

  return {
    account_id: accountId,
    user_id: userId,
    transaction_type: type,
    amount: amount,
    currency: 'XAF',
    description: descriptions[Math.floor(Math.random() * descriptions.length)],
    reference: `TXN${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    status: 'completed',
    balance_after: Math.floor(Math.random() * 500000) + 50000,
    transaction_datetime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function generateAccountBalance(accountId: string) {
  const balance = Math.floor(Math.random() * 1000000) + 10000;
  
  return {
    account_id: accountId,
    balance_type: 'InterimAvailable',
    amount: balance,
    currency: 'XAF',
    credit_debit_indicator: 'Credit',
    balance_datetime: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data_type, count = 1 } = await req.json();

    if (!data_type || !['accounts', 'transactions', 'balances', 'all'].includes(data_type)) {
      return new Response(JSON.stringify({ error: 'Invalid data_type. Must be: accounts, transactions, balances, or all' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating ${count} ${data_type} for user ${user.id}`);

    let result = {
      accounts_created: 0,
      transactions_created: 0,
      balances_created: 0,
    };

    // Generate accounts
    if (data_type === 'accounts' || data_type === 'all') {
      const accounts = Array.from({ length: count }, () => generateRandomAccount(user.id));
      
      const { data: createdAccounts, error: accountError } = await supabase
        .from('accounts')
        .insert(accounts)
        .select();

      if (accountError) {
        console.error('Error creating accounts:', accountError);
        throw accountError;
      }

      result.accounts_created = createdAccounts?.length || 0;

      // Generate balances and transactions for each account
      if (data_type === 'all' && createdAccounts) {
        for (const account of createdAccounts) {
          // Create balance
          const balance = generateAccountBalance(account.id);
          await supabase.from('account_balances').insert([balance]);
          result.balances_created++;

          // Create 5-10 transactions per account
          const txnCount = Math.floor(Math.random() * 6) + 5;
          const transactions = Array.from({ length: txnCount }, () => 
            generateRandomTransaction(account.id, user.id)
          );
          
          const { data: createdTxns } = await supabase
            .from('transactions')
            .insert(transactions)
            .select();

          result.transactions_created += createdTxns?.length || 0;
        }
      }
    }

    // Generate transactions for existing accounts
    if (data_type === 'transactions') {
      // Get user's accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(10);

      if (!accounts || accounts.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No accounts found. Create accounts first.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const transactions = Array.from({ length: count }, () => {
        const randomAccount = accounts[Math.floor(Math.random() * accounts.length)];
        return generateRandomTransaction(randomAccount.id, user.id);
      });

      const { data: createdTxns, error: txnError } = await supabase
        .from('transactions')
        .insert(transactions)
        .select();

      if (txnError) {
        console.error('Error creating transactions:', txnError);
        throw txnError;
      }

      result.transactions_created = createdTxns?.length || 0;
    }

    // Generate balances for existing accounts
    if (data_type === 'balances') {
      // Get user's accounts without balances
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(count);

      if (!accounts || accounts.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No accounts found. Create accounts first.' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const balances = accounts.map(account => generateAccountBalance(account.id));

      const { data: createdBalances, error: balanceError } = await supabase
        .from('account_balances')
        .insert(balances)
        .select();

      if (balanceError) {
        console.error('Error creating balances:', balanceError);
        throw balanceError;
      }

      result.balances_created = createdBalances?.length || 0;
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Test data generated successfully',
      ...result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error generating sandbox data:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate sandbox data. Please try again.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});