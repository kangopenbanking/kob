# CrediQ User Flow Testing Checklist

## Overview
This document provides a comprehensive testing checklist for the CrediQ credit scoring system.

## Pre-Testing Setup

### Environment Verification
- [ ] Lovable Cloud backend is accessible
- [ ] All 9 edge functions are deployed
- [ ] Database tables are created with RLS policies
- [ ] RESEND_API_KEY secret is configured
- [ ] GitHub Actions workflows are enabled

### Test User Accounts
Create test users with different scenarios:
1. **New User** - No banking history
2. **Active User** - Has transactions and accounts
3. **High Score User** - Excellent credit profile
4. **Low Score User** - Fair/poor credit profile

## Testing Workflow

### 1. User Registration & Authentication
- [ ] Navigate to `/register`
- [ ] Create account with valid email
- [ ] Verify email confirmation (if enabled)
- [ ] Log in successfully
- [ ] Session persists across page reloads

**Expected Result**: User can register and log in without errors.

---

### 2. CrediQ Landing Page
- [ ] Navigate to `/crediq`
- [ ] Hero section displays correctly
- [ ] Background image loads (crediq-hero-bg.png)
- [ ] Feature cards are visible
- [ ] "Get Started" button works
- [ ] "Learn More" button navigates to `/crediq/info`

**Expected Result**: Landing page is visually appealing with all elements functional.

---

### 3. Feature Information Page
- [ ] Navigate to `/crediq/info`
- [ ] All feature descriptions load
- [ ] Icons display correctly
- [ ] Call-to-action buttons work
- [ ] Navigation back to landing page works

**Expected Result**: Information page provides clear feature overview.

---

### 4. Onboarding Questionnaire
- [ ] Navigate to `/crediq/onboarding`
- [ ] Progress bar displays (0%)
- [ ] First question loads correctly
- [ ] Can select answer options
- [ ] "Next" button advances to next question
- [ ] Progress bar updates
- [ ] Cannot skip required questions
- [ ] Can go back to previous questions
- [ ] All 15 questions complete
- [ ] Final "Submit" button appears

**Test Data**: Complete all questions with varied answers.

**Expected Result**: Smooth questionnaire flow with no crashes.

---

### 5. Baseline Score Generation
- [ ] Click "Submit" on final question
- [ ] Loading indicator appears
- [ ] Score calculation completes (may take 10-30 seconds)
- [ ] Redirects to `/crediq/dashboard`
- [ ] Credit score displays
- [ ] Score rating appears (Excellent/Very Good/Good/Fair/Poor)

**Expected Result**: Baseline score generated between 300-850.

**Edge Function Called**: `crediq-generate-baseline-score`

---

### 6. Welcome Email
- [ ] Check email inbox (within 1-2 minutes)
- [ ] Welcome email received
- [ ] Subject line: "Welcome to CrediQ..."
- [ ] Baseline score shown in email
- [ ] Action items listed
- [ ] Links in email work (dashboard, settings)

**Expected Result**: Professionally formatted welcome email received.

**Edge Function Called**: `crediq-send-welcome-email`

---

### 7. Credit Score Dashboard
- [ ] Navigate to `/crediq/dashboard`
- [ ] Circular score display renders
- [ ] Score number matches database
- [ ] Rating badge correct (color-coded)
- [ ] Recent score change displays
- [ ] Action plans section loads
- [ ] Product recommendations visible
- [ ] Goal tracker (if goals exist)

**Expected Result**: Dashboard shows complete credit profile.

---

### 8. Action Plans
- [ ] Action plans listed in priority order
- [ ] Each plan shows:
  - [ ] Title and description
  - [ ] Priority level (High/Medium/Low)
  - [ ] Status (Not Started/In Progress/Completed)
  - [ ] Impact on score
  - [ ] Target deadline
- [ ] Can mark actions as complete
- [ ] Status updates save to database

**Expected Result**: Personalized action plans with clear guidance.

**Edge Function Called**: `crediq-generate-action-plan`

---

