# Adding a new managed email template

This project sends transactional and lifecycle emails through the **managed
pipeline** — a single send path that gives every email the project's queue,
retry, DLQ, suppression, rate-limit, branding and per-institution override
infrastructure for free. There is **no parallel direct-Resend path**.

> Branded auth emails (signup, recovery, magic-link, invite, email-change,
> reauthentication) live in `supabase/functions/_shared/email-templates/` and
> are rendered by `auth-email-hook`. They are **not** the subject of this
> guide. This guide is for **app / lifecycle emails** (KYC outcomes, name
> correction, disputes, loan updates, settlement notices, etc.) — the kind
> registered in `managed_email_types`.

---

## Architecture in one diagram

```text
┌──────────────────────────┐       enqueue           ┌─────────────────────┐
│ your edge function       │ ───────────────────────▶│ managed-send-email  │
│ (e.g. nium-request-name- │   sendManagedEmail()     │  (renders, brands,  │
│  correction)             │                          │   suppress-checks,  │
└──────────────────────────┘                          │   queues)           │
                                                      └──────────┬──────────┘
                                                                 │
                                                                 ▼
                                              pgmq (auth_emails / transactional_emails)
                                                                 │
                                                                 ▼
                                                    process-email-queue (cron)
                                                                 │
                                                                 ▼
                                                Resend (notify.kangopenbanking.com)
                                                                 │
                                                                 ▼
                                                          email_send_log
```

Per-institution overrides come from `institution_email_overrides` and
`institution_email_settings` (logo, primary colour, footer).

---

## When to add a new managed_email_type

Add one row in `managed_email_types` for **every distinct lifecycle event**
that should trigger an email. One template = one subject + one HTML body +
one set of variables.

If your workflow has multiple distinct outcomes (e.g. submitted / approved /
rejected) create one row per outcome — do **not** branch inside a single
template with `{{#if}}` style logic; the managed renderer only does flat
`{{variable}}` substitution.

---

## Step-by-step

### 1. Pick a stable `email_key`

Convention: `<domain>_<entity>_<event>` in snake_case. Examples:

| Domain          | Good keys                                                                |
|-----------------|--------------------------------------------------------------------------|
| Name correction | `nium_name_correction_submitted`, `..._approved`, `..._rejected`         |
| Loans           | `loan_application_received`, `loan_approved`, `loan_overdue_notice`      |
| Disputes        | `dispute_filed_customer`, `dispute_resolved_final`                       |

Keys are **immutable** once shipped (Standing Order 1 — The Lock). Adding new
ones is free; renaming an existing one breaks per-institution overrides.

### 2. Write a migration

Insert into `public.managed_email_types`. Use `ON CONFLICT (email_key) DO
UPDATE` so the migration is idempotent and re-runnable across environments.

```sql
INSERT INTO public.managed_email_types
  (email_key, category, name, description,
   default_subject, default_body_html, available_variables,
   trigger_event, is_system, is_active, sort_order)
VALUES (
  'my_domain_event_name',
  'transactional',            -- or 'compliance', 'security', 'marketing-disabled', etc.
  'My Domain — Event Name',
  'One-sentence description of when this fires.',
  'Subject with {{variable}} interpolation',
  '<p>Dear {{customer_name}},</p><p>...{{request_id}}...</p>',
  '["customer_name","request_id","submitted_at","institution_name"]'::jsonb,
  'my_domain.event_name',     -- trigger_event for analytics / discovery
  true, true, 600
)
ON CONFLICT (email_key) DO UPDATE SET
  default_subject = EXCLUDED.default_subject,
  default_body_html = EXCLUDED.default_body_html,
  available_variables = EXCLUDED.available_variables,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
```

**Body rules**

- Plain HTML string. Do **not** wrap in `<html>`/`<body>` — the layout
  wrapper in `managed-send-email/index.ts` adds the branded shell and the
  unsubscribe footer.
- Use `{{variable}}` placeholders only. Anything not in
  `available_variables` is still rendered if passed (the renderer is
  permissive) but should be documented in that array for governance.
- Always include **audit-friendly variables** for any state-changing email:
  `request_id`, `request_id_short`, timestamps (ISO 8601), maker/checker
  identities, institution name. The agent and admins debug from these.
- Never put unsubscribe links or marketing copy here — the pipeline appends
  the unsubscribe footer; marketing is unsupported.

### 3. Enqueue from your edge function

Use the shared helper, never call Resend directly:

```ts
import { sendManagedEmail, getUserName } from '../_shared/send-managed-email.ts';

const customerName = await getUserName(admin, userId);
await sendManagedEmail(admin, {
  email_key: 'my_domain_event_name',
  recipient_user_id: userId,        // or recipient_email
  institution_id: instId,           // optional, enables per-institution overrides
  variables: {
    customer_name: customerName,
    request_id: row.id,
    request_id_short: row.id.slice(0, 8).toUpperCase(),
    submitted_at: new Date(row.created_at).toISOString(),
    institution_name: 'Kang Open Banking',
  },
});
```

`sendManagedEmail` is **non-throwing** — it logs and swallows errors so
your core financial logic is never blocked by an email failure.

### 4. (Optional) Add an in-app notification alongside

The managed email reaches the inbox; an `app_notifications` row reaches the
in-app notification center. Most lifecycle events emit both. Use a stable
`idempotency_key` per `(event, entity_id)` so retries don't duplicate:

```ts
await admin.from('app_notifications').insert({
  user_id: userId,
  type: 'kyc',
  icon: 'kyc',
  title: 'Name correction submitted',
  message: '...',
  metadata: { kind: 'nium_name_correction', stage: 'submitted', request_id: row.id },
  idempotency_key: `nium-name-correction-submitted-${row.id}`,
});
```

### 5. Add E2E coverage

Mirror `e2e/authenticated/name-correction-email-trio.spec.ts`: drive the
workflow end-to-end as the appropriate identities, then poll
`email_send_log` filtered by `recipient_email` + `template_name = <your
email_key>` and assert `status in ('pending','sent')`. Reject `dlq`,
`failed`, `suppressed`.

### 6. Deploy

```text
supabase--deploy_edge_functions(function_names=["<your function>"])
```

Template rows are picked up live from the DB — no edge-function redeploy is
required when only the SQL changes.

---

## Do / Don't

| Do                                                            | Don't                                                            |
|---------------------------------------------------------------|------------------------------------------------------------------|
| Use `sendManagedEmail` from `_shared/send-managed-email.ts`   | Import `resend` or call `https://api.resend.com` directly        |
| One `managed_email_type` row per lifecycle outcome            | Branch inside a single template with conditional logic           |
| Idempotent migration with `ON CONFLICT (email_key) DO UPDATE` | Rename an existing `email_key` (breaks institution overrides)    |
| Include `request_id`, timestamps, maker/checker in variables  | Send only `customer_name` for a state-changing event             |
| Assert delivery via `email_send_log` in an E2E spec           | Rely on a real inbox poll for CI determinism                     |
| Let `sendManagedEmail` swallow errors                         | `await` the email send in a way that blocks a financial mutation |

---

## Reference files

- `supabase/functions/_shared/send-managed-email.ts` — the only public send API
- `supabase/functions/managed-send-email/index.ts` — renderer + branding wrapper
- `supabase/functions/process-email-queue/index.ts` — queue dispatcher
- `supabase/functions/nium-request-name-correction/index.ts` — reference
  implementation of the submitted/approved/rejected trio
- `e2e/authenticated/name-correction-email-trio.spec.ts` — reference E2E
- `docs/audit/2026-05-26-email-module-pentest.md` — historical pentest /
  health audit of the pipeline
