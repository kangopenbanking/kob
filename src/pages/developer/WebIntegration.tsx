import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function WebIntegration() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Web Application Integration</h1>
        <p className="text-xl text-muted-foreground">
          Complete guide to integrating Kang Open Banking into your web applications
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This guide covers both frontend and backend integration patterns for modern web frameworks.
        </AlertDescription>
      </Alert>

      {/* Frontend Integration */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Frontend Integration</h2>
        
        <Tabs defaultValue="react">
          <TabsList>
            <TabsTrigger value="react">React</TabsTrigger>
            <TabsTrigger value="vue">Vue.js</TabsTrigger>
            <TabsTrigger value="vanilla">Vanilla JS</TabsTrigger>
          </TabsList>

          <TabsContent value="react" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>React Integration</CardTitle>
                <CardDescription>Using React with TypeScript and hooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h4 className="font-semibold">1. Install Dependencies</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "bash",
                      code: "npm install axios @tanstack/react-query"
                    }
                  ]}
                />

                <h4 className="font-semibold">2. Create API Service</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `// src/services/kob-api.ts
import axios from 'axios';

const API_BASE_URL = 'https://api.kangopenbanking.com/v1';

export const kobApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
kobApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('kob_access_token');
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

// API methods
export const getAccounts = (consentId: string) => 
  kobApi.get('/aisp-accounts', {
    headers: { 'x-consent-id': consentId }
  });

export const getBalances = (accountId: string, consentId: string) =>
  kobApi.get(\`/aisp-balances/\${accountId}\`, {
    headers: { 'x-consent-id': consentId }
  });

export const initiatePayment = (paymentData: any) =>
  kobApi.post('/pisp-domestic-payment', paymentData);`
                    }
                  ]}
                />

                <h4 className="font-semibold">3. Create React Hook</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `// src/hooks/useAccounts.ts
import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '@/services/kob-api';

export function useAccounts(consentId: string) {
  return useQuery({
    queryKey: ['accounts', consentId],
    queryFn: () => getAccounts(consentId),
    enabled: !!consentId,
  });
}

// src/hooks/usePayment.ts
import { useMutation } from '@tanstack/react-query';
import { initiatePayment } from '@/services/kob-api';

export function usePayment() {
  return useMutation({
    mutationFn: initiatePayment,
    onSuccess: (data) => {
      console.log('Payment initiated:', data);
    },
    onError: (error) => {
      console.error('Payment failed:', error);
    },
  });
}`
                    }
                  ]}
                />

                <h4 className="font-semibold">4. Use in Component</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `// src/components/AccountList.tsx
import { useAccounts } from '@/hooks/useAccounts';

export function AccountList() {
  const consentId = 'your_consent_id';
  const { data, isLoading, error } = useAccounts(consentId);

  if (isLoading) return <div>Loading accounts...</div>;
  if (error) return <div>Error loading accounts</div>;

  return (
    <div>
      <h2>Your Accounts</h2>
      {data?.data.Data.Account.map((account: any) => (
        <div key={account.AccountId}>
          <h3>{account.Nickname}</h3>
          <p>Type: {account.AccountType}</p>
          <p>Currency: {account.Currency}</p>
        </div>
      ))}
    </div>
  );
}`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vue.js Integration</CardTitle>
                <CardDescription>Using Vue 3 Composition API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h4 className="font-semibold">Install Dependencies</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "bash",
                      code: "npm install axios @tanstack/vue-query"
                    }
                  ]}
                />

                <h4 className="font-semibold">Create Composable</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `// src/composables/useKOB.ts
import { ref } from 'vue';
import axios from 'axios';

const API_BASE_URL = 'https://api.kangopenbanking.com/v1';

export function useKOB() {
  const loading = ref(false);
  const error = ref(null);

  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${localStorage.getItem('kob_token')}\`
    }
  });

  const getAccounts = async (consentId: string) => {
    loading.value = true;
    try {
      const response = await api.get('/aisp-accounts', {
        headers: { 'x-consent-id': consentId }
      });
      return response.data;
    } catch (err) {
      error.value = err;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    getAccounts
  };
}`
                    }
                  ]}
                />

                <h4 className="font-semibold">Use in Component</h4>
                <CodeBlock
                  examples={[
                    {
                      language: "typescript",
                      code: `<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useKOB } from '@/composables/useKOB';

const { loading, error, getAccounts } = useKOB();
const accounts = ref([]);

onMounted(async () => {
  const consentId = 'your_consent_id';
  const data = await getAccounts(consentId);
  accounts.value = data.Data.Account;
});
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else>
    <h2>Your Accounts</h2>
    <div v-for="account in accounts" :key="account.AccountId">
      <h3>{{ account.Nickname }}</h3>
      <p>Type: {{ account.AccountType }}</p>
    </div>
  </div>
</template>`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vanilla" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Vanilla JavaScript Integration</CardTitle>
                <CardDescription>Pure JavaScript without frameworks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock
                  examples={[
                    {
                      language: "javascript",
                      code: `// kob-sdk.js
class KOBClient {
  constructor(baseURL) {
    this.baseURL = baseURL || 'https://api.kangopenbanking.com/v1';
    this.token = localStorage.getItem('kob_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('kob_token', token);
  }

  async request(endpoint, options = {}) {
    const url = \`\${this.baseURL}\${endpoint}\`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${this.token}\`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(\`API Error: \${response.status}\`);
    }

    return response.json();
  }

  async getAccounts(consentId) {
    return this.request('/aisp-accounts', {
      headers: { 'x-consent-id': consentId }
    });
  }

  async initiatePayment(paymentData) {
    return this.request('/pisp-domestic-payment', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  }
}

// Usage
const kob = new KOBClient();

// Get accounts
async function loadAccounts() {
  try {
    const data = await kob.getAccounts('consent_123');
    const accounts = data.Data.Account;
    
    // Update DOM safely (prevents XSS attacks)
    const container = document.getElementById('accounts');
    container.innerHTML = ''; // Clear existing content
    
    accounts.forEach(acc => {
      const div = document.createElement('div');
      div.className = 'account';
      
      const h3 = document.createElement('h3');
      h3.textContent = acc.Nickname; // Safe - no HTML parsing
      
      const p = document.createElement('p');
      p.textContent = \`Type: \${acc.AccountType}\`; // Safe
      
      div.appendChild(h3);
      div.appendChild(p);
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Failed to load accounts:', error);
  }
}

// Initialize
loadAccounts();`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Backend Integration */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Backend Integration</h2>

        <Tabs defaultValue="nodejs">
          <TabsList>
            <TabsTrigger value="nodejs">Node.js</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="php">PHP</TabsTrigger>
          </TabsList>

          <TabsContent value="nodejs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Node.js / Express Backend</CardTitle>
                <CardDescription>Server-side integration with Express.js</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock
                  examples={[
                    {
                      language: "javascript",
                      code: `// server.js
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const KOB_API = 'https://api.kangopenbanking.com/v1';
const CLIENT_ID = process.env.KOB_CLIENT_ID;
const CLIENT_SECRET = process.env.KOB_CLIENT_SECRET;

// Get access token
async function getAccessToken() {
  const response = await axios.post(\`\${KOB_API}/oauth-token\`, 
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'accounts payments'
    }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );
  return response.data.access_token;
}

// Proxy endpoint for accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const token = await getAccessToken();
    const consentId = req.headers['x-consent-id'];
    
    const response = await axios.get(\`\${KOB_API}/aisp-accounts\`, {
      headers: {
        'Authorization': \`Bearer \${token}\`,
        'x-consent-id': consentId
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment endpoint
app.post('/api/payments', async (req, res) => {
  try {
    const token = await getAccessToken();
    
    const response = await axios.post(
      \`\${KOB_API}/pisp-domestic-payment\`,
      req.body,
      {
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="python" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Python / Flask Backend</CardTitle>
                <CardDescription>Server-side integration with Flask</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock
                  examples={[
                    {
                      language: "python",
                      code: `# app.py
from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

KOB_API = 'https://api.kangopenbanking.com/v1'
CLIENT_ID = os.getenv('KOB_CLIENT_ID')
CLIENT_SECRET = os.getenv('KOB_CLIENT_SECRET')

def get_access_token():
    response = requests.post(
        f'{KOB_API}/oauth-token',
        data={
            'grant_type': 'client_credentials',
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'scope': 'accounts payments'
        }
    )
    return response.json()['access_token']

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    try:
        token = get_access_token()
        consent_id = request.headers.get('x-consent-id')
        
        response = requests.get(
            f'{KOB_API}/aisp-accounts',
            headers={
                'Authorization': f'Bearer {token}',
                'x-consent-id': consent_id
            }
        )
        
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/payments', methods=['POST'])
def initiate_payment():
    try:
        token = get_access_token()
        
        response = requests.post(
            f'{KOB_API}/pisp-domestic-payment',
            json=request.json,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
        )
        
        return jsonify(response.json())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=3000)`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="php" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>PHP / Laravel Backend</CardTitle>
                <CardDescription>Server-side integration with Laravel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock
                  examples={[
                    {
                      language: "php",
                      code: `<?php
// app/Services/KOBService.php
namespace App\\Services;

use Illuminate\\Support\\Facades\\Http;

class KOBService
{
    private $apiBase = 'https://api.kangopenbanking.com/v1';
    private $clientId;
    private $clientSecret;

    public function __construct()
    {
        $this->clientId = env('KOB_CLIENT_ID');
        $this->clientSecret = env('KOB_CLIENT_SECRET');
    }

    public function getAccessToken()
    {
        $response = Http::asForm()->post("{$this->apiBase}/oauth-token", [
            'grant_type' => 'client_credentials',
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'scope' => 'accounts payments'
        ]);

        return $response->json()['access_token'];
    }

    public function getAccounts($consentId)
    {
        $token = $this->getAccessToken();

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$token}",
            'x-consent-id' => $consentId
        ])->get("{$this->apiBase}/aisp-accounts");

        return $response->json();
    }

    public function initiatePayment($paymentData)
    {
        $token = $this->getAccessToken();

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$token}"
        ])->post("{$this->apiBase}/pisp-domestic-payment", $paymentData);

        return $response->json();
    }
}

// routes/api.php
Route::get('/accounts', function (Request $request) {
    $kobService = new \\App\\Services\\KOBService();
    $consentId = $request->header('x-consent-id');
    return $kobService->getAccounts($consentId);
});

Route::post('/payments', function (Request $request) {
    $kobService = new \\App\\Services\\KOBService();
    return $kobService->initiatePayment($request->all());
});`
                    }
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Security Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Security Best Practices</CardTitle>
          <CardDescription>Essential security considerations for web integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Never expose secrets in frontend code</p>
              <p className="text-sm text-muted-foreground">Always use backend proxy endpoints to handle authentication</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Implement CORS properly</p>
              <p className="text-sm text-muted-foreground">Configure allowed origins on your backend to prevent unauthorized access</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Use HTTPS everywhere</p>
              <p className="text-sm text-muted-foreground">Ensure all API communications use TLS/SSL encryption</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Implement token refresh logic</p>
              <p className="text-sm text-muted-foreground">Automatically refresh expired access tokens before making requests</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Validate and sanitize all inputs</p>
              <p className="text-sm text-muted-foreground">Prevent injection attacks by validating user input on both client and server</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
