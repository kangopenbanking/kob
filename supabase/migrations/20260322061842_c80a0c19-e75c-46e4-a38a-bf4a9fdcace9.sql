-- 1. Loan application status notifications
CREATE OR REPLACE FUNCTION public.notify_loan_app_status_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_title TEXT; v_message TEXT; v_type TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'approved' THEN v_type:='success'; v_title:='Loan Application Approved'; v_message:=format('Your loan application #%s has been approved.',NEW.application_number);
    WHEN 'rejected' THEN v_type:='warning'; v_title:='Loan Application Rejected'; v_message:=format('Your loan application #%s was rejected. %s',NEW.application_number,COALESCE(NEW.rejection_reason,'Contact support.'));
    WHEN 'disbursed' THEN v_type:='success'; v_title:='Loan Disbursed'; v_message:=format('Funds for loan #%s have been disbursed.',NEW.application_number);
    ELSE RETURN NEW;
  END CASE;
  INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(NEW.user_id,v_type,v_title,v_message,'loan',jsonb_build_object('loan_app_id',NEW.id,'application_number',NEW.application_number,'status',NEW.status));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_loan_app_status AFTER UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION public.notify_loan_app_status_change();

-- 2. Dispute status notifications (user)
CREATE OR REPLACE FUNCTION public.notify_dispute_status_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_title TEXT; v_message TEXT; v_type TEXT;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'under_review' THEN v_type:='info'; v_title:='Dispute Under Review'; v_message:=format('Your dispute for %s %s is being reviewed.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00'));
    WHEN 'resolved' THEN v_type:='success'; v_title:='Dispute Resolved'; v_message:=format('Your dispute for %s %s has been resolved.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00'));
    WHEN 'closed' THEN v_type:='info'; v_title:='Dispute Closed'; v_message:='Your dispute has been closed.';
    ELSE RETURN NEW;
  END CASE;
  INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(NEW.user_id,v_type,v_title,v_message,'dispute',jsonb_build_object('dispute_id',NEW.id,'status',NEW.status,'amount',NEW.amount));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_dispute_status AFTER UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.notify_dispute_status_change();

-- 3. Gateway dispute (merchant)
CREATE OR REPLACE FUNCTION public.notify_gateway_dispute_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_merchant_user_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_merchant_user_id FROM gateway_merchants WHERE id=NEW.merchant_id;
  IF v_merchant_user_id IS NULL THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'open' THEN
      INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(v_merchant_user_id,'warning','New Dispute Filed',format('A dispute for %s %s filed.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00')),'dispute',jsonb_build_object('dispute_id',NEW.id,'status',NEW.status));
    WHEN 'won' THEN
      INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(v_merchant_user_id,'success','Dispute Won',format('Dispute for %s %s resolved in your favor.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00')),'dispute',jsonb_build_object('dispute_id',NEW.id,'status',NEW.status));
    WHEN 'lost' THEN
      INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(v_merchant_user_id,'warning','Dispute Lost',format('Dispute for %s %s resolved against you.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00')),'dispute',jsonb_build_object('dispute_id',NEW.id,'status',NEW.status));
    ELSE NULL;
  END CASE;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_gateway_dispute AFTER UPDATE ON public.gateway_disputes FOR EACH ROW EXECUTE FUNCTION public.notify_gateway_dispute_change();

