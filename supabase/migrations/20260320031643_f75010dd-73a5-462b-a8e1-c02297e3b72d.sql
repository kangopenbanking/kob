
-- Add institution_id to banks table to link banks to institutions
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id);
CREATE INDEX IF NOT EXISTS idx_banks_institution_id ON public.banks(institution_id);

-- bank_file_uploads: institution owner can read/insert
CREATE POLICY "institution_owner_select_bank_file_uploads"
ON public.bank_file_uploads FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_insert_bank_file_uploads"
ON public.bank_file_uploads FOR INSERT TO authenticated
WITH CHECK (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- bank_file_rows: institution owner can read via file's bank_id
CREATE POLICY "institution_owner_select_bank_file_rows"
ON public.bank_file_rows FOR SELECT TO authenticated
USING (
  file_id IN (
    SELECT bfu.id FROM public.bank_file_uploads bfu
    JOIN public.banks b ON b.id = bfu.bank_id
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- bank_data_mappings: institution owner CRUD
CREATE POLICY "institution_owner_select_bank_data_mappings"
ON public.bank_data_mappings FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_insert_bank_data_mappings"
ON public.bank_data_mappings FOR INSERT TO authenticated
WITH CHECK (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_update_bank_data_mappings"
ON public.bank_data_mappings FOR UPDATE TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- ingestion_runs: institution owner can read
CREATE POLICY "institution_owner_select_ingestion_runs"
ON public.ingestion_runs FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- bank_batch_jobs: institution owner can read/insert/update
CREATE POLICY "institution_owner_select_bank_batch_jobs"
ON public.bank_batch_jobs FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_insert_bank_batch_jobs"
ON public.bank_batch_jobs FOR INSERT TO authenticated
WITH CHECK (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_update_bank_batch_jobs"
ON public.bank_batch_jobs FOR UPDATE TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- bank_batch_items: institution owner via batch -> bank
CREATE POLICY "institution_owner_select_bank_batch_items"
ON public.bank_batch_items FOR SELECT TO authenticated
USING (
  batch_id IN (
    SELECT bbj.id FROM public.bank_batch_jobs bbj
    JOIN public.banks b ON b.id = bbj.bank_id
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

CREATE POLICY "institution_owner_insert_bank_batch_items"
ON public.bank_batch_items FOR INSERT TO authenticated
WITH CHECK (
  batch_id IN (
    SELECT bbj.id FROM public.bank_batch_jobs bbj
    JOIN public.banks b ON b.id = bbj.bank_id
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- bank_status_events: institution owner via batch_item -> batch -> bank
CREATE POLICY "institution_owner_select_bank_status_events"
ON public.bank_status_events FOR SELECT TO authenticated
USING (
  batch_item_id IN (
    SELECT bbi.id FROM public.bank_batch_items bbi
    JOIN public.bank_batch_jobs bbj ON bbj.id = bbi.batch_id
    JOIN public.banks b ON b.id = bbj.bank_id
    WHERE b.institution_id IN (
      SELECT i.id FROM public.institutions i WHERE i.user_id = auth.uid()
    )
  )
);

-- Staff access policies
CREATE POLICY "staff_select_bank_file_uploads"
ON public.bank_file_uploads FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    JOIN public.staff_assignments sa ON sa.institution_id = b.institution_id
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);

CREATE POLICY "staff_select_bank_data_mappings"
ON public.bank_data_mappings FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    JOIN public.staff_assignments sa ON sa.institution_id = b.institution_id
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);

CREATE POLICY "staff_select_bank_batch_jobs"
ON public.bank_batch_jobs FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    JOIN public.staff_assignments sa ON sa.institution_id = b.institution_id
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);

CREATE POLICY "staff_select_ingestion_runs"
ON public.ingestion_runs FOR SELECT TO authenticated
USING (
  bank_id IN (
    SELECT b.id FROM public.banks b
    JOIN public.staff_assignments sa ON sa.institution_id = b.institution_id
    WHERE sa.user_id = auth.uid() AND sa.is_active = true
  )
);
