/**
 * CONVENTION: Shared PWA Components
 *
 * Components in this directory are APP-AGNOSTIC utilities shared between:
 *   - The multi-tenancy Banking App (/bank/:institutionId)
 *   - The unified Customer App (/app, branded "Kang")
 *
 * RULES:
 *   1. Do NOT import app-specific tenant hooks here.
 *      - ❌ useTenant()           → Banking App only (TenantProvider)
 *      - ❌ useCustomerTenant()   → Customer App only (CustomerTenantProvider)
 *   2. If a component needs branding data, accept it as props instead.
 *   3. Keep these components pure/presentational where possible.
 *   4. The only tenant-aware component allowed here is TenantProvider.tsx
 *      itself, which is intentionally scoped to the Banking App.
 */
