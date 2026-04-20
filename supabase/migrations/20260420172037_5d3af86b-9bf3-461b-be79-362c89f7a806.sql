-- Step 1: expand check constraints to allow new manual types
ALTER TABLE public.product_manuals DROP CONSTRAINT IF EXISTS product_manuals_manual_type_check;
ALTER TABLE public.product_manuals ADD CONSTRAINT product_manuals_manual_type_check CHECK (manual_type = ANY (ARRAY['banks','customers','developers','merchants','pos_cashier','travel_agent','compliance_officer','investors']));
ALTER TABLE public.product_glossary DROP CONSTRAINT IF EXISTS product_glossary_manual_type_check;
ALTER TABLE public.product_glossary ADD CONSTRAINT product_glossary_manual_type_check CHECK (manual_type = ANY (ARRAY['banks','customers','developers','merchants','pos_cashier','travel_agent','compliance_officer','investors','all']));

-- Step 2: insert 4 new manuals from /tmp/manuals.sql (loaded in next step via separate insert tool after constraint expansion confirmed)
-- The full content (~70KB across 28 sections + 50 glossary terms) will be loaded via the data insert tool after this migration is approved.