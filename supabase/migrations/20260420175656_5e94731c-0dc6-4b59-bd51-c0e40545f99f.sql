-- Strip remaining emojis from product_manuals — chunk 2/4 (customer manuals)
-- Standing Order: API contract NOT modified; this is a content-only update.
UPDATE public.product_manuals SET section_title=$kob$Account Setup$kob$, content=$kob$## Account Setup: Your First Steps

### Step 1: Download or Install Kang

Kang works as a **Progressive Web App (PWA)** — which means you can use it like a regular app, but you don't need to download it from an app store.

> **Note:** A PWA is like a website that behaves like an app. You open it in your phone's browser, and it works just like any other app — but better, because it doesn't take up much storage space.

**How to install on your phone:**

```
On Android:
1. Open Chrome browser
2. Go to your bank's Kang link
3. You'll see a banner: "Add to Home Screen"
4. Tap "Add"
5. Kang now appears on your home screen like a regular app

On iPhone:
1. Open Safari browser
2. Go to your bank's Kang link
3. Tap the share button at the bottom
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add"
6. Done
```

### Step 2: Create Your Account

When you open Kang for the first time, you'll need to create an account. It's like filling out a simple form.

**What you'll need:**
- Your email address (e.g., marie@email.com)
- Your phone number (e.g., 237677123456)
- A strong password

**What makes a strong password?**

| Weak Password | Strong Password | Why? |
|-----------------|-------------------|------|
| 123456 | M@rie2026!Kang | Has uppercase, lowercase, numbers, and symbols |
| password | My$ecureP@55word | Hard to guess but easy to remember |
| marie | K@ng_B@nk!2026 | Not a common word |

> **Tip:** Create a sentence and use the first letters. "I Love Kang Banking in 2026!" becomes "ILKBi2026!" — easy to remember, hard to guess.

### Step 3: Verify Your Identity (KYC)

After creating your account, you need to prove you are who you say you are. This is called **KYC (Know Your Customer)**.

It's like showing your ID card when you enter a building — it keeps everyone safe.

**How KYC works:**

```mermaid
flowchart TD
  A[Take photo of ID card<br/>front + back] --> B[Take a selfie]
  B --> C[Enter personal details]
  C --> D[Submit for review]
  D --> E{Verified?}
  E -->|Yes| F[Account activated]
  E -->|No| G[Resubmit clearer photo]
  G --> A
```

Verification typically takes 1 to 24 hours.

**Tips for a successful KYC submission:**
- Make sure your ID card photo is clear and well-lit
- For the selfie, look straight at the camera (no sunglasses)
- Enter your name EXACTLY as it appears on your ID
- Use a utility bill or bank statement as proof of address

### Step 4: Set Up Your Security

After KYC, protect your account with these security features:

**1. PIN Code (4 digits)** — like the PIN for your ATM card. You'll need it for every transaction. Never share it with anyone.

**2. Biometric Login** — use your fingerprint or face instead of typing your password. Faster and more secure.

**3. Two-Factor Authentication (2FA)** — when you log in, Kang sends a code to your phone. Even if someone knows your password, they can't log in without your phone.

```
Login Example:
1. Open Kang app
2. Enter email: marie@email.com
3. Enter password
4. Kang sends SMS: "Your code is 847291"
5. Enter code: 847291
6. You're in
```

### KYC Tiers: What You Can Do

The more documents you provide, the more you can do:

| Tier | What You Provide | Daily Limit | What You Get |
|------|-----------------|-------------|-------------|
| **Tier 1** (Basic) | Phone + Name | 100,000 XAF | Send/receive small amounts |
| **Tier 2** (Standard) | + National ID + Selfie | 1,000,000 XAF | Full access to all features |
| **Tier 3** (Premium) | + Address proof + Income docs | Unlimited | Business features, higher limits |

> **Example:** Marie signed up with just her phone number (Tier 1). She can send up to 100,000 XAF per day. Later, she uploads her CNI and selfie — she's now Tier 2 and can send up to 1,000,000 XAF per day.

### Account Setup Checklist

- Downloaded or installed Kang
- Created account with email and password
- Verified phone number
- Submitted KYC documents
- Set up 4-digit PIN
- Enabled biometric login
- Enabled two-factor authentication

Once all are complete, you're ready to start using Kang.
$kob$, updated_at=now() WHERE id='aab79db2-f0d8-4621-bd2d-1ba5b706d493';

UPDATE public.product_manuals SET section_title=$kob$Welcome to Kang$kob$, content=$kob$## Welcome to Kang — Your Digital Money Companion

### What Is Kang?

Imagine having a tiny bank branch in your pocket that never closes — that's Kang. Kang is an app that lets you do almost everything you'd normally need to visit a bank for, right from your phone.

> **In Simple Terms:** Kang is a phone app that lets you send money, save money, pay bills, and check your financial health — anytime, anywhere.

### What Can You Do With Kang?

| Feature | What It Does | Everyday Example |
|---------|-------------|-----------------|
| **Send Money** | Transfer money to anyone | Send 5,000 XAF to your sister in Bamenda for school fees |
| **Receive Money** | Get money from others | Receive your salary from your employer |
| **Piggy Bank** | Explore bank savings & personal goals | Browse savings from banks or create your own savings plan |
| **CrediQ Score** | Check your credit health | See if you qualify for a loan |
| **Virtual Card** | Shop online safely | Buy items from an online store |
| **Mobile Money** | Connect to MTN MoMo & Orange Money | Top up your MoMo wallet or send from Kang to Orange Money |
| **Bank Transfer** | Send to any bank account | Transfer rent money to your landlord's bank account |
| **Transaction History** | See all your past transactions | Check when you last paid your electricity bill |

### How Is Kang Different From Regular Banking?

| Traditional Bank | Kang |
|-----------------|------|
| Go to a branch and wait in line | Do it from your phone in seconds |
| Open only during business hours | Available 24 hours, 7 days a week |
| Fill out paper forms | Just tap a few buttons |
| Carry cash around | Money stays safe in digital form |
| Unclear credit history | CrediQ shows your score anytime |

### Is Kang Safe?

1. **Encryption** — All your data is scrambled so nobody can read it
2. **PIN/Biometric** — You need your fingerprint, face, or PIN to open the app
3. **Two-Factor Authentication** — Even if someone knows your password, they need your phone too
4. **Bank-Level Security** — The same security that big banks use
5. **Real-Time Monitoring** — Our system watches for suspicious activity 24/7

> **Note:** Your money in Kang is like money in a vault with three locks — you need all three keys (your phone, your password, and your fingerprint) to open it.

### Who Can Use Kang?

Anyone in Cameroon (and soon, across the CEMAC region) who has:
- A mobile phone (smartphone or feature phone)
- A valid national ID card (CNI) or passport
- A phone number (MTN, Orange, or any network)

No minimum balance required. You can start with 0 XAF and grow from there.

### Quick Tour of the App

When you open Kang, you'll land on a clean home screen showing your balance, your most-used actions (Send, Receive, Pay, Scan, History), your recent transactions, and a quick view of your savings goal and CrediQ score.

Ready to set up your account? Continue to the next lesson.
$kob$, updated_at=now() WHERE id='1a467d62-ad09-465d-81dd-6c202f53087a';