

## KYB/KYC Submission Fix Plan

### Root Cause

The `MerchantKYB.tsx` page (line 158) invokes the `gateway-merchant-kyb` edge function using `supabase.functions.invoke()`, which sends data in the **request body**. However, the edge function reads `merchant_id` and `action` from **URL query parameters** (`url.searchParams.get()`). Since `supabase.functions.invoke()` does not support query parameters, the function always fails at line 22 with `merchant_id required` (400 error).

This explains the "Edge Function returned a non-2xx status code" error visible in the session replay.

### Issues Found

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | `gateway-merchant-kyb` reads `merchant_id` and `action` from query params but frontend sends them in body | **Critical** | Edge Function + Frontend |
| 2 | Edge function only allows `not_submitted` and `rejected` for submission, but frontend also allows `draft` | **Medium** | Edge Function line 49 |
| 3 | Frontend doesn't pass `merchant_id` or `action` at all — neither in body nor query params | **Critical** | `MerchantKYB.tsx` line 158 |

### Fix Plan

#### Fix 1: Update `gateway-merchant-kyb` edge function

Modify the function to read `merchant_id` and `action` from **both** query params and request body, with body taking precedence. Also add `draft` to allowed submission statuses.

```text
Changes to gateway-merchant-kyb/index.ts:
- Parse body first for POST requests
- Fall back to query params for GET requests  
- Extract merchant_id and action from body OR query params
- Add 'draft' to allowed kyb_status values for submission (line 49)
```

#### Fix 2: Update `MerchantKYB.tsx` frontend

Pass `merchant_id` (from `merchant.id`) and `action: 'submit'` in the request body alongside the existing submission data.

```text
Changes to MerchantKYB.tsx line 158-161:
- Add merchant_id: merchant.id to the body
- Add action: 'submit' to the body
```

### Files to Modify

1. `supabase/functions/gateway-merchant-kyb/index.ts` — Accept params from body, add `draft` status
2. `src/pages/merchant/MerchantKYB.tsx` — Pass `merchant_id` and `action` in body

