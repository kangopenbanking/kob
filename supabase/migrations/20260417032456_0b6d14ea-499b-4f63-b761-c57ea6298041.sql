CREATE TABLE public.bank_profile_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_code TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL,
  country TEXT NOT NULL,
  swift_bic TEXT,
  recommended_adapter_type TEXT NOT NULL CHECK (recommended_adapter_type IN ('rest','sql','file','soap')),
  default_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  documentation_url TEXT,
  integration_notes TEXT,
  certified BOOLEAN NOT NULL DEFAULT false,
  certified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_profile_presets_country ON public.bank_profile_presets(country);
CREATE INDEX idx_bank_profile_presets_certified ON public.bank_profile_presets(certified) WHERE certified = true;

ALTER TABLE public.bank_profile_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bank presets are publicly readable"
ON public.bank_profile_presets FOR SELECT
USING (true);

CREATE POLICY "Admins can insert bank presets"
ON public.bank_profile_presets FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bank presets"
ON public.bank_profile_presets FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bank presets"
ON public.bank_profile_presets FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_bank_profile_presets_updated_at
BEFORE UPDATE ON public.bank_profile_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bank_profile_presets
  (bank_code, bank_name, country, swift_bic, recommended_adapter_type, default_config_json, documentation_url, integration_notes, certified)
VALUES
  ('AFRILAND_CM','Afriland First Bank','CM','AFRIACMCXXX','rest',
    '{"base_url_template":"https://api.afrilandfirstbank.com/openbanking/v1","auth":{"type":"oauth2_client_credentials","token_endpoint":"/oauth/token"},"endpoints":{"accounts":"/accounts/{account_id}","balance":"/accounts/{account_id}/balances","transactions":"/accounts/{account_id}/transactions"}}'::jsonb,
    'https://www.afrilandfirstbank.com/developer','REST + OAuth2 client credentials. Sandbox via direct partnership.',false),
  ('UBA_CM','United Bank for Africa Cameroon','CM','UNAFCMCXXXX','rest',
    '{"base_url_template":"https://api.ubagroup.com/openbanking/cm/v1","auth":{"type":"api_key","header":"X-API-Key"},"endpoints":{"accounts":"/accounts/{account_id}","balance":"/accounts/{account_id}/balance","transactions":"/accounts/{account_id}/transactions"}}'::jsonb,
    'https://developer.ubagroup.com','Group-wide API. Country-scoped via path prefix.',false),
  ('ECOBANK_CM','Ecobank Cameroon','CM','ECOCCMCXXXX','rest',
    '{"base_url_template":"https://developer.ecobank.com/api/v2","auth":{"type":"oauth2_client_credentials","token_endpoint":"/oauth2/token"},"endpoints":{"accounts":"/accounts/{account_id}","balance":"/accounts/{account_id}/balances","transactions":"/accounts/{account_id}/transactions"}}'::jsonb,
    'https://developer.ecobank.com','Pan-African Ecobank Developer Portal. Self-serve sandbox available.',false),
  ('BICEC_CM','BICEC','CM','BICECMCXXXX','soap',
    '{"wsdl_url_template":"https://swift.bicec.cm/services/CoreBanking?wsdl","auth":{"type":"ws_security_username_token"}}'::jsonb,
    null,'Legacy core banking. SOAP envelope with WS-Security required.',false),
  ('SGC_CM','Société Générale Cameroun','CM','SGCMCMCXXXX','rest',
    '{"base_url_template":"https://api.sgmaroc.com/openbanking/cm/v1","auth":{"type":"oauth2_client_credentials"},"endpoints":{"accounts":"/aisp/accounts","balance":"/aisp/accounts/{account_id}/balances","transactions":"/aisp/accounts/{account_id}/transactions"}}'::jsonb,
    null,'Group SG OpenBanking API. PSD2-style consent flow.',false),
  ('CCA_CM','CCA Bank','CM','CCAICMCXXXX','file',
    '{"file_format":"csv","sftp":{"host_template":"sftp.ccabank.cm","path":"/exports/daily","schedule":"02:00 Africa/Douala"},"columns":["date","reference","amount","currency","description"]}'::jsonb,
    null,'Daily SFTP CSV drop. No real-time API. Use file-bank adapter.',false),
  ('CBC_CM','Commercial Bank of Cameroon','CM','CBCRCMCXXXX','sql',
    '{"db_type":"oracle","gateway_url_template":"https://sql-gateway.cbc.cm/v1/query","watermark_column":"booking_datetime"}'::jsonb,
    null,'Direct read-only SQL via secured gateway. Read-only enforced by adapter.',false),
  ('BGFI_CM','BGFI Bank Cameroon','CM','BGFICMCXXXX','rest',
    '{"base_url_template":"https://api.bgfibank.com/v1","auth":{"type":"mtls_oauth2"},"endpoints":{"accounts":"/accounts","balance":"/accounts/{account_id}/balance","transactions":"/accounts/{account_id}/transactions"}}'::jsonb,
    null,'mTLS + OAuth2. Requires QWAC certificate per FAPI 1.0 Advanced.',false),
  ('NFC_CM','NFC Bank','CM','NFBKCMCXXXX','file',
    '{"file_format":"mt940","sftp":{"host_template":"sftp.nfcbank.cm","path":"/swift/incoming","schedule":"hourly"}}'::jsonb,
    null,'SWIFT MT940 hourly drop. Use file-bank adapter with MT940 parser.',false),
  ('ORABANK_GA','Orabank Gabon','GA','ORGAGAGAXXX','rest',
    '{"base_url_template":"https://api.orabank.net/v1","auth":{"type":"oauth2_client_credentials"}}'::jsonb,
    null,'Pan-African Orabank Group API. CEMAC neighbour.',false),
  ('BOA_CG','Bank of Africa Congo','CG','AFRICGCGXXX','rest',
    '{"base_url_template":"https://api.boagroup.com/cg/v1","auth":{"type":"api_key"}}'::jsonb,
    null,'BOA Group regional API. CEMAC neighbour.',false),
  ('BEAC_CLEARING','BEAC Regional Clearing','CM','BEACCMCXXXX','soap',
    '{"wsdl_url_template":"https://clearing.beac.int/sygma/CoreSettlement?wsdl","auth":{"type":"mtls_ws_security"}}'::jsonb,
    null,'BEAC SYGMA clearing system. mTLS + WS-Security. Restricted access.',false);
