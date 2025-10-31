-- Phase 1: Database Schema Updates for mTLS + FAPI 1.0 Advanced (Fixed)

-- 1.1 Link Certificate Table to TPP Registrations
ALTER TABLE client_certificates 
  ADD COLUMN IF NOT EXISTS tpp_registration_id UUID REFERENCES tpp_registrations(id) ON DELETE CASCADE;

-- Add certificate thumbprint for RFC 8705 token binding
ALTER TABLE client_certificates 
  ADD COLUMN IF NOT EXISTS thumbprint TEXT UNIQUE;

-- Add usage tracking
ALTER TABLE client_certificates
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Add certificate serial number for validation
ALTER TABLE client_certificates
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Performance indexes (fixed - removed NOW() from predicate)
CREATE INDEX IF NOT EXISTS idx_client_certs_tpp_reg ON client_certificates(tpp_registration_id);
CREATE INDEX IF NOT EXISTS idx_client_certs_thumbprint ON client_certificates(thumbprint);
CREATE INDEX IF NOT EXISTS idx_client_certs_fingerprint ON client_certificates(fingerprint);
CREATE INDEX IF NOT EXISTS idx_client_certs_active ON client_certificates(tpp_registration_id, is_revoked, valid_until)
  WHERE is_revoked = false;

-- 1.2 Add Certificate Binding to Access Tokens
ALTER TABLE access_tokens
  ADD COLUMN IF NOT EXISTS cnf_thumbprint TEXT;

-- Add foreign key to certificate
ALTER TABLE access_tokens
  ADD COLUMN IF NOT EXISTS certificate_id UUID REFERENCES client_certificates(id);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_access_tokens_cnf ON access_tokens(cnf_thumbprint)
  WHERE cnf_thumbprint IS NOT NULL;

-- Add certificate binding to refresh tokens
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS cnf_thumbprint TEXT,
  ADD COLUMN IF NOT EXISTS certificate_id UUID REFERENCES client_certificates(id);

-- 1.3 Update TPP Registrations Table
ALTER TABLE tpp_registrations
  ADD COLUMN IF NOT EXISTS require_mtls BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mtls_subject_dn TEXT;

-- Add FAPI compliance level tracking
ALTER TABLE tpp_registrations
  ADD COLUMN IF NOT EXISTS fapi_profile TEXT CHECK (fapi_profile IN ('baseline', 'advanced')) DEFAULT 'advanced';

-- Create function to cleanup expired certificates
CREATE OR REPLACE FUNCTION cleanup_expired_certificates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark expired certificates (don't delete, for audit trail)
  UPDATE client_certificates
  SET is_revoked = true
  WHERE valid_until < NOW() AND is_revoked = false;
END;
$$;