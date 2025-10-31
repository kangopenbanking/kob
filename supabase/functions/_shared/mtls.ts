// Phase 2: mTLS Utility Functions
// RFC 8705 - OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens

/**
 * Client certificate extracted from request headers
 */
export interface ClientCertificate {
  pem: string;
  fingerprint: string; // SHA-256 hex
  thumbprint: string; // SHA-256 base64url (RFC 8705)
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
}

/**
 * Extract client certificate from Deno request headers
 * These headers are set by TLS terminator/reverse proxy when mTLS is configured
 */
export async function extractClientCertificate(req: Request): Promise<ClientCertificate | null> {
  try {
    // Check for certificate headers (set by TLS terminator/reverse proxy)
    const certPem = req.headers.get('X-Client-Cert'); // Base64 encoded PEM
    const certFingerprint = req.headers.get('X-Client-Cert-Fingerprint'); // SHA-256 hex
    const subjectDN = req.headers.get('X-SSL-Client-Subject-DN');
    const issuerDN = req.headers.get('X-SSL-Client-Issuer-DN');
    const serialNumber = req.headers.get('X-SSL-Client-Serial');
    const validFrom = req.headers.get('X-SSL-Client-Valid-From');
    const validUntil = req.headers.get('X-SSL-Client-Valid-Until');

    if (!certPem || !certFingerprint || !subjectDN) {
      console.log('No client certificate headers found in request');
      return null;
    }

    // Decode PEM from base64 (if needed)
    const pem = certPem.startsWith('-----BEGIN') 
      ? certPem 
      : atob(certPem);

    // Convert hex fingerprint to base64url thumbprint (RFC 8705 format)
    const thumbprint = hexToBase64Url(certFingerprint);

    console.log('Client certificate extracted successfully', {
      thumbprint,
      subjectDN,
      issuerDN,
      serialNumber
    });

    return {
      pem,
      fingerprint: certFingerprint.toLowerCase(),
      thumbprint,
      subjectDN: subjectDN || '',
      issuerDN: issuerDN || '',
      serialNumber: serialNumber || '',
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : new Date(),
    };
  } catch (error) {
    console.error('Failed to extract client certificate:', error);
    return null;
  }
}

/**
 * Convert hex string to base64url (RFC 8705 format)
 */
function hexToBase64Url(hex: string): string {
  const hexStr = hex.replace(/:/g, '').toLowerCase();
  const bytes = new Uint8Array(hexStr.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Validate certificate against registered certificates in database
 */
export async function validateClientCertificate(
  supabase: any,
  tppRegistrationId: string,
  certThumbprint: string
): Promise<{ valid: boolean; certificateId?: string; error?: string }> {
  try {
    console.log('Validating certificate', { tppRegistrationId, certThumbprint });

    // Query for matching certificate
    const { data: cert, error } = await supabase
      .from('client_certificates')
      .select('id, is_revoked, valid_until, tpp_registration_id')
      .eq('thumbprint', certThumbprint)
      .eq('tpp_registration_id', tppRegistrationId)
      .single();

    if (error || !cert) {
      console.error('Certificate not found', error);
      return { valid: false, error: 'Certificate not registered' };
    }

    // Check if revoked
    if (cert.is_revoked) {
      console.error('Certificate has been revoked');
      return { valid: false, error: 'Certificate has been revoked' };
    }

    // Check expiry
    if (new Date(cert.valid_until) < new Date()) {
      console.error('Certificate has expired');
      return { valid: false, error: 'Certificate has expired' };
    }

    console.log('Certificate validation successful', { certificateId: cert.id });
    return { valid: true, certificateId: cert.id };
  } catch (error) {
    console.error('Certificate validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Update certificate usage statistics
 */
export async function recordCertificateUsage(
  supabase: any,
  certificateId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('client_certificates')
      .update({
        usage_count: supabase.raw('usage_count + 1'),
        last_used_at: new Date().toISOString(),
      })
      .eq('id', certificateId);

    if (error) {
      console.error('Failed to record certificate usage:', error);
    }
  } catch (error) {
    console.error('Error recording certificate usage:', error);
  }
}

/**
 * Calculate SHA-256 fingerprint from PEM certificate
 */
export async function calculateCertificateFingerprint(pemCert: string): Promise<string> {
  try {
    // Remove PEM headers and newlines
    const certBody = pemCert
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '');

    // Decode base64 to get DER bytes
    const derBytes = Uint8Array.from(atob(certBody), c => c.charCodeAt(0));

    // Calculate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', derBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex.toLowerCase();
  } catch (error) {
    console.error('Failed to calculate certificate fingerprint:', error);
    throw new Error('Invalid certificate format');
  }
}

/**
 * Extract certificate details from PEM format
 * Basic extraction - for production, use a proper X.509 parsing library
 */
export function extractCertificateDetails(pemCert: string): {
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
} {
  try {
    // This is a simplified extraction
    // In production, use a proper X.509 parsing library
    
    // For now, return placeholder values
    // The actual extraction would parse the ASN.1 DER structure
    return {
      subjectDN: 'CN=Extracted from PEM',
      issuerDN: 'CN=CA',
      serialNumber: '00',
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    console.error('Failed to extract certificate details:', error);
    throw new Error('Invalid certificate format');
  }
}
