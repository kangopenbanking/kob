# Load harness — k6 (Phase 8)

Three scenarios bound to the public sandbox + SLO budgets published in
`public/openapi.json` → `x-scalability.load_harness`.

## Run locally

```bash
brew install k6  # or apt/choco
export KANG_CLIENT_ID=... KANG_CLIENT_SECRET=...
k6 run e2e/load/charge-burst.js
k6 run e2e/load/webhook-flood.js
k6 run e2e/load/aisp-read-storm.js
```

## SLO budgets

| Scenario          | p95 latency | error rate |
| ----------------- | ----------- | ---------- |
| charge-burst      | ≤ 1500 ms   | ≤ 0.5 %    |
| webhook-flood     | ≤ 800 ms    | ≤ 0.5 %    |
| aisp-read-storm   | ≤ 600 ms    | ≤ 0.5 %    |

A resilience report is auto-generated under `docs/audits/load-YYYY-MM-DD.md` once
results are uploaded by the operator. The harness intentionally does **not** run in
CI by default — it is invoked manually before each minor release per
Standing Order 6.
