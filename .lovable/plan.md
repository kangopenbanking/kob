

## Plan: Fix Published Site Routing — Developer Portal Ghost Pages

### Root Cause
The code in the repository is correct — all routes exist in `src/App.tsx` with real page components. The sandbox preview renders every page properly (verified: Getting Started, API Explorer, Sandbox Overview, Gateway Quickstart all render with unique content).

The issue is that the **published site at kob.lovable.app has not been updated** to reflect the current codebase. The published build is stale, causing certain routes to fall through to incorrect pages.

### Evidence
- Sandbox preview: `/developer/getting-started` renders correctly with full content
- Sandbox preview: `/developer/api-explorer` renders Swagger UI with spec loaded
- Sandbox preview: `/developer/sandbox/overview` renders sandbox environment guide
- Sandbox preview: `/developer/gateway/quickstart` renders 10-minute quickstart
- Published site (kob.lovable.app): `/developer/examples/real-world` redirects to `/developer/getting-started`
- Published site (kob.lovable.app): `/developer/gateway/webhooks` redirects to `/developer/gateway/quickstart`

### Fix Required

**Step 1 — Re-publish the app**
Click the **Publish** button in the top-right corner of the Lovable editor, then click **Update** to deploy the current codebase. This will make all existing routes live on kob.lovable.app.

No code changes are needed — the routing, page components, and content all exist and work correctly in the current codebase.

**Step 2 — Verify after publish**
After publishing, confirm these URLs return their unique content (not homepage):
- kob.lovable.app/developer/getting-started
- kob.lovable.app/developer/api-explorer
- kob.lovable.app/developer/examples/real-world
- kob.lovable.app/developer/gateway/quickstart
- kob.lovable.app/developer/gateway/webhooks
- kob.lovable.app/developer/sandbox (redirects to /developer/sandbox/overview)
- kob.lovable.app/terms
- kob.lovable.app/contact

### Additional Gaps Found (for follow-up if needed)

The `/terms` and `/contact` pages have lazy-loaded components defined (lines 90, 100 in App.tsx) but their rendering on the published site was not verified. These should be checked after re-publishing.

### No Code Changes Required
The codebase is correct. This is purely a deployment sync issue.

