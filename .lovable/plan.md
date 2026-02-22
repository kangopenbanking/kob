

# Fix PostiQ Integration with KOB

## Root Cause

Two issues are causing the 500 error:

1. **Wrong API Base URL**: The edge function falls back to `https://postiq.cam/functions/v1`, which serves an HTML landing page. The correct URL (from the official Postman collection) is `https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1`.

2. **Response field mismatch**: The PostiQ API returns fields like `postiq_precision` (a comma-separated string) instead of separate `latitude`/`longitude`/`precision` fields the code expects.

## Actual PostiQ API Response (from docs)

```text
{
  "success": true,
  "data": {
    "postiq_code": "DLA-BON-X7K9",
    "postiq_precision": "4.0511,9.7679",
    "district": "Douala",
    "region": "Littoral",
    "sector": "Bonaberi",
    "full_address": "DLA-BON-X7K9, Bonaberi, Douala, Littoral"
  }
}
```

## Changes

### 1. Update `POSTIQ_BASE_URL` secret

Set the value to `https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1` so the edge functions use the correct endpoint.

### 2. Fix `postiq-create-code/index.ts`

- Update the hardcoded fallback URL from `https://postiq.cam/functions/v1` to `https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1`
- Parse `postiq_precision` string into separate latitude/longitude values
- Remove references to non-existent response fields (`precision`, `credits_consumed`)
- Store `district`, `region`, `sector` from the response into the database record

### 3. Fix `postiq-lookup-code/index.ts`

- Update to use the correct `POSTIQ_BASE_URL` with proper fallback
- Add HTML response detection (same guard as create-code)

### 4. Update `PostiQVerification.tsx` (frontend)

- Update the success toast to show the new PostiQ code format (e.g., `DLA-BON-X7K9`)
- No other frontend changes needed since it already reads `data.data.postiq_code`

## Technical Details

| Item | Current (broken) | Fixed |
|---|---|---|
| Fallback URL | `https://postiq.cam/functions/v1` | `https://uuxlcrvlljzoufjzmzid.supabase.co/functions/v1` |
| Latitude extraction | `postiqData.data.latitude` | Parsed from `postiqData.data.postiq_precision.split(",")[0]` |
| Longitude extraction | `postiqData.data.longitude` | Parsed from `postiqData.data.postiq_precision.split(",")[1]` |
| Precision field | `postiqData.data.precision` | `postiqData.data.postiq_precision` |
| Credits consumed | `postiqData.credits_consumed` | Default to `1` (field not in response) |

