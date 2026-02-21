# KOB Admin API Reference

> All admin endpoints require a valid JWT with the `admin` role.  
> Unauthenticated requests receive `401`; non-admin users receive `403`.

---

## 1. Existing Admin Endpoints

### 1.1 `GET /v1/admin/metrics` → `admin-metrics`

Returns platform-wide metrics for the last 30 days.

**Response:**
```json
{
  "period": { "start": "...", "end": "..." },
  "transactions": { "count": 142, "volume": 5800000, "currency": "XAF" },
  "payments": { "count": 87 },
  "api": { "totalCalls": 12400, "avgResponseTime": 120, "successRate": 99.2 },
  "consents": { "active": 34 },
  "users": { "active": 56 }
}
```

### 1.2 `POST /v1/admin/transaction-review` → `admin-transaction-review`

Review, flag, approve, or block a transaction.

**Request body:**
```json
{
  "action": "flag" | "approve" | "block",
  "transaction_id": "uuid",
  "notes": "optional string"
}
```

### 1.3 `POST /v1/admin/webhooks` → `admin-webhooks`

Manage platform webhook configurations.

### 1.4 `POST /v1/admin/system-config` → `admin-system-config`

Read/write system configuration values.

### 1.5 `POST /v1/admin/create-user` → `admin-create-user`

Create a new platform user with a specified role.

### 1.6 `POST /v1/admin/institution-approve` → `admin-institution-approve`

Approve or reject institution registration applications.

### 1.7 `POST /v1/admin/kyb-verify` → `admin-kyb-verify`

Update KYB verification status for an institution.

---

## 2. New Listing Endpoints (Checkpoint 12)

All listing endpoints follow a common pattern:

| Query Param | Type    | Default | Description                |
|-------------|---------|---------|----------------------------|
| `limit`     | integer | 20      | Max rows (capped at 100)   |
| `offset`    | integer | 0       | Pagination offset          |
| `status`    | string  | —       | Filter by status           |
| `user_id`   | uuid    | —       | Filter by user             |

**Response envelope:**
```json
{
  "data": [...],
  "pagination": { "total": 142, "limit": 20, "offset": 0 }
}
```

### 2.1 `GET /v1/admin/list-loans` → `admin-list-loans`

List all loan applications with their linked loan accounts.

**Additional filters:**
| Param        | Description              |
|--------------|--------------------------|
| `product_id` | Filter by loan product   |

**Includes:** Nested `loan_accounts` for each application.

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.kangopenbanking.com/functions/v1/admin-list-loans?status=approved&limit=10"
```

### 2.2 `GET /v1/admin/list-savings` → `admin-list-savings`

List all savings accounts with product details and recent transactions.

**Additional filters:**
| Param          | Description                |
|----------------|----------------------------|
| `product_id`   | Filter by savings product  |
| `account_type` | Filter by account type     |

**Includes:** Nested `savings_products` (name, interest_rate) and `savings_transactions`.

**Example:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.kangopenbanking.com/functions/v1/admin-list-savings?status=active&limit=20"
```

### 2.3 `GET /v1/admin/list-consents` → `admin-list-consents`

List AISP or PISP consents.

**Additional filters:**
| Param       | Description                          |
|-------------|--------------------------------------|
| `type`      | `aisp` (default) or `pisp`           |
| `client_id` | Filter by TPP client ID              |

**Response includes** `consent_type` field indicating `aisp` or `pisp`.

**Example:**
```bash
# AISP consents
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.kangopenbanking.com/functions/v1/admin-list-consents?status=Authorised"

# PISP consents
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.kangopenbanking.com/functions/v1/admin-list-consents?type=pisp&status=Authorised"
```

---

## 3. Audit & Compliance

### 3.1 Audit Logs

All admin actions are recorded via `log_audit_event()` DB function, capturing:
- `action_type`, `entity_type`, `entity_id`
- `performed_by` (admin user ID)
- `ip_address`, `details` (JSON metadata)

### 3.2 Compliance Reports

Generated via `generate_compliance_report()` DB function:

```sql
SELECT generate_compliance_report('2025-01-01', '2025-01-31', 'monthly');
```

Returns report ID; report stored in `compliance_reports` with:
- `total_consents`, `active_consents`, `revoked_consents`
- `total_transactions`, `total_payments`, `total_api_calls`
- `unique_users`, `unique_tpps`

### 3.3 Security Audit Logs

Tracked in `security_audit_logs` with risk scoring via `check_suspicious_login()`.

---

## 4. RBAC Enforcement Summary

All admin endpoints verify the `admin` role using one of two patterns:

**Pattern A – `has_role` RPC:**
```typescript
const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
```

**Pattern B – Direct query:**
```typescript
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .eq('role', 'admin')
  .single();
```

Both produce the same result. Pattern A is preferred for new endpoints.

---

## 5. Error Codes

| HTTP | Error Code  | Description                 |
|------|-------------|-----------------------------|
| 401  | UNAUTHORIZED| Missing or invalid JWT      |
| 403  | FORBIDDEN   | User lacks admin role       |
| 405  | METHOD_ERR  | Wrong HTTP method           |
| 500  | INTERNAL    | Server-side failure         |
