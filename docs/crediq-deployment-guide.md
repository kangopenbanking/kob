# CrediQ Deployment & Configuration Guide

## Overview
CrediQ is a comprehensive credit scoring system integrated into the Kang Open Banking platform. This guide covers deployment, configuration, and maintenance procedures.

## System Architecture

### Components
1. **Database Layer**: PostgreSQL with Supabase
   - `credit_scores` - Store user credit scores
   - `crediq_onboarding_answers` - Questionnaire responses
   - `crediq_health_metrics` - Financial health indicators
   - `crediq_action_plans` - Personalized recommendations
   - `crediq_goals` - User-defined credit goals
   - `crediq_email_preferences` - Notification settings

2. **Edge Functions** (9 total)
   - `crediq-generate-baseline-score` - Initial score calculation
   - `crediq-calculate-health-metrics` - Financial health analysis
   - `crediq-generate-action-plan` - Personalized recommendations
   - `crediq-send-welcome-email` - Onboarding email
   - `crediq-send-score-change-email` - Score change notifications
   - `crediq-send-weekly-digest` - Weekly summary emails
   - `crediq-send-monthly-report` - Monthly comprehensive reports
   - `crediq-send-goal-achieved-email` - Goal milestone celebrations
   - `crediq-health-check` - System health monitoring

3. **Frontend Pages**
   - `/crediq` - Landing page
   - `/crediq/info` - Feature information
   - `/crediq/onboarding` - Questionnaire flow
   - `/crediq/dashboard` - User credit score dashboard
   - `/crediq/settings` - Email preferences

## Prerequisites

### Required Services
- Supabase project (already configured via Lovable Cloud)
- Resend API key for email delivery
- GitHub repository with Actions enabled

### Environment Variables
```bash
# Already configured in Lovable Cloud
SUPABASE_URL=https://ftwbtzbeqkqrdmxmyvvz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=[Available in Supabase dashboard]
```

### Required Secrets
1. **RESEND_API_KEY** - For email sending
   - Obtain from: https://resend.com/api-keys
   - Verify domain at: https://resend.com/domains

2. **SUPABASE_ANON_KEY** (for GitHub Actions)
   - Add to GitHub repository secrets
   - Navigate to: Settings > Secrets and variables > Actions > New repository secret

## Deployment Steps

### 1. Database Migration
Already completed via Lovable Cloud. Verify tables exist:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'crediq%';
```

### 2. Edge Functions Deployment
Edge functions are automatically deployed with code changes in Lovable Cloud.

To verify deployment:
1. Open Backend view in Lovable
2. Navigate to Edge Functions section
3. Confirm all 9 CrediQ functions are listed and active

### 3. Scheduled Email Jobs

#### GitHub Actions Setup
Two scheduled workflows are configured:

**Weekly Digest** (`.github/workflows/crediq-weekly-digest.yml`)
- Schedule: Every Monday at 8:00 AM UTC
- Function: Sends weekly credit health summary
- Manual trigger: Available via GitHub Actions UI

**Monthly Report** (`.github/workflows/crediq-monthly-report.yml`)
- Schedule: 1st of each month at 9:00 AM UTC
- Function: Sends comprehensive monthly report
- Manual trigger: Available via GitHub Actions UI

#### Enable GitHub Actions
1. Push code to GitHub repository
2. Navigate to repository Settings > Actions > General
3. Enable "Allow all actions and reusable workflows"
4. Add `SUPABASE_ANON_KEY` to repository secrets

#### Manual Testing
Test scheduled functions immediately:
```bash
# Weekly Digest
curl -X POST \
  'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/crediq-send-weekly-digest' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "test-user-uuid"}'

# Monthly Report
curl -X POST \
  'https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/crediq-send-monthly-report' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "test-user-uuid"}'
