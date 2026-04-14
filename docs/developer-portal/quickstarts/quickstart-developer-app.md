# Quickstart: Developer Apps (TPP)

## 1. Register as a Developer

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/developers/register \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: dev_setup_001" \
  -d '{
    "app_name": "My FinTech App",
    "redirect_uris": ["https://app.example.com/callback"],
    "use_case": "payment_aggregation"
  }'
```

## 2. Obtain OAuth Credentials

After registration, you'll receive a `client_id` and `client_secret`.

## 3. Implement OAuth 2.0 Authorization Code + PKCE

```bash
# Step 1: Generate code verifier and challenge
CODE_VERIFIER=$(openssl rand -base64 64 | tr -d '=+/' | head -c 128)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '=')

# Step 2: Redirect user to authorize
https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://app.example.com/callback&
  scope=accounts+balances+transactions&
  code_challenge=$CODE_CHALLENGE&
  code_challenge_method=S256

# Step 3: Exchange code for token
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/token \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=https://app.example.com/callback" \
  -d "code_verifier=$CODE_VERIFIER"
```

## 4. Access Account Data

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

## Next Steps

- [Authentication Overview](../auth/authentication-overview.md)
- [AISP Reference](https://kangopenbanking.com/developer/aisp-reference)
- [Webhook Setup](../webhooks/webhooks-overview.md)