-- 4. Payout status
CREATE OR REPLACE FUNCTION public.notify_payout_status_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_merchant_user_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_merchant_user_id FROM gateway_merchants WHERE id=NEW.merchant_id;
  IF v_merchant_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status='completed' THEN
    INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(v_merchant_user_id,'success','Payout Completed',format('Payout of %s %s processed.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00')),'payment',jsonb_build_object('payout_id',NEW.id,'status',NEW.status));
  ELSIF NEW.status='failed' THEN
    INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(v_merchant_user_id,'warning','Payout Failed',format('Payout of %s %s failed.',NEW.currency,TO_CHAR(NEW.amount,'FM999,999,999.00')),'payment',jsonb_build_object('payout_id',NEW.id,'status',NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_payout_status AFTER UPDATE ON public.gateway_payouts FOR EACH ROW EXECUTE FUNCTION public.notify_payout_status_change();

-- 5. Overdraft status
CREATE OR REPLACE FUNCTION public.notify_overdraft_status_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT user_id INTO v_user_id FROM accounts WHERE id=NEW.account_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;
  CASE NEW.status
    WHEN 'active' THEN INSERT INTO app_notifications(user_id,institution_id,type,title,message,icon,metadata) VALUES(v_user_id,NEW.institution_id,'success','Overdraft Approved',format('Overdraft of %s XAF approved.',TO_CHAR(NEW.approved_limit,'FM999,999,999')),'overdraft',jsonb_build_object('overdraft_id',NEW.id,'status',NEW.status));
    WHEN 'suspended' THEN INSERT INTO app_notifications(user_id,institution_id,type,title,message,icon,metadata) VALUES(v_user_id,NEW.institution_id,'warning','Overdraft Suspended','Your overdraft has been suspended.','overdraft',jsonb_build_object('overdraft_id',NEW.id,'status',NEW.status));
    WHEN 'revoked' THEN INSERT INTO app_notifications(user_id,institution_id,type,title,message,icon,metadata) VALUES(v_user_id,NEW.institution_id,'warning','Overdraft Revoked','Your overdraft has been revoked.','overdraft',jsonb_build_object('overdraft_id',NEW.id,'status',NEW.status));
    WHEN 'under_review' THEN INSERT INTO app_notifications(user_id,institution_id,type,title,message,icon,metadata) VALUES(v_user_id,NEW.institution_id,'info','Overdraft Under Review','Your overdraft is being reviewed.','overdraft',jsonb_build_object('overdraft_id',NEW.id,'status',NEW.status));
    ELSE NULL;
  END CASE;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_overdraft_status AFTER UPDATE ON public.account_overdraft_profiles FOR EACH ROW EXECUTE FUNCTION public.notify_overdraft_status_change();

-- 6. Approval request result
CREATE OR REPLACE FUNCTION public.notify_approval_request_status()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status IN ('approved','rejected') THEN
    INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(NEW.submitted_by,CASE WHEN NEW.status='approved' THEN 'success' ELSE 'warning' END,CASE WHEN NEW.status='approved' THEN 'Request Approved' ELSE 'Request Rejected' END,format('Your %s request has been %s.',REPLACE(NEW.request_type::TEXT,'_',' '),NEW.status),'approval',jsonb_build_object('request_id',NEW.id,'request_type',NEW.request_type,'status',NEW.status));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_approval_status AFTER UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.notify_approval_request_status();

-- 7. Njangi contribution
CREATE OR REPLACE FUNCTION public.notify_njangi_events()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_group_name TEXT;
BEGIN
  SELECT name INTO v_group_name FROM njangi_groups WHERE id=NEW.group_id;
  INSERT INTO app_notifications(user_id,type,title,message,icon,metadata) VALUES(NEW.user_id,'info','Njangi Contribution Recorded',format('Your contribution of %s XAF to "%s" recorded.',TO_CHAR(NEW.amount,'FM999,999,999'),COALESCE(v_group_name,'your group')),'njangi',jsonb_build_object('contribution_id',NEW.id,'group_id',NEW.group_id,'amount',NEW.amount));
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_notify_njangi_contribution AFTER INSERT ON public.njangi_contributions FOR EACH ROW EXECUTE FUNCTION public.notify_njangi_events();

-- 8. Add missing managed email types
INSERT INTO public.managed_email_types (email_key, category, name, description, default_subject, default_body_html, available_variables, trigger_event, is_system, is_active, sort_order)
VALUES
  ('loan_approved_email','banking','Loan Approved Email','Email on loan approval','Your Loan Has Been Approved','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Loan Approved</h2><p>Your loan application has been approved.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["application_number"]','loan_approved',true,true,50),
  ('loan_disbursed_email','banking','Loan Disbursed Email','Email on loan disbursement','Loan Funds Disbursed','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Funds Disbursed</h2><p>Your loan funds have been disbursed.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["application_number"]','loan_disbursed',true,true,51),
  ('dispute_customer_update','disputes','Dispute Update (Customer)','Email on dispute status change','Dispute Update','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Dispute Update</h2><p>Your dispute status is now <strong>{{status}}</strong>.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["dispute_id","status"]','dispute_status_changed',true,true,60),
  ('payout_completed_email','merchant','Payout Completed','Email on payout completion','Payout Completed','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2 style="color:#16a34a">Payout Completed</h2><p>Your payout has been processed.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["amount","currency"]','payout_completed',true,true,70),
  ('overdraft_status_email','banking','Overdraft Status Change','Email on overdraft status change','Overdraft Facility Update','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Overdraft Update</h2><p>Your overdraft status is now <strong>{{status}}</strong>.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["status","approved_limit"]','overdraft_status_changed',true,true,52),
  ('approval_request_result','banking_ops','Approval Request Result','Email on approval decision','Your Request Has Been Decided','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Request {{status}}</h2><p>Your <strong>{{request_type}}</strong> request has been <strong>{{status}}</strong>.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["request_type","status"]','approval_decided',true,true,90),
  ('njangi_contribution_email','njangi','Njangi Contribution','Email on contribution','Njangi Contribution Recorded','<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>Contribution Recorded</h2><p>Your contribution of <strong>{{amount}} XAF</strong> to "<strong>{{group_name}}</strong>" recorded.</p><p style="color:#999;font-size:12px;margin-top:24px">— Kang Open Banking</p></div>','["amount","group_name"]','njangi_contribution',true,true,100)
ON CONFLICT (email_key) DO NOTHING;