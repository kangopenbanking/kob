-- Fix Function Search Path Mutable security issue
-- Add SET search_path TO 'public' to update_branch_updated_at function

CREATE OR REPLACE FUNCTION public.update_branch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;