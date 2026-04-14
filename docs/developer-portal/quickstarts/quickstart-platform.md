# Quickstart: Banks & Financial Institutions

## 1. Register Your Institution

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/institutions/register \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: inst_setup_001" \
  -d '{
    "institution_name": "Afriland First Bank",
    "institution_type": "bank"
  }'
```

## 2. Create API Client

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/institutions/{institution_id}/clients" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Production API Client",
    "scopes": ["accounts", "payments", "balances", "transactions"]
  }'
```

## 3. Configure Bank Connector

Choose your integration mode:

| Mode | Best For |
|------|----------|
| **API Pull** | Banks with REST APIs |
| **DB Connector** | Direct database polling |
| **File-Based** | CSV/SFTP batch imports |
| **Message Queue** | Kafka/RabbitMQ real-time |

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/banks/{bank_id}/connectors" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "REST API Connector",
    "environment": "sandbox",
    "base_url": "https://api.yourbank.cm/v1",
    "connector_type": "rest"
  }'
```

## 4. Submit Business KYC

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/institutions/{institution_id}/kyb" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Afriland First Bank SA",
    "registration_number": "RC/DLA/1987/B/042"
  }'
```

## 5. Start Serving AISP/PISP

Once approved, your institution can serve account information and payment initiation requests from authorized TPPs.

## Next Steps

- [Bank Connector Setup Guide](https://kangopenbanking.com/bank-integration-guide)
- [AISP Reference](https://kangopenbanking.com/developer/aisp-reference)
- [PISP Reference](https://kangopenbanking.com/developer/pisp-reference)
