
-- Function to auto-create notifications on account balance changes
CREATE OR REPLACE FUNCTION public.notify_account_balance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account RECORD;
  v_change_amount NUMERIC;
  v_direction TEXT;
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Get account owner info
  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_change_amount := ABS(NEW.amount - COALESCE(OLD.amount, 0));
  
  IF NEW.credit_debit_indicator = 'Credit' THEN
    v_direction := 'credited';
    v_notif_type := 'success';
  ELSE
    v_direction := 'debited';
    v_notif_type := 'warning';
  END IF;

  v_title := 'Balance Update';
  v_message := format('Your account %s was %s with %s %s.', 
    LEFT(v_account.account_id, 8) || '...', v_direction, NEW.currency, TO_CHAR(v_change_amount, 'FM999,999,999.00'));

  INSERT INTO public.app_notifications (user_id, institution_id, type, title, message, icon, metadata)
  VALUES (
    v_account.user_id,
    v_account.institution_id,
    v_notif_type,
    v_title,
    v_message,
    'balance',
    jsonb_build_object('account_id', v_account.id, 'amount', v_change_amount, 'currency', NEW.currency, 'direction', v_direction)
  );

  RETURN NEW;
END;
$$;

-- Function to auto-create notifications on new transactions
CREATE OR REPLACE FUNCTION public.notify_new_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account RECORD;
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.credit_debit_indicator = 'Credit' THEN
    v_notif_type := 'success';
    v_title := 'Money Received';
    v_message := format('You received %s %s. Ref: %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.reference, 'N/A'));
  ELSE
    v_notif_type := 'info';
    v_title := 'Payment Sent';
    v_message := format('You sent %s %s. Ref: %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.reference, 'N/A'));
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
$$;

-- Function to notify on KYC status changes
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'approved' THEN
      v_notif_type := 'success';
      v_title := 'KYC Approved';
      v_message := 'Your identity verification has been approved. Full account access is now available.';
    WHEN 'rejected' THEN
      v_notif_type := 'warning';
      v_title := 'KYC Rejected';
      v_message := format('Your identity verification was not successful. Reason: %s', COALESCE(NEW.rejection_reason, 'Please contact support.'));
    WHEN 'pending' THEN
      v_notif_type := 'info';
      v_title := 'KYC Under Review';
      v_message := 'Your identity documents are being reviewed. We will notify you once completed.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (user_id, institution_id, type, title, message, icon, metadata)
  VALUES (
    NEW.user_id,
    NULL,
    v_notif_type,
    v_title,
    v_message,
    'kyc',
    jsonb_build_object('verification_id', NEW.id, 'status', NEW.status, 'verification_type', NEW.verification_type)
  );

  RETURN NEW;
END;
$$;

-- Function to notify on mobile money transaction status changes
CREATE OR REPLACE FUNCTION public.notify_mobile_money_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'completed' THEN
      v_notif_type := 'success';
      v_title := 'Mobile Money Transfer Complete';
      v_message := format('%s %s transfer to %s completed successfully.', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.phone_number, 'recipient'));
    WHEN 'failed' THEN
      v_notif_type := 'warning';
      v_title := 'Mobile Money Transfer Failed';
      v_message := format('%s %s transfer failed. %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.error_message, 'Please try again.'));
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (user_id, institution_id, type, title, message, icon, metadata)
  VALUES (
    NEW.user_id,
    NEW.facilitated_institution_id,
    v_notif_type,
    v_title,
    v_message,
    'mobile_money',
    jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

-- Function to notify on bank transfer status changes
CREATE OR REPLACE FUNCTION public.notify_bank_transfer_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'completed' THEN
      v_notif_type := 'success';
      v_title := 'Bank Transfer Complete';
      v_message := format('%s %s transfer to %s at %s completed.', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.account_name, NEW.account_number), NEW.bank_name);
    WHEN 'failed' THEN
      v_notif_type := 'warning';
      v_title := 'Bank Transfer Failed';
      v_message := format('%s %s transfer failed. %s', NEW.currency, TO_CHAR(NEW.amount, 'FM999,999,999.00'), COALESCE(NEW.error_message, 'Please try again.'));
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.app_notifications (user_id, institution_id, type, title, message, icon, metadata)
  VALUES (
    NEW.user_id,
    NEW.facilitated_institution_id,
    v_notif_type,
    v_title,
    v_message,
    'bank_transfer',
    jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_notify_balance_change
  AFTER INSERT OR UPDATE ON public.account_balances
  FOR EACH ROW EXECUTE FUNCTION public.notify_account_balance_change();

CREATE TRIGGER trg_notify_new_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_transaction();

CREATE TRIGGER trg_notify_kyc_status
  AFTER UPDATE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_status_change();

CREATE TRIGGER trg_notify_mobile_money
  AFTER UPDATE ON public.mobile_money_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_mobile_money_status();

CREATE TRIGGER trg_notify_bank_transfer
  AFTER UPDATE ON public.bank_transfer_transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_bank_transfer_status();
