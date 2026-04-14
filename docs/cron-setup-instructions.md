# Automated Billing Cron Job Setup Instructions

## Overview

The automated billing system generates monthly and quarterly invoices automatically using a scheduled cron job that runs daily. This document explains how the automation works and how to verify it's running correctly.

---

## Current Setup: GitHub Actions

### What It Does

The billing automation is configured using **GitHub Actions** workflow that:
- Runs **daily at 00:00 UTC (midnight)**
- Calls the `automated-billing-cron` edge function
- Generates invoices automatically on:
  - **Last day of each month** → Monthly invoices
  - **Last day of each quarter** (Mar 31, Jun 30, Sep 30, Dec 31) → Quarterly invoices
- Sends invoice emails automatically to institutions

### Workflow File

Location: `.github/workflows/automated-billing.yml`

```yaml
name: Automated Billing Cron

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
  workflow_dispatch:     # Manual trigger option

jobs:
  run-automated-billing:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger automated billing edge function
        run: |
          curl -X POST \
            https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron \
            -H "Content-Type: application/json"
```

### Verifying GitHub Actions

1. **Navigate to Actions tab** in your GitHub repository
2. **Look for workflow**: "Automated Billing Cron"
3. **Check recent runs**: Should show daily executions
4. **View logs**: Click on any run to see detailed output

### Manual Trigger

You can manually trigger the billing process:

1. Go to **GitHub Actions** tab
2. Select **Automated Billing Cron** workflow
3. Click **Run workflow** button
4. Select branch (usually `main`)
5. Click **Run workflow**

---

## Alternative Setup: External Cron Services

If you prefer not to use GitHub Actions, you can use external cron services:

### Option 1: cron-job.org

**Free tier**: Up to 50 cron jobs

**Setup**:
1. Create account at https://cron-job.org
2. Create new cron job:
   - **URL**: `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron`
   - **Method**: POST
   - **Schedule**: `0 0 * * *` (daily at midnight)
   - **Headers**: `Content-Type: application/json`
3. Enable the job
4. Monitor executions in dashboard

### Option 2: EasyCron

**Free tier**: 20 cron jobs

**Setup**:
1. Sign up at https://www.easycron.com
2. Add cron job:
   - **URL**: `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron`
   - **Cron Expression**: `0 0 * * *`
   - **HTTP Method**: POST
3. Save and enable

### Option 3: UptimeRobot

**Free tier**: 50 monitors (can be used as cron)

**Setup**:
1. Create account at https://uptimerobot.com
2. Add HTTP(s) monitor:
   - **URL**: `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron`
   - **Monitoring Interval**: 1 day
   - **Monitor Type**: HTTP(s)
3. Enable monitor

---

## Testing the Cron Job

### Manual Testing

You can test the billing function manually using curl:

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (on non-billing days):
```json
{
  "success": true,
  "message": "No invoices generated (not month-end or quarter-end)",
  "processed": 0
}
```

**Expected Response** (on month-end):
```json
{
  "success": true,
  "message": "Billing completed",
  "processed": 5,
  "results": [
    {
      "institution_id": "uuid",
      "institution_name": "Example Bank",
      "invoices_generated": 1,
      "status": "success"
    }
  ]
}
```

### Verifying Invoices Were Generated

