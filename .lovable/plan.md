
# Smart Budgeting — Implementation Plan

This is a very large additive feature (18 endpoints, ~30 new files, edge function, docs page, version bump). To ship it safely without breaking the Standing Orders or the deployed portal, I propose splitting it into 4 phases. Each phase is independently deployable. **Please confirm the phase plan before I begin Phase 1**, because Phase 2 alone is ~25 React files and worth getting right.

## Phase 1 — API contract + version bump (foundation)

1. Append to `public/openapi.json`:
   - `Budgeting` tag (with externalDocs)
   - 18 new `/v1/budgeting/*` paths (Budgets, Categories, Goals, Njangi, AI Adviser, Analytics)
   - 13 new schemas (`Budget`, `BudgetSummary`, `BudgetCategory`, `SavingsGoal`, `GoalProgress`, `NjangiSchedule`, `BudgetInsight`, `InsightAskRequest`, `InsightAskResponse`, `BudgetAlert`, `MonthlyAnalytics`, `MerchantAnalytics`, `CategoryRule`)
   - 8 new webhook events appended to existing event list
   - `info.version` → `4.41.0`
2. Bump `src/config/version.ts` → `KOB_API_VERSION = "4.41.0"`
3. Add changelog entry to `public/changelog.json` (required by ORDER P7 + sync gate)
4. Run `sync-version-artifacts.mjs` so YAML/Postman/openapi-history all align
5. Verify `scripts/check-version-sync.mjs` passes

## Phase 2 — Consumer app UI (the bulk of the work)

Create ~30 new files under `src/pages/consumer/` and `src/components/budget/`:

- **Types & utilities**: `types/budget.ts`, `lib/formatXAF.ts`, `lib/budgetCategories.ts`, `lib/merchantTagger.ts`
- **Hooks**: `useBudget`, `useGoals`, `useInsights`, `useMerchants`, `useNjangi`
- **Primitives**: `AnimatedAmount`, `DonutRing`, `LanguageSelector`, `BudgetAlertBanner`
- **Cards**: `BudgetSummaryCard`, `CategoryCard`, `CategoryList`, `GoalCard`, `GoalList`, `NjangiWidget`, `AIAdviserCard`, `MerchantList`, `SpendingChart`
- **Sheets**: `BudgetSetupSheet`, `CategoryEditSheet`, `GoalCreateSheet`
- **Pages**: `BudgetPage`, `BudgetOnboarding`
- Add `/consumer/budget` route + bottom-nav tab entry with unread-alert badge
- Add Budget design tokens to `index.css` (additive — no token rename)
- Strictly additive: no existing component, route, or hook modified

Dependencies to add: `@phosphor-icons/react`, `canvas-confetti`. (Framer Motion + Recharts likely already present.)

## Phase 3 — AI adviser edge function

- New edge function `supabase/functions/budgeting-insights/index.ts`
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview` by default — per project rules, not Anthropic direct, since `LOVABLE_API_KEY` is the sanctioned key) with trilingual prompt
- Daily-cached insights table + 10 questions/day rate limit
- Migration for `budgeting_*` tables (budgets, categories, goals, alerts, insights, rules) with RLS scoped to `consumer_id = auth.uid()`

> Note: the prompt mentions Anthropic Claude. To respect the platform's secret governance (no user-supplied API keys when Lovable AI covers it), I will use Lovable AI Gateway instead. If you specifically want Anthropic, say so and I'll request `ANTHROPIC_API_KEY` via the secrets tool.

## Phase 4 — Developer portal page + nav

- New page `src/pages/developer/BudgetingGuide.tsx` at `/developer/guides/budgeting`
- Full SEO metadata (canonical, og:image, JSON-LD breadcrumbs)
- Add to `DeveloperLayout` + `PublicDeveloperLayout` sidebars under "Integration Guides"
- Add to `public/sitemap.xml` and `public/robots.txt` allow list
- Add to Netlify deploy-hook watch list (already covered by `src/pages/developer/**`)

## Open questions before I start

1. **Phase scope**: Ship all 4 phases in this turn, or stage them (Phase 1 only first, then 2, etc.)? Phases 2+3 alone are 30+ files and will take significant tool-call budget.
2. **AI provider**: Lovable AI Gateway (zero-config, recommended) or Anthropic direct (you'll need to provide `ANTHROPIC_API_KEY`)?
3. **DB persistence**: Should Phase 3 create real Supabase tables + RLS now, or stub the endpoints to return mock data so the UI can ship independently?
4. **Confetti / Phosphor**: OK to add `@phosphor-icons/react` and `canvas-confetti` as new dependencies?

Once you confirm, I'll execute. Default if you just say "go": **all 4 phases, Lovable AI Gateway, real Supabase tables with RLS, add both deps.**
