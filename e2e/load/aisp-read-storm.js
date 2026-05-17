// Phase 8 — Scalability. AISP read storm — high-RPS account/transactions reads.
// SLO: p95 < 800ms, success >= 99.9%.

import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE = __ENV.KOB_BASE_URL || "https://sandbox-api.kangopenbanking.com/v1";
const KEY = __ENV.KOB_API_KEY || "sk_test_REPLACE_ME";
const ACCOUNT_ID = __ENV.KOB_TEST_ACCOUNT_ID || "acc_sandbox_demo_001";

export const options = {
  scenarios: {
    storm: {
      executor: "constant-arrival-rate",
      rate: 200,
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.001"],
  },
};

export default function () {
  const res = http.get(
    `${BASE}/accounts/${ACCOUNT_ID}/transactions?limit=20`,
    {
      headers: {
        Authorization: `Bearer ${KEY}`,
        Accept: "application/json",
        "X-Trace-Id": uuidv4(),
      },
      tags: { name: "GET /accounts/:id/transactions" },
    }
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
    "has data array": (r) => {
      try { return Array.isArray(JSON.parse(r.body).data); } catch (_) { return false; }
    },
  });
}
