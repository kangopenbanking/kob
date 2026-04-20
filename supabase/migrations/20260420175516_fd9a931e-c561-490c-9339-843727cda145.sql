-- Strip remaining emojis from product_manuals & glossary content (chunk 1/4)
-- Standing Order: API contract NOT modified; this is a content-only update.
UPDATE public.product_manuals SET section_title=$kob$Introduction$kob$, content=$kob$## Welcome to Kang Open Banking for Financial Institutions

### What Is Kang Open Banking?

Think of Kang Open Banking (KOB) like a **smart bridge** that connects your bank to the modern digital world. Just like a bridge helps cars travel between two places, KOB helps your bank connect with mobile money services, card payments, and other financial tools — all in one place.

> **In Simple Terms:** KOB is a platform that lets your bank offer digital services (like mobile money, online payments, and credit scoring) without having to build everything from scratch.

### Why Does Your Bank Need This?

Imagine you run a shop and you want to accept every type of payment — cash, mobile money, bank cards, and online transfers. Without KOB, you would need to sign separate agreements and build separate systems for each one. With KOB, everything comes through **one single door**.

**Here's what your bank gets:**

| Feature | What It Means | Example |
|---------|--------------|---------|
| FI Portal | A dashboard to manage everything | See all transactions, customers, and reports in one place |
| Mobile Money | Accept MTN MoMo & Orange Money | A customer pays their loan using MoMo from their phone |
| Card Payments | Accept Visa & Mastercard | Process card payments at your branches or online |
| Compliance Tools | Stay on the right side of regulations | Automatic COBAC reports and AML checks |
| Staff Management | Control who does what | Give a teller permission to process payments, but not approve loans |

### How Does It Work? (The Big Picture)

Here is the journey at a glance:

```mermaid
flowchart LR
  A[Bank signs up on KOB] --> B[Receives FI Portal access]
  B --> C[Connects payment channels]
  C --> D[Customers transact digitally]
  D --> E[Bank monitors in real time]
```

### Who Is This Guide For?

This training course is designed for:

- **Bank Directors & Managers** — Understand what KOB does and how it benefits your institution
- **IT Teams** — Learn how to set up and configure the platform
- **Branch Managers** — Know how to use the daily tools
- **Compliance Officers** — Learn about regulatory reporting features
- **Tellers & Staff** — Understand the transaction processing workflow

> **Tip:** You don't need to be a tech expert to use KOB. This guide explains everything in plain language with real examples.

### What You'll Learn in This Course

By the end of this training, you will be able to:

1. Register your institution and complete onboarding
2. Navigate the FI Portal like a pro
3. Process transactions (Mobile Money, Cards, Bank Transfers)
4. Generate compliance reports for COBAC
5. Manage your staff and their permissions
6. Handle customer KYC verification

**Ready? Click "Next" to begin your first lesson.**
$kob$, updated_at=now() WHERE id='43dc7237-2721-4b87-a2ff-f3128f1b8355';

UPDATE public.product_manuals SET section_title=$kob$Getting Started$kob$, content=$kob$## Getting Started: Onboarding Your Institution

### What Is Onboarding?

Onboarding is like enrolling your child in a new school. Before they can attend classes, you need to fill out forms, provide documents, and get approval. Similarly, before your bank can use KOB, you need to complete a registration process.

### Step 1: Registration (Day 1)

Go to **kangopenbanking.com/register** and fill in your institution's details.

**What you'll need ready:**

| Document | Why We Need It | Example |
|----------|---------------|---------|
| Institution Legal Name | To verify your bank is real | "Banque Populaire du Cameroun" |
| Registration Number | Proof of legal registration | RC/DLA/2020/B/1234 |
| COBAC License | Proves you're authorized to operate | License No. COBAC-2020-045 |
| Contact Person | Someone we can reach out to | Jean Dupont, IT Director |
| Official Email | For sending credentials | it@yourbank.cm |

> **Real Example:** Banque Commerciale du Cameroun registers with their COBAC license number, their CEO's details, and their IT department's email. Within 24 hours, they receive a confirmation email.

### Step 2: KYB Verification (Days 2-5)

**KYB stands for "Know Your Business"** — it's like a background check, but for companies instead of people.

Think of it this way: If someone wants to open a bank account, you ask them for their ID card (that's KYC — Know Your Customer). When a **business** wants to join KOB, we ask the business to prove it's legitimate (that's KYB).

**What happens during KYB:**

1. You upload your business documents (registration certificate, tax documents)
2. Our compliance team reviews them
3. If everything checks out, you get approved
4. If something's missing, we'll tell you exactly what to fix

```mermaid
flowchart LR
  A[Your Documents] --> B[KOB Review Team]
  B -->|All good| C[Approved]
  B -->|Missing info| D[Request More Info]
  D --> A
```

### Step 3: Set Up Your First Branch (Days 3-7)

Every bank has branches (offices where customers visit). In KOB, you register your branches so transactions can be tracked by location.

**Example:** If your bank has 3 branches:
- Main Branch in Douala → Branch Code: DLA-001
- Branch in Yaoundé → Branch Code: YDE-001
- Branch in Bafoussam → Branch Code: BFS-001

Each branch can have its own staff, its own transactions, and its own reports.

### Step 4: Get Your API Credentials (Day 7)

API credentials are like a username and password, but for computers.

When your bank's computer system wants to talk to KOB's system, it needs to prove who it is. That's what API credentials do.

You'll receive:
- **Client ID** — Like a username (e.g., `kob_client_abc123`)
- **Client Secret** — Like a password (keep this VERY safe)
- **Sandbox Keys** — For testing without using real money

> **Important:** Your Client Secret is like the key to your bank vault. Never share it over email, chat, or phone. Only store it in secure systems.

### Step 5: Test in Sandbox (Days 7-14)

Before going live with real money, you test everything in a **sandbox** — a safe playground where no real money moves.

**Think of it like a flight simulator for pilots.** Pilots practice flying in a simulator before flying a real plane. Your team practices processing transactions in the sandbox before handling real customer money.

| Sandbox Action | What It Tests | Expected Result |
|---------------|---------------|-----------------|
| Send 5,000 XAF via MoMo | Mobile money works | Status: "Completed" |
| Process a card payment | Card integration works | Status: "Successful" |
| Generate a report | Reporting works | PDF downloads correctly |
| Create a staff account | User management works | Staff can log in |

### Timeline Summary

```mermaid
gantt
  title Institution Onboarding Timeline
  dateFormat  YYYY-MM-DD
  section Setup
  Registration & KYB Submission   :a1, 2026-01-01, 7d
  KYB Review & Branch Setup       :a2, after a1, 7d
  API Credentials & Sandbox Test  :a3, after a2, 7d
  Final Review & Go Live          :a4, after a3, 7d
```

Once all steps are complete, your institution goes live and can start processing real transactions.
$kob$, updated_at=now() WHERE id='09b4e9ea-fd4b-4a30-8e49-583d76e61755';