### 9. Health Metrics
- [ ] Health metrics calculated
- [ ] Payment Reliability score shown
- [ ] Debt Management indicator
- [ ] Credit Utilization percentage
- [ ] Account Diversity count
- [ ] Financial Stability rating
- [ ] Each metric has explanation

**Expected Result**: Financial health breakdown displayed.

**Edge Function Called**: `crediq-calculate-health-metrics`

---

### 10. Goal Setting
- [ ] Can create new credit goal
- [ ] Set target score (validate range 300-850)
- [ ] Set target date (future dates only)
- [ ] Goal title editable
- [ ] Goal saves to database
- [ ] Progress bar displays correctly
- [ ] Goal listed in dashboard

**Expected Result**: User can set and track credit goals.

---

### 11. Email Preferences
- [ ] Navigate to `/crediq/settings`
- [ ] All notification toggles display:
  - [ ] Score change notifications
  - [ ] Weekly digest
  - [ ] Monthly reports
  - [ ] Goal achievement alerts
  - [ ] Action plan updates
- [ ] Can toggle preferences on/off
- [ ] Changes save to database
- [ ] Success toast appears
- [ ] Preferences persist on reload

**Expected Result**: User can customize email notifications.

---

### 12. Score Change Email
**Trigger**: Manually update credit score in database or complete financial action.

- [ ] Score change detected
- [ ] Email sent within 1-2 minutes
- [ ] Subject shows increase/decrease
- [ ] Old vs new score displayed
- [ ] Change reason explained
- [ ] Personalized tip included
- [ ] Dashboard link works

**Expected Result**: Immediate notification of score changes.

**Edge Function Called**: `crediq-send-score-change-email`

---

### 13. Weekly Digest Email
**Trigger**: Wait until Monday 8:00 AM UTC or manually trigger GitHub Action.

- [ ] GitHub Action runs on schedule
- [ ] Email sent to all opted-in users
- [ ] Subject: "Your Weekly Credit Update"
- [ ] Current score displayed
- [ ] Weekly trend (↑ up, ↓ down, → no change)
- [ ] Activity summary
- [ ] Goals progress
- [ ] Top 3 tips included
- [ ] Dashboard link works

**Expected Result**: Comprehensive weekly summary email.

**Edge Function Called**: `crediq-send-weekly-digest`

**Manual Test**:
```bash
curl -X POST \
  'https://api.kangopenbanking.com/functions/v1/crediq-send-weekly-digest' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "YOUR_TEST_USER_ID"}'
```

---

### 14. Monthly Report Email
**Trigger**: Wait until 1st of month 9:00 AM UTC or manually trigger GitHub Action.

- [ ] GitHub Action runs on schedule
- [ ] Email sent to all opted-in users
- [ ] Subject: "Your Monthly Credit Report"
- [ ] Score history chart (text-based)
- [ ] Monthly score change
- [ ] Completed actions listed
- [ ] Goals progress detailed
- [ ] New recommendations
- [ ] Benchmark comparison (if available)

**Expected Result**: Detailed monthly credit report.

**Edge Function Called**: `crediq-send-monthly-report`

**Manual Test**:
```bash
curl -X POST \
  'https://api.kangopenbanking.com/functions/v1/crediq-send-monthly-report' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "YOUR_TEST_USER_ID"}'
```

---

### 15. Goal Achievement Email
**Trigger**: Update user's score to meet or exceed goal target.

- [ ] Goal achievement detected
- [ ] Email sent immediately
- [ ] Subject: "Congratulations! Goal Achieved"
- [ ] Celebration message
- [ ] Goal details (title, target score)
- [ ] Achievement date
- [ ] Next steps/recommendations
- [ ] Share achievement option

**Expected Result**: Celebratory email sent on goal completion.

**Edge Function Called**: `crediq-send-goal-achieved-email`

---

### 16. Navigation & Footer Links
- [ ] Homepage has "CrediQ" link in navigation
- [ ] Footer has "Check Your Score" link
- [ ] All CrediQ links work across site
- [ ] Mobile menu includes CrediQ
- [ ] Breadcrumbs work correctly

**Expected Result**: CrediQ accessible from all pages.

---

### 17. Responsive Design
Test on multiple devices:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

