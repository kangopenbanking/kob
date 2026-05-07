# Python

```bash
pip install kangopenbanking
```

## Initialise

```python
import os
from kangopenbanking import KOBClient

kob = KOBClient(
    client_id=os.environ["KANG_CLIENT_ID"],
    client_secret=os.environ["KANG_CLIENT_SECRET"],
    environment="sandbox",
)
```

## Create a charge

```python
import uuid

charge = kob.gateway.charges.create(
    amount=50000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237670000000",
    tx_ref=str(uuid.uuid4()),
    idempotency_key=str(uuid.uuid4()),
)
```

## Retry with exponential backoff

```python
import time, random

def with_retry(fn, max_attempts=5):
    for i in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            status = getattr(e, "status", 0)
            if status not in (429, 500, 502, 503, 504) or i == max_attempts - 1:
                raise
            wait = getattr(e, "retry_after", None) or min(2 ** i, 30)
            time.sleep(wait + random.random())
```

## Verify a webhook (Flask)

```python
import hmac, hashlib, time
from flask import request, abort

def verify(secret: str):
    ts = request.headers.get("X-Webhook-Timestamp", "0")
    sig = request.headers.get("X-Webhook-Signature", "")
    if abs(time.time() - int(ts)) > 300:
        abort(400)
    expected = hmac.new(
        secret.encode(),
        f"{ts}.{request.data.decode()}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)
```
