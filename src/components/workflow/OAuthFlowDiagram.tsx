export function OAuthFlowDiagram() {
  return (
    <div className="my-8 bg-muted p-6 rounded-lg overflow-x-auto">
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
{`OAuth 2.0 + FAPI 1.0 Authentication Flow

1. Client → PAR Endpoint
   POST /par (Pushed Authorization Request)
   - JAR validation
   - Request object signed
   Response: request_uri + expires_in

2. Client → Authorization Server
   GET /authorize?request_uri=xxx
   - Validate request_uri
   - User Authentication + SCA if needed
   Response: Authorization Code

3. Client → Token Endpoint (mTLS required)
   POST /token
   - Client certificate validation
   - Authorization code verification
   Response: Access Token + Refresh Token

4. Client → Protected API
   GET /aisp-accounts
   Bearer: access_token
   - Token validation
   - Scope verification
   - Rate limiting
   Response: Account Data (JSON)

Security: OAuth 2.0 + FAPI 1.0 Advanced + PAR + JAR + mTLS + PKCE`}
      </pre>
    </div>
  );
}
