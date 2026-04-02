

# Plan: Complete Multi-Language Examples + Automated Smoke Tests

## Problem Summary
Two remaining gaps from the audit:
1. **Go/Java examples missing on 60+ API reference pages** -- all use the `ApiEndpoint` component which only shows JSON request/response blocks, not multi-language code examples
2. **Automated code example smoke tests (ORDER P5)** -- no tests verify that code examples render or that all developer pages contain expected content

## Approach

### Part 1: Auto-Generate Multi-Language Examples in ApiEndpoint (High Leverage)

Instead of editing 37 individual page files, enhance the `ApiEndpoint` component itself to automatically generate tabbed code examples (cURL, Node.js, Python, PHP, Go, Java) from its existing props (`method`, `endpoint`, `requestBody`).

**Changes to `src/components/developer/ApiEndpoint.tsx`:**
- Add a helper function `generateCodeExamples(method, endpoint, requestBody?)` that produces 6 language snippets:
  - **cURL**: Standard curl command with headers
  - **Node.js**: `fetch()` with proper headers
  - **Python**: `requests` library call
  - **PHP**: `curl_init()` pattern
  - **Go**: `http.NewRequest` pattern
  - **Java**: `HttpURLConnection` pattern
- Import and use the existing `CodeBlock` component (tabbed view) to render the generated examples
- Add a new "Code Examples" section after the Response section, using an expandable/collapsible accordion so it does not bloat the page
- Base URL uses `https://api.kangopenbanking.com` from the API config
- All examples include `Authorization: Bearer sk_test_...` and `Content-Type: application/json` headers

**Result**: All 60+ reference pages using `ApiEndpoint` automatically gain 6-language code examples with zero individual file edits. Fully compliant with ORDER P9.

### Part 2: Automated Smoke Tests (ORDER P5)

**New file: `src/test/code-examples-smoke.test.ts`**

Extend the existing test infrastructure with:
1. **Developer page file coverage test** -- scan `src/pages/developer/*.tsx` and verify each file imports either `ApiEndpoint` or `CodeBlock` (ensures every page has code)
2. **ApiEndpoint auto-example generation test** -- unit test the `generateCodeExamples` helper to verify it produces valid snippets for all 6 languages for GET and POST methods
3. **Multi-language completeness test** -- verify the generated examples contain expected language keywords (e.g., `curl`, `fetch`, `requests.`, `curl_init`, `http.NewRequest`, `HttpURLConnection`)
4. **Route coverage test** -- cross-reference `docNavigationOrder.ts` paths against registered routes in `App.tsx` to catch 404s

### Part 3: Full Report

Generate `KOB_Final_E2E_Report_April2026.md` to `/mnt/documents/` documenting:
- All gaps closed
- Test results
- Updated compliance scores
- ORDER P5/P9 status

## Files Modified
| File | Change |
|------|--------|
| `src/components/developer/ApiEndpoint.tsx` | Add auto-generated 6-language code examples section |
| `src/test/code-examples-smoke.test.ts` | New: automated smoke tests for code coverage |
| `/mnt/documents/KOB_Final_E2E_Report_April2026.md` | New: final audit report |

## Compliance Impact
- **ORDER P5** (Working Code Rule): Automated smoke tests verify code examples exist on all pages
- **ORDER P9** (Multi-Language Rule): All 60+ API reference pages gain Go/Java/PHP/cURL/Node/Python automatically
- Expected score: **87 -> 92/100**

