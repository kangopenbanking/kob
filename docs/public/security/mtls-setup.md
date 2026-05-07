# mTLS Certificate Setup

Production traffic requires mutual TLS with certificate-bound access tokens (RFC 8705). Sandbox accepts plain TLS.

## 1. Generate a private key

```bash
openssl genrsa -out kang-prod.key 2048
```

## 2. Create a CSR

```bash
openssl req -new -key kang-prod.key -out kang-prod.csr \
  -subj "/C=CM/ST=Littoral/L=Douala/O=YourBank/CN=api.yourbank.cm"
```

## 3. Get a signed certificate

Submit `kang-prod.csr` to a recognised CA (DigiCert, Sectigo, Let's Encrypt for non-eIDAS use). Save the result as `kang-prod.crt`.

## 4. Verify the key matches the cert

```bash
openssl x509 -noout -modulus -in kang-prod.crt | openssl md5
openssl rsa  -noout -modulus -in kang-prod.key  | openssl md5
# Both MD5 hashes must match
```

## 5. Register with Kang

```bash
curl -X POST https://api.kangopenbanking.com/v1/certificates/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"production-2026\",\"certificate\":\"$(awk '{printf "%s\\n", $0}' kang-prod.crt)\"}"
```

## 6. Use in client requests

### Node.js

```ts
import https from 'node:https';
import fs from 'node:fs';

const agent = new https.Agent({
  cert: fs.readFileSync('kang-prod.crt'),
  key:  fs.readFileSync('kang-prod.key'),
});
```

### Python

```python
import requests
session = requests.Session()
session.cert = ('kang-prod.crt', 'kang-prod.key')
```

### Go

```go
cert, _ := tls.LoadX509KeyPair("kang-prod.crt", "kang-prod.key")
client := &http.Client{Transport: &http.Transport{
    TLSClientConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
}}
```

## Renewal

Certificates are valid for 12 months. Set up a cron 30 days before expiry:

```bash
EXPIRY=$(openssl x509 -enddate -noout -in kang-prod.crt | cut -d= -f2)
DAYS=$(( ( $(date -d "$EXPIRY" +%s) - $(date +%s) ) / 86400 ))
[ "$DAYS" -lt 30 ] && /usr/local/bin/renew-kang-cert.sh
```

## Troubleshooting

- **403 `CERT_INVALID`** — certificate not registered or expired. Re-upload via step 5.
- **403 `CERT_MISMATCH`** — client presented a cert different from the one registered.
- **Handshake failure** — check the full chain is sent (`cat cert.crt intermediate.crt > bundle.crt`).

See also: [/developer/authentication/mtls](/developer/authentication/mtls), [/developer/api/certificates](/developer/api/certificates).
