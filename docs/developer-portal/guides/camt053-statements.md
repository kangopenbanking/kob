# ISO 20022 camt.053 Statements

`/v1/statements` produces ISO 20022 `BankToCustomerStatementV08` (camt.053.001.08) XML statements alongside PDF and CSV variants.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/statements` | Request a new statement (returns `202` + job record) |
| `GET` | `/v1/statements/{id}` | Get job metadata + `download_url` |
| `GET` | `/v1/statements/{id}/content` | Download the raw statement |

## Create

```bash
curl -X POST https://api.kangopenbanking.com/v1/statements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "account_id": "1c3...e9b",
    "period_from": "2026-04-01",
    "period_to":   "2026-04-30",
    "format": "camt053"
  }'
```

```ts
// Node.js
const stmt = await kob.statements.create({
  account_id, period_from: "2026-04-01", period_to: "2026-04-30", format: "camt053"
});
const xml = await fetch(stmt.download_url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.text());
```

```py
# Python
stmt = kob.statements.create(account_id=acct, period_from="2026-04-01", period_to="2026-04-30")
xml = requests.get(stmt["download_url"], headers={"Authorization": f"Bearer {token}"}).text
```

## camt.053 envelope

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr>...</GrpHdr>
    <Stmt>
      <Id>...</Id>
      <Acct><Id><IBAN>CM21...</IBAN></Id><Ccy>XAF</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>...</Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>...</Bal>
      <Ntry>...</Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
```

Balance type codes:

| Code | Meaning |
|---|---|
| `OPBD` | Opening Booked |
| `CLBD` | Closing Booked |
| `ITBD` | Interim Booked (intra-day) |
