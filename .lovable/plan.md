

## Firebase OTP Custom Domain Masking

This is a **Firebase Console configuration task**, not a code change. Here's what needs to be done:

### The Issue
When Firebase sends OTP SMS, the reCAPTCHA verification and SMS message reference the domain `342820e7-280a-44d3-88ce-2854c6d907ed.lovableproject.com` instead of your custom domain `kangopenbanking.com`.

### Solution Steps

1. **Add your custom domain to Firebase Authorized Domains**
   - Go to **Firebase Console → Authentication → Settings → Authorized domains**
   - Add `kangopenbanking.com` and `www.kangopenbanking.com`

2. **Set `authDomain` in Firebase config to your custom domain**
   - Update `src/lib/firebase.ts` to use `kangopenbanking.com` as the `authDomain` instead of the default Firebase auth domain
   - This makes the reCAPTCHA popup and any redirects show your custom domain

3. **DNS: Add Firebase verification records (if required)**
   - Firebase may require you to verify domain ownership via a TXT record on `kangopenbanking.com`

### Code Change (single file)

**`src/lib/firebase.ts`** — Override `authDomain` to use your custom domain:
```ts
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: 'kangopenbanking.com',  // Custom domain instead of Firebase default
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
};
```

### Important Notes
- Your custom domain `kangopenbanking.com` must be properly connected and serving your app (DNS pointing to Lovable) before this will work
- The domain must also be added to Firebase Console's authorized domains list
- The SMS message content itself is controlled by Google and cannot be fully customized on the free/Blaze plan — but the domain shown in the verification link will reflect your custom domain

