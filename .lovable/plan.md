

# Live Chat Support System — Full Implementation Plan

## Overview

Build a multi-portal live chat support system with department routing, agent assignment, file/image uploads, and admin management. The chat widget appears as a floating button on the website (above the scroll-to-top/cookie banner), and as an integrated feature in the Consumer App, Merchant/Business App, and Banking App.

## Architecture

```text
┌─────────────────────────────────────────────────┐
│                   Database                       │
│  support_departments                             │
│  support_agents (user_id, department_id, status) │
│  support_conversations (user_id, dept, status,   │
│    assigned_agent_id, channel, priority)          │
│  support_messages (conversation_id, sender_type, │
│    content, file_url, file_type, read_at)         │
└────────────────────┬────────────────────────────┘
                     │ Realtime (postgres_changes)
     ┌───────────────┼───────────────────┐
     │               │                   │
  Website         Apps (Consumer,     Admin Portal
  Floating        Merchant, Banking)  (full management)
  Chat Widget     In-app chat page
```

## Database (1 migration)

**Tables:**

1. `support_departments` — id, name, description, icon, is_active, display_order
2. `support_agents` — id, user_id (FK profiles), department_id, status (online/offline/busy), max_concurrent_chats
3. `support_conversations` — id, user_id, department_id, assigned_agent_id, channel (website/consumer_app/merchant_app/banking_app), status (open/assigned/resolved/closed), priority (low/medium/high/urgent), subject, metadata, created_at, updated_at, resolved_at
4. `support_messages` — id, conversation_id, sender_type (user/agent/system), sender_id, content, file_url, file_type, read_at, created_at

RLS: Users see own conversations. Agents see assigned + unassigned in their department. Admins see all. Enable realtime on `support_messages` and `support_conversations`.

## Components to Create

### 1. Floating Chat Widget (Website — `src/components/SupportChatWidget.tsx`)
- Fixed bottom-right button (above cookie banner, z-50)
- Expands into a chat panel (400×500px on desktop, fullscreen on mobile)
- Step 1: Department picker (icons + names from `support_departments`)
- Step 2: Subject input + optional file
- Step 3: Live chat thread with message input, file/image upload button
- Realtime message subscription
- Unread badge on the floating button
- Add to `Layout.tsx` alongside `CookieConsentBanner`

### 2. Consumer App Chat Page (`src/pages/customer-app/CustomerSupport.tsx`)
- Route: `/app/support`
- Same chat flow but full-page mobile layout
- Add "Support" to `CustomerMore.tsx` utility items
- Conversation history list + active chat view

### 3. Merchant/Business App Chat (`src/pages/business-app/BusinessSupport.tsx`)
- Route: `/biz/support`
- Add to `BusinessMobileNav` quick actions or More section
- Same chat UI adapted for business context (channel = `merchant_app`)

### 4. Banking App Chat (`src/pages/banking-app/BankSupport.tsx`)
- Route: `/bank/:institutionId/support`
- Accessible from banking app More/Settings
- Channel = `banking_app`

### 5. Admin Support Dashboard (`src/pages/admin/AdminSupportChat.tsx`)
- Route: `/admin/support-chat`
- Left panel: conversation queue (filterable by department, status, priority)
- Right panel: active chat thread with agent replies
- Features: assign to agent/department, change priority, resolve/close, view user profile
- Department management tab (CRUD departments)
- Agent management tab (assign users as agents, set department, toggle online/offline)
- Stats: open conversations, avg response time, resolved today

### 6. Shared Chat Components (`src/components/support/`)
- `ChatThread.tsx` — message list with bubbles, timestamps, file previews
- `ChatInput.tsx` — text input + file upload (images & documents only, max 5MB)
- `DepartmentPicker.tsx` — grid of department cards
- `ConversationList.tsx` — list of user's past/active conversations

## File Upload
- Use existing `storefront-assets` bucket or create `support-attachments` bucket
- Accept: images (jpg/png/webp/gif) + documents (pdf/doc/docx) only
- Max 5MB per file
- Display inline previews for images, download links for documents

## Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_conversations;
```

## Navigation Updates

| Portal | Change |
|---|---|
| Website (`Layout.tsx`) | Add `<SupportChatWidget />` after `<CookieConsentBanner />` |
| Consumer App (`CustomerMore.tsx`) | Add "Support" item to utility list |
| Business App sidebar/nav | Add "Support" link |
| Banking App nav | Add "Support" link |
| Admin nav config | Add "Support Chat" under new "Support" section |
| Footer | Add "Live Chat" link |

## Files Summary

| File | Action |
|---|---|
| **Migration** | Create 4 tables + RLS + realtime |
| `src/components/support/ChatThread.tsx` | **Create** — shared message thread |
| `src/components/support/ChatInput.tsx` | **Create** — input with file upload |
| `src/components/support/DepartmentPicker.tsx` | **Create** — department selector |
| `src/components/support/ConversationList.tsx` | **Create** — conversation history |
| `src/components/SupportChatWidget.tsx` | **Create** — floating website widget |
| `src/pages/customer-app/CustomerSupport.tsx` | **Create** — consumer app chat |
| `src/pages/business-app/BusinessSupport.tsx` | **Create** — business app chat |
| `src/pages/banking-app/BankSupport.tsx` | **Create** — banking app chat |
| `src/pages/admin/AdminSupportChat.tsx` | **Create** — admin dashboard |
| `src/components/Layout.tsx` | **Modify** — add chat widget |
| `src/pages/customer-app/CustomerMore.tsx` | **Modify** — add Support link |
| `src/components/admin/admin-navigation-config.ts` | **Modify** — add Support section |
| `src/components/business-app/BusinessDesktopSidebar.tsx` | **Modify** — add Support link |
| `src/components/Footer.tsx` | **Modify** — add Live Chat link |
| `src/App.tsx` | **Modify** — add 4 new routes |

