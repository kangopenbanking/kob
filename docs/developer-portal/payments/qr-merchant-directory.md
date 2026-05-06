# QR Merchant Directory (Partner Mode)

Public, paginated discovery of KOB merchants accepting EMVCo MPQR
payments. Designed for **external virtual-card apps** (Visa, Mastercard,
fintech wallets) that want to scan or list KOB merchants and push a
card-funded payment through the KOB PISP rail.

## Endpoints

```
GET https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants-qr-directory
GET https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants-qr-get?id=<uuid>
```

OpenAPI:
- `merchantsQrDirectoryList` → `/v1/merchants/qr-directory`
- `merchantsQrGet` → `/v1/merchants/qr-directory/{id}`

No authentication is required for either endpoint — the directory is
public by policy.

## Query Parameters (`/v1/merchants/qr-directory`)

| Parameter | Type | Notes |
|---|---|---|
| `country` | ISO 3166-1 alpha-2 | optional filter |
| `category` | ISO 18245 MCC (4 digits) | optional filter |
| `cursor` | string | pagination cursor |
| `limit` | int 1..100 | default 25 |

## Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "9b1c8c1e-1234-4f00-9aaa-aaaaaaaaaaaa",
      "name": "Acme Shop",
      "country": "CM",
      "mcc": "5411",
      "verified": true,
      "logo_url": "https://…/logo.png",
      "static_qr_payload": "00020101021126…6304ABCD"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

## cURL — list

```bash
curl "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants-qr-directory?country=CM&limit=25"
```

## cURL — single merchant + dynamic QR

```bash
curl "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants-qr-get?id=9b1c8c1e-1234-4f00-9aaa-aaaaaaaaaaaa&amount=5000&ref=order_001"
```

## Node.js

```ts
const list = await fetch(`${KOB_BASE}/functions/v1/merchants-qr-directory?country=CM`).then(r => r.json());
const one  = await fetch(`${KOB_BASE}/functions/v1/merchants-qr-get?id=${list.data[0].id}&amount=5000`).then(r => r.json());
```

## Python

```python
import requests
list_ = requests.get(f"{KOB_BASE}/functions/v1/merchants-qr-directory", params={"country": "CM"}).json()
one   = requests.get(f"{KOB_BASE}/functions/v1/merchants-qr-get",
                     params={"id": list_["data"][0]["id"], "amount": 5000}).json()
```

## PHP

```php
$list = json_decode(file_get_contents("$KOB_BASE/functions/v1/merchants-qr-directory?country=CM"), true);
$one  = json_decode(file_get_contents("$KOB_BASE/functions/v1/merchants-qr-get?id={$list['data'][0]['id']}&amount=5000"), true);
```

## Standards

- EMVCo MPM Specification v1.1 §4 (TLV) + §6 (CRC16-CCITT/FALSE)
- ISO 18245 (MCC), ISO 3166-1 alpha-2 (country)
- ORDER P1 — Public First Rule
- ORDER P4 — Open Spec Rule