For each device:
- [ ] Landing page layout adapts
- [ ] Dashboard is readable
- [ ] Questionnaire is usable
- [ ] Navigation menu works
- [ ] Charts/graphs scale correctly

**Expected Result**: Fully responsive across all screen sizes.

---

### 18. Performance Testing
- [ ] Landing page loads in < 3 seconds
- [ ] Dashboard loads in < 2 seconds
- [ ] Onboarding questionnaire responds instantly
- [ ] Score calculation completes in < 30 seconds
- [ ] Email delivery within 1-2 minutes
- [ ] No console errors
- [ ] No memory leaks (check DevTools)

**Expected Result**: Fast, smooth user experience.

---

### 19. Error Handling
Test error scenarios:
- [ ] Invalid email format during registration
- [ ] Network timeout during score calculation
- [ ] Missing required question answers
- [ ] Invalid score range in goal setting
- [ ] Email service unavailable
- [ ] Database connection failure

**Expected Result**: Graceful error messages, no crashes.

---

### 20. Security Testing
- [ ] Cannot access other users' scores
- [ ] Dashboard requires authentication
- [ ] Email preferences are user-specific
- [ ] RLS policies prevent unauthorized access
- [ ] Sensitive data not exposed in URLs
- [ ] API calls include proper headers

**Expected Result**: User data is secure and private.

---

### 21. Health Check Endpoint
- [ ] Navigate to edge function URL or use curl:
```bash
curl https://api.kangopenbanking.com/functions/v1/crediq-health-check
```
- [ ] Response status: 200 OK
- [ ] JSON structure correct:
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

**Expected Result**: All systems operational.

**Edge Function Called**: `crediq-health-check`

---

## Regression Testing

After any code changes, re-test:
- [ ] User onboarding flow (end-to-end)
- [ ] Dashboard display
- [ ] Email delivery
- [ ] Score calculations
- [ ] Navigation links

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces elements
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Alt text on images
- [ ] ARIA labels on interactive elements

---

## Load Testing

Simulate multiple users:
- [ ] 10 concurrent onboarding sessions
- [ ] 50 dashboard page loads
- [ ] 100 email sends in parallel
- [ ] Database queries remain fast
- [ ] No edge function timeouts

---

## Data Validation

Check database after testing:
```sql
-- Verify scores are in valid range
SELECT user_id, score FROM credit_scores WHERE score < 300 OR score > 850;

-- Check onboarding completeness
SELECT user_id, COUNT(*) FROM crediq_onboarding_answers GROUP BY user_id HAVING COUNT(*) < 15;

-- Verify email preferences
SELECT user_id, * FROM crediq_email_preferences WHERE user_id NOT IN (SELECT id FROM auth.users);
```

**Expected Result**: All data within valid ranges.

---

## Monitoring & Logs

During testing, monitor:
- [ ] Supabase edge function logs (no errors)
- [ ] Browser console (no JavaScript errors)
- [ ] Network tab (all API calls succeed)
- [ ] Resend dashboard (emails delivered)
- [ ] GitHub Actions (scheduled jobs run)

---

## Test Sign-Off

**Tester Name**: ___________________________
**Test Date**: ___________________________
**Environment**: Production / Staging
**Overall Result**: Pass / Fail

### Critical Issues Found
1. ___________________________
2. ___________________________
3. ___________________________

### Notes
___________________________
___________________________
___________________________

---

## Quick Test Command Reference

```bash
# Health check
curl https://api.kangopenbanking.com/functions/v1/crediq-health-check

# Manual weekly digest
curl -X POST https://api.kangopenbanking.com/functions/v1/crediq-send-weekly-digest \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "USER_ID"}'

# Manual monthly report
curl -X POST https://api.kangopenbanking.com/functions/v1/crediq-send-monthly-report \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "USER_ID"}'

# Check database
psql -h db.PROJECT_REF.supabase.co -U postgres -d postgres
```

---

## Automated Testing (Future Enhancement)

Consider implementing:
- Playwright/Cypress for E2E tests
- Jest for unit tests
- API contract testing
- CI/CD integration
- Synthetic monitoring

---

**Last Updated**: 2025-11-01
**Version**: 1.0
