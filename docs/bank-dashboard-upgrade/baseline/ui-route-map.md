# Bank Connector Kit — UI Route Map

## New Routes (FI Portal)

| Route | Page Component | Section Key |
|---|---|---|
| `/fi-portal/connector` | `ConnectorOverview` | connector |
| `/fi-portal/connector/uploads` | `ConnectorUploads` | connector |
| `/fi-portal/connector/mappings` | `ConnectorMappings` | connector |
| `/fi-portal/connector/batches` | `ConnectorBatches` | connector |
| `/fi-portal/connector/status` | `ConnectorStatus` | connector |
| `/fi-portal/connector/reconciliation` | `ConnectorReconciliation` | connector |
| `/fi-portal/connector/health` | `ConnectorHealth` | connector |
| `/fi-portal/connector/audit` | `ConnectorAudit` | connector |
| `/fi-portal/connector/templates` | `ConnectorTemplates` | connector |

## Existing Routes (Unchanged)
All 40+ existing `/fi-portal/*` routes remain untouched.

## Navigation
New sidebar section "Bank Connector Kit" added to `navigation-config.ts` with `sectionKey: 'connector'`.
Section added to `ALL_PORTAL_SECTIONS` for RBAC gating.

## Access Control
- Routes protected by `RoleGuard` with `allowedRoles: ['institution', 'staff']`
- Section-level gating via `useStaffPermissions` hook checking `connector` section key
- Bank data scoped by `useBankConnector` hook resolving institution → bank_id
