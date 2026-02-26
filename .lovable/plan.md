

# KYC/KYB Document Upload & Persistent Storage — Implementation Plan

## Current State

**What exists:**
- `business_kyc` table already has document URL columns: `registration_certificate_url`, `articles_of_association_url`, `tax_certificate_url`, `proof_of_address_url`, `bank_statement_url`
- `kyc_verifications` table has: `document_front_url`, `document_back_url`, `selfie_url`
- Admin review pages (`BusinessKYCReview.tsx`, `KYCVerificationReview.tsx`) already have buttons to view documents via URL — but the URLs are never populated
- Forms have placeholder "Upload Files" buttons that do nothing
- **No storage bucket exists** — no files can actually be uploaded or stored

**What is missing:**
1. No storage bucket for KYC/KYB documents
2. No file upload UI components in either form
3. The `business-kyc-submit` edge function does not accept document URLs
4. The `KycDueDiligence.tsx` page only shows a toast on submit — no actual database persistence
5. No selfie capture or document image upload capability

---

## Implementation Plan

### Step 1 — Database: Create Storage Bucket + RLS Policies (Migration)

Create a `kyc-documents` storage bucket with RLS policies:
- Authenticated users can upload to their own folder (`{user_id}/kyc/*` and `{user_id}/kyb/*`)
- Authenticated users can read their own files
- Admin role users can read all files (for review)
- Public read disabled (sensitive documents)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents', 'kyc-documents', false, 10485760, 
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']);

-- Users upload to their own folder
CREATE POLICY "Users upload own KYC docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users read own docs
CREATE POLICY "Users read own KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins read all docs
CREATE POLICY "Admins read all KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));
```

### Step 2 — Reusable Document Upload Component

Create `src/components/kyc/DocumentUploader.tsx`:
- Accepts `documentType` (e.g., "id_front", "registration_certificate"), `userId`, `folder` ("kyc" or "kyb")
- Drag-and-drop or click-to-upload interface
- Shows file preview (image thumbnail or PDF icon)
- Accepts JPEG, PNG, WebP, PDF — max 10MB
- Uploads to `kyc-documents/{userId}/{folder}/{documentType}_{timestamp}.{ext}`
- Returns the storage path on successful upload
- Shows upload progress and error states

### Step 3 — Enhance KycDueDiligence.tsx (Individual KYC Form)

Add actual file upload fields replacing the placeholder "Upload Files" button:

**Individual KYC documents (Tier 2):**
- ID Document Front (required) — passport, national ID, or driver's license
- ID Document Back (optional — required for national ID cards)
- Selfie / Liveness Photo (required)
- Proof of Address (required) — utility bill, bank statement < 3 months

**On submit:**
- Upload all files to storage bucket
- Call `kyc-submit` edge function with the storage URLs
- Show progress indicator during multi-file upload
- Persist to `kyc_verifications` table with status `pending`

### Step 4 — Enhance BusinessKYCForm.tsx (Business KYB Form)

Add document upload fields:

**Business KYB documents:**
- Registration Certificate / RCCM (required)
- Articles of Association / Statutes (required)
- Tax Certificate / Patente (optional)
- Proof of Business Address (required) — utility bill or lease
- Bank Statement (optional) — latest 3 months
- Board Resolution (optional) — for companies with boards
- UBO Declaration Document (optional)

**On submit:**
- Upload all files to storage bucket
- Update the `business-kyc-submit` edge function to accept and store document URLs
- Persist URLs to corresponding `business_kyc` columns

### Step 5 — Update Edge Function: business-kyc-submit

Add document URL fields to the request body parsing and database insert:
- `registration_certificate_url`
- `articles_of_association_url`
- `tax_certificate_url`
- `proof_of_address_url`
- `bank_statement_url`

### Step 6 — Enhance Admin Review Pages

Update both `BusinessKYCReview.tsx` and `KYCVerificationReview.tsx`:
- Show document thumbnails inline (not just external link buttons)
- Use signed URLs from storage for secure document viewing
- Add image preview dialog/lightbox for viewing uploaded documents
- Disable "View" buttons when URL is null (currently they open `null` in a new tab)

---

## Files Summary

### New Files (1)
| File | Purpose |
|------|---------|
| `src/components/kyc/DocumentUploader.tsx` | Reusable drag-and-drop file upload component with preview, progress, and storage integration |

### Modified Files (5)
| File | Changes |
|------|---------|
| `src/pages/regulatory/KycDueDiligence.tsx` | Replace placeholder upload buttons with real DocumentUploader fields for ID front/back, selfie, proof of address. Wire submit to actual `kyc-submit` edge function with file URLs. |
| `src/components/business/BusinessKYCForm.tsx` | Add DocumentUploader fields for registration certificate, articles, tax cert, proof of address, bank statement. Pass URLs to edge function on submit. |
| `supabase/functions/business-kyc-submit/index.ts` | Accept and persist document URL fields in request body. |
| `src/pages/admin/BusinessKYCReview.tsx` | Add null-checks on document buttons, add inline image previews using signed URLs. |
| `src/pages/admin/KYCVerificationReview.tsx` | Add null-checks on document buttons, add inline image previews using signed URLs. |

### Database Migration (1)
- Create `kyc-documents` storage bucket with RLS policies for user-scoped uploads and admin read access.

### No Breaking Changes
- All existing form fields preserved
- Document uploads are additive
- Admin review pages gain null-safety (improvement over current behavior of opening `null` URLs)

