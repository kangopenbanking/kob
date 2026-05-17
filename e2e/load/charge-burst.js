// Phase 8 — Scalability. Charge burst load test against the public sandbox.
// SLO: p95 < 1500ms, success >= 99.5%.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE = __ENV.KOB_BASE_URL || "https://sandbox-api.kangopenbanking.com/v1";
const KEY = __ENV.KOB_API_KEY || "sk_test_REPLACE_ME";

export const options = {
  scenarios: {
    burst: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 50, duration: "30s" },
        { target: 100, duration: "1m" },
        { target: 0, duration: "30s" },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.005"],
  },
};

const latency = new Trend("kob_charge_latency_ms");
const success = new Rate("kob_charge_success");

export default function () {
  const payload = JSON.stringify({
    amount: "1000",
    currency: "XAF",
    channel: "mobile_money",
    customer_phone: "237650000000",
    tx_ref: `load_${uuidv4()}`,
  });

  const res = http.post(`${BASE}/charges`, payload, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": uuidv4(),
      "X-Trace-Id": uuidv4(),
    },
    tags: { name: "POST /charges" },
  });

  latency.add(res.timings.duration);
  success.add(res.status >= 200 && res.status < 300);

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
    "X-Trace-Id echoed": (r) => !!r.headers["X-Trace-Id"],
  });

  sleep(0.2);
}
