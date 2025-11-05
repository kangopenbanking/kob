# GDPR Data Retention Guide - Consent Events

## Overview

This guide documents the automated GDPR data retention system for the `consent_events` table, which ensures compliance with data protection regulations by automatically deleting consent audit logs older than 2 years.

## Implementation

### Edge Function: `gdpr-consent-retention`

**Location:** `supabase/functions/gdpr-consent-retention/index.ts`

**Purpose:** Automatically deletes consent event records older than 2 years (730 days) to comply with GDPR data minimization and retention principles.

**Schedule:** Runs daily at 2:00 AM UTC via pg_cron

**Security:** Uses service role authentication for delete operations

### What Gets Deleted

- **Target Table:** `consent_events`
- **Retention Period:** 2 years (730 days)
- **Deletion Criteria:** Records where `created_at < NOW() - INTERVAL '730 days'`

### Audit Trail

Each cleanup operation is automatically logged to the `audit_logs` table with:
- Action type: `gdpr_data_retention`
- Entity type: `consent_events`
- Details: Number of deleted records, cutoff date, execution time
- Automated flag: `true`

## Execution Details

### Return Data

The edge function returns a JSON response with:

```json
{
  "success": true,
  "message": "Successfully deleted X consent events older than 2 years",
  "data": {
    "deleted_count": 123,
    "retention_period_days": 730,
    "cutoff_date": "2023-01-15T00:00:00.000Z",
    "execution_time_ms": 450
  }
}
```

### Cron Schedule

**Job Name:** `gdpr-consent-retention-daily`
**Schedule:** `0 2 * * *` (Daily at 2:00 AM UTC)
**Method:** HTTP POST via pg_net

## Manual Execution

You can manually trigger the data retention cleanup:

### Via Supabase Functions

```typescript
const { data, error } = await supabase.functions.invoke('gdpr-consent-retention', {
  body: { manual: true }
});
```

### Via Direct HTTP Call

```bash
curl -X POST \
  https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/gdpr-consent-retention \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manual": true}'
```

## Monitoring

### Check Cron Schedule

To verify the cron job is active:

```sql
SELECT * FROM cron.job 
WHERE jobname = 'gdpr-consent-retention-daily';
```

### View Execution History

To see when the cleanup has run:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'gdpr-consent-retention-daily'
)
ORDER BY start_time DESC
LIMIT 10;
```

### Check Audit Logs

To review deletion history:

```sql
SELECT * FROM audit_logs
WHERE action_type = 'gdpr_data_retention'
  AND entity_type = 'consent_events'
ORDER BY created_at DESC
LIMIT 20;
```

## RLS Policies

The deletion operation respects the following RLS policies on `consent_events`:

1. **Users can view own events** - Regular users can only see their own consent events
2. **Admins can view all events** - Admins have full audit access
3. **Only admins can delete** - Deletion is restricted to admin role and service role
4. **Events are immutable** - No updates allowed to maintain audit integrity

## Compliance Notes

### GDPR Article 5(1)(e) - Storage Limitation

This implementation satisfies GDPR's storage limitation principle:
> "Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed."

### Data Retained

The following fields are subject to this retention policy:
- `consent_id` - Consent identifier
- `event_type` - Type of consent event (created, authorized, revoked, accessed)
- `user_id` - User who performed the action
- `client_id` - OAuth client identifier
- `ip_address_hash` - SHA-256 hashed IP address (PII protection)
- `user_agent` - Browser/device information
- `metadata` - Additional event context (validated and minimized)

### Why 2 Years?

The 2-year retention period aligns with:
- **Regulatory Requirements:** PSD2 requires maintaining transaction records for 5 years, but consent event logs are operational audit data, not transaction records
- **Operational Needs:** Sufficient time for fraud investigation, dispute resolution, and regulatory audits
- **Data Minimization:** Balances operational requirements with GDPR's data minimization principle
- **Industry Standards:** Common practice for audit logs in financial services

## Customization

### Changing the Retention Period

To modify the retention period, update the edge function:

```typescript
// Change this value in supabase/functions/gdpr-consent-retention/index.ts
const retentionDays = 730; // Change to desired number of days
```

Then redeploy the function.

### Changing the Schedule

To modify when the cleanup runs:

```sql
-- Unschedule the existing job
SELECT cron.unschedule('gdpr-consent-retention-daily');

-- Create new schedule (example: run at midnight)
SELECT cron.schedule(
  'gdpr-consent-retention-daily',
  '0 0 * * *', -- Change this cron expression
  $$
  SELECT net.http_post(
    url:='https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/gdpr-consent-retention',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);
```

## Troubleshooting

### Job Not Running

1. Check if pg_cron extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

2. Verify the cron job exists:
```sql
SELECT * FROM cron.job WHERE jobname = 'gdpr-consent-retention-daily';
```

3. Check for errors in job run history:
```sql
SELECT * FROM cron.job_run_details 
WHERE status = 'failed'
ORDER BY start_time DESC;
```

### No Records Being Deleted

1. Verify records exist older than 2 years:
```sql
SELECT COUNT(*) FROM consent_events 
WHERE created_at < NOW() - INTERVAL '730 days';
```

2. Check RLS policies allow deletion:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'consent_events' AND cmd = 'DELETE';
```

3. Review edge function logs in Supabase dashboard

### Permission Errors

Ensure the service role key is correctly configured in the cron job and has sufficient permissions.

## Related Documentation

- [GDPR Compliance Implementation Guide](./compliance-implementation-guide.md)
- [Consent Management System](./consent-management-guide.md)
- [Security Best Practices](./security-best-practices.md)

## Support

For questions or issues with the data retention system, contact the platform team or review edge function logs for detailed error information.
