-- Fix the notify_new_transaction trigger to use existing column names
CREATE OR REPLACE FUNCTION public.notify_new_transaction()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_account RECORD;
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_ref := COALESCE(NEW.transaction_information, 'N/A');

  IF NEW.credit_debit_indicator = 'Credit' THEN
    v_notif_type := 'success';
    v_title := 'Money Received';
    v_message := format('You received %s %s. %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), LEFT(v_ref, 60));
  ELSE
    v_notif_type := 'info';
    v_title := 'Payment Sent';
    v_message := format('You sent %s %s. %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), LEFT(v_ref, 60));
  END IF;

  INSERT INTO public.app_notifications (user_id, institution_id, type, title, message, icon, metadata)
  VALUES (
    v_account.user_id,
    v_account.institution_id,
    v_notif_type,
    v_title,
    v_message,
    'transaction',
    jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency, 'type', NEW.transaction_type)
  );

  RETURN NEW;
END;
$function$;