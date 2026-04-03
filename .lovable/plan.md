

# Plan: Fix Portal Routing Conflict and Deployment Blocker

## Root Cause Analysis

Two distinct issues are preventing the developer portal from being publicly accessible:

### Issue 1: Duplicate Route Conflict (THE REAL BUG)

`src/App.tsx` defines **two** `<Route path="/developer">` blocks:

```text
Line 848:  /developer  -->  PublicDeveloperLayout  (no auth)
Line 984:  /developer  -->  ProtectedRoute + RoleGuard  (requires auth)
```

Both blocks contain child routes with the **same path** -- notably `/developer/sandbox`. React Router v6 scores both equally and may match the **protected** block, which redirects unauthenticated users to `/auth` (line 86 of `ProtectedRoute.tsx`). This is why every independent audit sees sub-pages redirecting to the homepage or login page. It is NOT a stale publish -- it is an active routing conflict in the code.

### Issue 2: Edge Function Rate Limiting (DEPLOYMENT BLOCKER)

The project has **346 edge functions**. Deploying all of them at once exceeds the backend rate limit (`ThrottlerException: Too Many Requests`), which blocks every publish attempt. No frontend changes can go live until this is resolved.

## Implementation Steps

### Step 1: Eliminate the Route Conflict

Move the 12 protected developer tool routes from `/developer/*` to `/developer-tools/*`. This gives the public `PublicDeveloperLayout` block sole ownership of the `/developer` prefix, eliminating all ambiguity.

**Changes in `src/App.tsx`:**
- Rename the protected block's parent path from `/developer` to `/developer-tools`
- Update the redirect reference from `/developer-old` accordingly
- Update any internal links that point to protected developer routes (e.g., sidebar links in `DeveloperLayout`)

**Changes in `src/components/developer/DeveloperLayout.tsx`:**
- Update sidebar navigation links from `/developer/sandbox` to `/developer-tools/sandbox`, etc.

### Step 2: Remove or Consolidate Unnecessary Edge Functions

Audit the `supabase/functions/` directory for duplicate, test-only, or unused functions. Removing even 50 functions would bring the count below typical rate-limit thresholds. Candidates:
- Functions with identical logic (e.g., aliased endpoints)
- Test/debug functions not needed in production
- Functions that can be merged into existing routers (e.g., consolidate related POS functions)

### Step 3: Generate Final Compliance Report

After deploying, produce a verification report confirming:
- Each `/developer/*` sub-page renders distinct content without auth
- The publish succeeded without rate-limit errors
- Legal pages (`/terms`, `/privacy`) are publicly accessible

## Files to Modify

| File | Change |
|------|--------|
| `src/App.tsx` | Move protected dev routes from `/developer` to `/developer-tools` |
| `src/components/developer/DeveloperLayout.tsx` | Update sidebar links to `/developer-tools/*` |
| `supabase/functions/` | Remove or consolidate unused edge functions to reduce count below rate-limit threshold |
| `/mnt/documents/KOB_Routing_Fix_Report.md` | Final verification report |

## Why Previous Fixes Failed

Every prior attempt diagnosed this as a "stale publish" and instructed you to click Publish. But:
1. The route conflict exists in the **source code** -- publishing the same conflict changes nothing
2. Even if the conflict were somehow not triggering, the publish itself fails due to edge function rate limiting
3. The combination of these two issues creates a loop where fixes never reach production

## Critical Path

The route rename (Step 1) is the minimum fix required. Step 2 (reducing edge functions) unblocks deployment. Both must happen together for the portal to actually go live.