1. **Check backend** (institution_invoices table):
   ```sql
   SELECT * FROM institution_invoices 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

2. **Check Admin UI**:
   - Navigate to `/fee-management`
   - Click **Invoices** tab
   - Verify recent invoices exist

3. **Check email delivery**:
   - Institutions should receive invoice emails
   - Check edge function logs for email sending

---

## Edge Function Details

### Function: automated-billing-cron

**Location**: `supabase/functions/automated-billing-cron/index.ts`

**What It Does**:
1. Checks if today is month-end or quarter-end
2. Fetches all approved institutions
3. For each institution:
   - Checks billing cycle preference
   - Generates invoice if appropriate
   - Sends invoice email
4. Returns summary of processed institutions

**Configuration**:
- **Public function**: No authentication required (`verify_jwt = false`)
- **Idempotent**: Safe to run multiple times per day
- **Email sending**: Uses Resend API

### Billing Logic

**Monthly Invoices**:
- Generated on last day of every month
- Period: 1st to last day of current month
- Due: 30 days after invoice date

**Quarterly Invoices**:
- Generated on Mar 31, Jun 30, Sep 30, Dec 31
- Period: Full quarter (3 months)
- Due: 30 days after invoice date

**Institution Filtering**:
- Only processes institutions with status = 'approved'
- Respects billing_cycle preference ('monthly' or 'quarterly')

---

## Monitoring & Logs

### Viewing Edge Function Logs

Using backend interface:
1. Navigate to backend
2. Select **Edge Functions**
3. Click on `automated-billing-cron`
4. View **Logs** tab
5. Filter by date range

### Log Entries to Monitor

**Success Indicators**:
```
✅ Is month end: true
✅ Processing 5 approved institutions
✅ Invoice generated for Institution XYZ: INV-2025-01-000123
✅ Email sent successfully
```

**Error Indicators**:
```
❌ Error generating invoice: [error details]
❌ Email sending failed: [error details]
```

### Setting Up Alerts

**Option 1: Email notifications from cron service**
- Most cron services send email on job failure
- Configure in service settings

**Option 2: Monitor via edge function logs**
- Check logs daily for errors
- Set up log monitoring

---

## Troubleshooting

### Cron Not Running

**Symptom**: No invoices generated on month-end

**Checks**:
1. Verify cron job is enabled
2. Check cron service dashboard for execution history
3. Review edge function logs for errors
4. Test manual trigger

**Solutions**:
- Re-enable cron job
- Check API endpoint URL is correct
- Verify edge function is deployed

### Invoices Not Generated

**Symptom**: Cron runs but no invoices created

**Checks**:
1. Verify institutions have status = 'approved'
2. Check if institutions have pending transaction fees
3. Review billing_cycle preferences
4. Check date detection logic in edge function

**Solutions**:
- Ensure institutions are approved
- Verify transaction fees exist with billing_status = 'pending'
- Check institution billing_cycle field

### Emails Not Sent

**Symptom**: Invoices created but emails not received

**Checks**:
1. Verify RESEND_API_KEY secret is set
2. Check Resend dashboard for delivery status
3. Review edge function logs for email errors
4. Verify institution email addresses are valid

**Solutions**:
- Validate Resend API key
- Check email domain verification in Resend
- Update institution email addresses

---

## Maintenance

### Regular Tasks

**Daily**:
- Monitor cron job execution (automated)

**Weekly**:
- Review generated invoices
- Check email delivery success rate

**Monthly**:
- Verify month-end billing completed
- Review any failed invoice generations
- Check institution payment status

### Backup Plan

If automated billing fails, admins can manually generate invoices:

1. Navigate to `/fee-management`
2. Go to **Invoices** tab
3. Click **Generate Invoice**
4. Select institution and billing period
5. Click **Generate**

---

## Configuration Reference

### Cron Expression

`0 0 * * *` means:
- **0** - Minute 0 (top of the hour)
- **0** - Hour 0 (midnight)
- **\*** - Every day of month
- **\*** - Every month
- **\*** - Every day of week

**Other useful expressions**:
- `0 2 * * *` - 2 AM daily
- `0 0 1 * *` - 1st of each month at midnight
- `0 0 * * 0` - Every Sunday at midnight

### Edge Function Endpoint

**URL**: `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/automated-billing-cron`

**Method**: POST

**Headers**: 
```
Content-Type: application/json
```

**Body**: Empty `{}`

**No Authentication Required**

---

## Security Considerations

1. **Public endpoint**: Edge function is public by design
2. **Idempotent**: Safe to call multiple times
3. **No sensitive data**: Doesn't accept user input
4. **Rate limiting**: Consider adding if needed
5. **Monitoring**: Log all executions for audit trail

---

## FAQ

**Q: What if I need to change the schedule?**
A: Edit the cron expression in `.github/workflows/automated-billing.yml` and commit the change.

**Q: Can I disable automated billing?**
A: Yes, disable the GitHub Actions workflow or delete the cron job from external service.

**Q: What time zone is used?**
A: All times are in UTC. The function runs at 00:00 UTC daily.

**Q: What if multiple institutions need invoices?**
A: The function processes all eligible institutions in a single run.

**Q: How do I test before going live?**
A: Use manual trigger to test the function, verify invoice generation and email delivery.

**Q: What happens if the cron runs twice in one day?**
A: No duplicates created - function is idempotent and checks dates.

---

## Support

For additional help:
- Check edge function logs in backend
- Review institution_invoices table
- Contact system administrator
- Review fee-management-guide.md

---

**Last Updated**: 2025-01-23  
**Version**: 1.0