```

### 4. Frontend Deployment
Frontend is automatically deployed via Lovable. Access at your Lovable domain.

## Configuration

### Email Settings
Users can manage email preferences at `/crediq/settings`:
- Score change notifications
- Weekly digest
- Monthly reports
- Goal achievement alerts
- Action plan updates

### Credit Score Ranges
Defined in Cameroon Credit Standard (CCS):
- 800-850: Excellent
- 740-799: Very Good
- 670-739: Good
- 580-669: Fair
- 300-579: Poor

### Color Theme
CrediQ uses Cameroon flag colors:
```css
--crediq-green: 147 51% 30%;     /* Forest green */
--crediq-red: 0 72% 51%;         /* Cameroon red */
--crediq-yellow: 45 93% 47%;     /* Golden yellow */
```

## Testing

### Complete User Flow Test
1. **Sign Up**: Create new account at `/register`
2. **Onboarding**: Complete questionnaire at `/crediq/onboarding`
3. **Dashboard**: View score at `/crediq/dashboard`
4. **Welcome Email**: Check email for welcome message
5. **Settings**: Update preferences at `/crediq/settings`

### Edge Function Testing
Health check endpoint:
```bash
curl https://ftwbtzbeqkqrdmxmyvvz.supabase.co/functions/v1/crediq-health-check
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "connected",
    "edge_functions": "operational",
    "email_service": "configured"
  }
}
```

### Score Change Testing
1. Manually insert transaction data for a user
2. Trigger score recalculation
3. Verify score change email is sent

## Monitoring

### Key Metrics
- User onboarding completion rate
- Average credit score by region
- Email delivery success rate
- Edge function response times

### Logs
Access logs via Lovable Backend:
1. Click "View Backend" button
2. Navigate to Edge Functions
3. Select function and view logs

### Error Tracking
Common issues to monitor:
- Failed email deliveries (check Resend dashboard)
- Score calculation errors (check edge function logs)
- Database connection timeouts
- RLS policy violations

## Maintenance

### Weekly Tasks
- Monitor scheduled email job success
- Review edge function error rates
- Check database storage usage

### Monthly Tasks
- Analyze credit score trends
- Review email engagement metrics
- Update action plan templates
- Verify RLS policies

### Quarterly Tasks
- Security audit of edge functions
- Performance optimization review
- Update credit score calculation algorithm
- User feedback analysis

## Troubleshooting

### Issue: Emails not sending
1. Verify RESEND_API_KEY is set
2. Check domain verification at resend.com
3. Review send-communication function logs

### Issue: Score not calculating
1. Check crediq-generate-baseline-score logs
2. Verify user has completed onboarding
3. Ensure credit-score-calculate function is accessible

### Issue: GitHub Actions failing
1. Verify SUPABASE_ANON_KEY is set in repository secrets
2. Check workflow file syntax
3. Review GitHub Actions run logs

### Issue: Dashboard not loading
1. Check browser console for errors
2. Verify user is authenticated
3. Ensure credit_scores table has RLS policies
4. Check edge function availability

## Security Considerations

### Row Level Security (RLS)
All CrediQ tables have RLS enabled:
- Users can only access their own credit data
- Admin roles can view all data (for support)
- Service role key bypasses RLS for edge functions

### Data Privacy
- Credit scores are encrypted at rest
- Email preferences honor user choices
- No third-party data sharing
- GDPR/CEMAC compliant data retention

### API Security
- All edge functions require authentication
- Rate limiting enabled (100 requests/minute)
- CORS configured for frontend domain only
- Input validation on all endpoints

## Support

### Documentation Links
- [CrediQ User Guide](./crediq-user-guide.md)
- [API Reference](./crediq-api-reference.md)
- [Troubleshooting](./crediq-troubleshooting.md)

### Contact
For technical support or questions:
- Email: support@kangob.com
- Developer Portal: https://your-domain.lovable.app/developer
- Status Page: https://your-domain.lovable.app/status

## Appendix

### Database Schema Diagram
```
┌──────────────────┐
│  auth.users      │
└────────┬─────────┘
         │
         ├─────────┬──────────────────────┬────────────────┐
         │         │                      │                │
         ▼         ▼                      ▼                ▼
┌──────────────┐  ┌─────────────────┐  ┌───────────┐  ┌──────────┐
│credit_scores │  │crediq_onboarding│  │crediq_goals│  │crediq_   │
│              │  │_answers         │  │           │  │email_prefs│
└──────────────┘  └─────────────────┘  └───────────┘  └──────────┘
         │
         ├─────────┬────────────────┐
         ▼         ▼                ▼
┌──────────────┐  ┌────────────┐  ┌────────────────┐
│crediq_health │  │crediq_action│  │credit_score   │
│_metrics      │  │_plans       │  │_history       │
└──────────────┘  └────────────┘  └────────────────┘
```

### Edge Function Call Flow
```
User Onboarding
      ↓
crediq-generate-baseline-score
      ↓
      ├─→ credit-score-calculate (if history exists)
      ├─→ crediq-calculate-health-metrics
      ├─→ crediq-generate-action-plan
      └─→ crediq-send-welcome-email
            ↓
      send-communication (Resend)
```

### Scheduled Job Frequencies
- **Score Change Emails**: Immediate (event-triggered)
- **Weekly Digest**: Every Monday 8:00 AM UTC
- **Monthly Report**: 1st of month 9:00 AM UTC
- **Goal Achieved**: Immediate (event-triggered)
- **Health Check**: Every 5 minutes (monitoring)
