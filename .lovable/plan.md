

# Support Chat System — E2E Audit Report & Fix Plan

## Audit Summary

| Component | Status | Gaps Found |
|---|---|---|
| Database schema (4 tables + RLS + realtime) | ✅ Complete | — |
| Storage bucket (`support-attachments`) | ✅ Complete | — |
| Website floating widget | ✅ Complete | — |
| Consumer App (`/app/support`) | ✅ Complete | — |
| Business App (`/biz/support`) | ✅ Complete | — |
| Banking App (`/bank/:id/more/support`) | ✅ Complete | — |
| Admin dashboard (`/admin/support-chat`) | ⚠️ Partial | 4 gaps |
| In-app notifications | ❌ Missing | No trigger on new message |
| Push notifications (OneSignal) | ❌ Missing | Not wired |
| Email notifications | ❌ Missing | No managed email type |
| Admin Department CRUD | ❌ Missing | View-only, no create/edit/delete |
| Admin Agent Management | ❌ Missing | View-only, no add/remove agents |
| Admin Assign Agent to Conversation | ❌ Missing | No assignment UI |
| Banking App "More" nav link | ❌ Missing | No "Support" item in `BankMore.tsx` |

---

## Gaps & Fix Plan

### 1. Admin Department CRUD (HIGH)

**Gap:** `AdminSupportChat.tsx` Departments tab is read-only — just lists departments. No forms to create, edit, toggle active, or delete departments.

**Fix:** Add inline "Add Department" form (name, description, icon dropdown, display_order) and edit/delete buttons per row. Use direct Supabase inserts/updates since admin RLS already permits full access.

### 2. Admin Agent Management (HIGH)

**Gap:** Agents tab only lists existing agents with no way to add, remove, or reassign agents to departments.

**Fix:** Add "Add Agent" dialog with user search (from `profiles` table), department selector, and max concurrent chats input. Add remove button per agent. Add status toggle (online/offline/busy).

### 3. Admin Assign Agent to Conversation (HIGH)

**Gap:** Conversation action bar has priority change and resolve/close but no agent assignment dropdown.

**Fix:** Add agent selector dropdown in the conversation action bar. On select, update `assigned_agent_id` and set status to `assigned`. Show assigned agent name in the conversation list item.

### 4. In-App Notification on New Message (HIGH)

**Gap:** No `app_notifications` record is created when an agent sends a message. Users won't know they have a reply unless they check the chat.

**Fix:** Add a DB trigger `notify_support_new_message()` on `support_messages` INSERT. When `sender_type = 'agent'`, insert into `app_notifications` for the conversation's `user_id` with title "New Support Reply" and message preview.

### 5. Push Notification via OneSignal (MEDIUM)

**Gap:** OneSignal is integrated (`useOneSignal.ts`) but not wired to support chat events.

**Fix:** In the same DB trigger (or a separate edge function call from the admin send flow), fire a push notification via OneSignal's REST API targeting the user's `user_id` tag. This can be done in the `useSendMessage` hook when `senderType === 'agent'` by invoking a lightweight edge function.

### 6. Email Notification on New Conversation & Agent Reply (MEDIUM)

**Gap:** No email is sent when a new support conversation is created or when an agent replies.

**Fix:** Add two `managed_email_types` entries: `support_new_conversation` and `support_agent_reply`. Fire via `managed-send-email` from the DB trigger or edge function. Include conversation subject, message preview, and a link to the app support page.

### 7. Banking App "More" Page — Missing Support Link (LOW)

**Gap:** `BankMore.tsx` `accountItems` array has "Help & Support" pointing to `more/help` (generic help page), but no direct link to the live chat at `more/support`.

**Fix:** Add a "Live Chat" item to `accountItems` with `MessageCircle` icon pointing to `more/support`, or update the existing "Help & Support" entry to point to the support chat.

### 8. File Upload — Missing Image Preview in ChatInput (LOW)

**Gap:** When a user selects an image file, the preview bar shows filename + icon but not an actual image thumbnail preview.

**Fix:** Add a small `<img>` thumbnail preview when `file.type.startsWith('image/')` using `URL.createObjectURL(file)`.

---

## Files to Modify/Create

| File | Action |
|---|---|
| `src/pages/admin/AdminSupportChat.tsx` | **Modify** — Add dept CRUD forms, agent add/remove, conversation assignment dropdown |
| `src/pages/banking-app/BankMore.tsx` | **Modify** — Add "Live Chat" item to accountItems |
| `src/components/support/ChatInput.tsx` | **Modify** — Add image thumbnail preview |
| `src/hooks/useSupportChat.ts` | **Modify** — Fire in-app notification + push notification on agent reply |
| **Migration** | **Create** — Add `notify_support_new_message()` trigger on `support_messages` for in-app notifications |
| **Migration** | **Create** — Insert `support_new_conversation` and `support_agent_reply` into `managed_email_types` |

## Scope

7 modifications across 5 existing files + 1 migration. No new edge functions required — the existing `managed-send-email` handles email delivery, and in-app notifications use the existing `app_notifications` table with a DB trigger.

