import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Code, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function CodeExamples() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Code Examples</h1>
        <p className="text-xl text-muted-foreground">
          Ready-to-use code examples for common integration scenarios
        </p>
      </div>

      {/* Complete Integration Examples */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Complete Integration Examples</h2>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Account Aggregation Dashboard
                </CardTitle>
                <CardDescription>Full example of displaying customer accounts with balances</CardDescription>
              </div>
              <Badge>React + TypeScript</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                {
                  language: "typescript",
                  code: `// AccountDashboard.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Account {
  AccountId: string;
  Nickname: string;
  AccountType: string;
  Currency: string;
}

interface Balance {
  Amount: string;
  Currency: string;
}

const API_BASE = 'https://api.kangopenbanking.com/v1';

export default function AccountDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccountsAndBalances();
  }, []);

  const loadAccountsAndBalances = async () => {
    try {
      const token = localStorage.getItem('kob_token');
      const consentId = localStorage.getItem('kob_consent_id');

      // Fetch accounts
      const accountsRes = await axios.get(\`\${API_BASE}/aisp/accounts\`, {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'x-consent-id': consentId
        }
      });

      const accountsList = accountsRes.data.Data.Account;
      setAccounts(accountsList);

      // Fetch balances for each account
      const balancesData: Record<string, Balance> = {};
      await Promise.all(
        accountsList.map(async (account: Account) => {
          const balanceRes = await axios.get(
            \`\${API_BASE}/aisp/accounts/\${account.AccountId}/balances\`,
            {
              headers: {
                'Authorization': \`Bearer \${token}\`,
                'x-consent-id': consentId
              }
            }
          );
          const balance = balanceRes.data.Data.Balance[0];
          balancesData[account.AccountId] = {
            Amount: balance.Amount.Amount,
            Currency: balance.Amount.Currency
          };
        })
      );

      setBalances(balancesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8">Loading...</div>;
  if (error) return <div className="text-red-600 p-8">Error: {error}</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Accounts</h1>
      <div className="grid gap-4">
        {accounts.map((account) => (
          <div key={account.AccountId} className="border rounded-lg p-6">
            <h3 className="text-xl font-semibold">{account.Nickname}</h3>
            <p className="text-muted-foreground">{account.AccountType}</p>
            <div className="text-3xl font-bold mt-2">
              {balances[account.AccountId]?.Amount || '0.00'} XAF
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}`
                }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Payment Checkout Flow
                </CardTitle>
                <CardDescription>Complete payment initiation with idempotency and status polling</CardDescription>
              </div>
              <Badge>React + TypeScript</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                {
                  language: "typescript",
                  code: `// PaymentCheckout.tsx
import { useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://api.kangopenbanking.com/v1';

export default function PaymentCheckout() {
  const [formData, setFormData] = useState({
    amount: '', beneficiaryAccount: '', beneficiaryName: '', reference: ''
  });
  const [loading, setLoading] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');

  const initiatePayment = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('kob_token');

      // Step 1: Create consent with Idempotency-Key
      const consentRes = await axios.post(
        \`\${API_BASE}/pisp/consents\`,
        {
          Data: {
            Initiation: {
              InstructedAmount: { Amount: formData.amount, Currency: 'XAF' },
              CreditorAccount: {
                Identification: formData.beneficiaryAccount,
                Name: formData.beneficiaryName
              },
              RemittanceInformation: { Unstructured: formData.reference }
            }
          }
        },
        {
          headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
          }
        }
      );

      const consentId = consentRes.data.Data.ConsentId;

      // Step 2: Initiate payment with Idempotency-Key
      const paymentRes = await axios.post(
        \`\${API_BASE}/pisp/domestic-payments\`,
        {
          Data: {
            ConsentId: consentId,
            Initiation: {
              InstructedAmount: { Amount: formData.amount, Currency: 'XAF' },
              CreditorAccount: {
                Identification: formData.beneficiaryAccount,
                Name: formData.beneficiaryName
              },
              RemittanceInformation: { Unstructured: formData.reference },
              EndToEndIdentification: \`REF-\${Date.now()}\`
            }
          }
        },
        {
          headers: {
            'Authorization': \`Bearer \${token}\`,
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID()
          }
        }
      );

      const newPaymentId = paymentRes.data.Data.DomesticPaymentId;
      setPaymentId(newPaymentId);
      setStatus('pending');

      // Step 3: Poll for status
      pollPaymentStatus(newPaymentId);
    } catch (error) {
      console.error('Payment failed:', error);
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async (id: string) => {
    const token = localStorage.getItem('kob_token');
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          \`\${API_BASE}/pisp/domestic-payments/\${id}\`,
          { headers: { 'Authorization': \`Bearer \${token}\` } }
        );
        const paymentStatus = res.data.Data.Status;
        setStatus(paymentStatus);
        
        if (['completed', 'failed', 'cancelled'].includes(paymentStatus)) {
          clearInterval(interval);
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Make Payment</h2>
      {status === 'idle' ? (
        <div className="space-y-4">
          {/* Form fields here */}
          <button onClick={initiatePayment} disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded">
            {loading ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      ) : (
        <div className="text-center p-4 bg-muted rounded">
          <p className="font-medium">Payment ID: {paymentId}</p>
          <p className="mt-2">Status: <strong>{status}</strong></p>
        </div>
      )}
    </div>
  );
}`
                }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Mobile Money Integration
                </CardTitle>
                <CardDescription>Complete mobile money charge with webhook handling</CardDescription>
              </div>
              <Badge>Node.js + Express</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                {
                  language: "javascript",
                  code: `// mobileMoneyRoutes.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();

const API_BASE = 'https://api.kangopenbanking.com/v1';

// Initiate mobile money charge
router.post('/charge', async (req, res) => {
  try {
    const { amount, phone_number, provider, email, fullname, order_id } = req.body;

    // Get access token (form-encoded)
    const tokenRes = await axios.post(\`\${API_BASE}/oauth/token\`, 
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.KOB_CLIENT_ID,
        client_secret: process.env.KOB_CLIENT_SECRET,
        scope: 'payments'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const token = tokenRes.data.access_token;

    // Initiate charge with Idempotency-Key
    const chargeRes = await axios.post(
      \`\${API_BASE}/mobile-money/charge\`,
      { amount, currency: 'XAF', phone_number, provider, email, tx_ref: order_id, fullname },
      {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID()
        }
      }
    );

    res.json({
      success: true,
      transaction_id: chargeRes.data.data.id,
      message: 'Please check your phone to authorize payment'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook handler with HMAC-SHA256 signature verification
router.post('/webhook', express.json(), (req, res) => {
  const signature = req.headers['x-kob-signature'];
  const payload = JSON.stringify(req.body);

  const expectedSig = crypto
    .createHmac('sha256', process.env.KOB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSig)
  )) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  switch (event.event) {
    case 'mobilemoney.charge.completed':
      console.log('Payment completed:', event.data.tx_ref);
      break;
    case 'mobilemoney.charge.failed':
      console.log('Payment failed:', event.data.tx_ref);
      break;
  }

  res.status(200).json({ received: true });
});

module.exports = router;`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Quick Snippets */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Quick Snippets</h2>

        <Tabs defaultValue="auth">
          <TabsList>
            <TabsTrigger value="auth">Authentication</TabsTrigger>
            <TabsTrigger value="error">Error Handling</TabsTrigger>
            <TabsTrigger value="webhook">Webhook Signature</TabsTrigger>
          </TabsList>

          <TabsContent value="auth" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>OAuth Token Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `class TokenManager {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const response = await fetch(
      'https://api.kangopenbanking.com/v1/oauth-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.KOB_CLIENT_ID!,
          client_secret: process.env.KOB_CLIENT_SECRET!,
          scope: 'accounts payments'
        })
      }
    );

    const data = await response.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    return this.token;
  }
}

export const tokenManager = new TokenManager();`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="error" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>RFC 7807 Error Handling</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `interface KOBError {
  error: string;
  error_code: string;
  message: string;
  details?: Record<string, unknown>;
  error_id: string;
  timestamp: string;
}

async function handleKOBRequest<T>(
  requestFn: () => Promise<T>
): Promise<{ data?: T; error?: string }> {
  try {
    const data = await requestFn();
    return { data };
  } catch (error: any) {
    const kobError = error.response?.data as KOBError;
    if (kobError?.error_code) {
      switch (kobError.error_code) {
        case 'PISP_004':
          return { error: 'Insufficient funds in account' };
        case 'PISP_002':
          return { error: 'Consent has expired. Please re-authorize.' };
        case 'PISP_003':
          return { error: 'Account is temporarily blocked' };
        case 'MM_003':
          return { error: 'Payment timed out. Please try again.' };
        default:
          return { error: kobError.message || 'Request failed' };
      }
    }
    return { error: 'An unexpected error occurred' };
  }
}

// Usage
const { data, error } = await handleKOBRequest(() =>
  axios.get('https://api.kangopenbanking.com/v1/aisp/accounts', {
    headers: { 'x-consent-id': consentId }
  })
);`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Signature Verification (HMAC-SHA256)</CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express middleware
export function webhookVerification(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-kob-signature'] as string;
  const payload = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const isValid = verifyWebhookSignature(
    payload,
    signature,
    process.env.KOB_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Download Section */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Complete Examples
          </CardTitle>
          <CardDescription>Get full working examples with all dependencies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="font-semibold">React Account Dashboard</p>
              <p className="text-sm text-muted-foreground">Complete React + TypeScript example</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="font-semibold">Node.js Payment Backend</p>
              <p className="text-sm text-muted-foreground">Express server with full payment flow</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="font-semibold">Mobile Money Integration</p>
              <p className="text-sm text-muted-foreground">Complete mobile money implementation</p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
