// k6 — Charge burst scenario (Phase 8 load harness).
// Sandbox-only. Honors x-scalability.load_harness.slo_targets in public/openapi.json.
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    burst: { executor: "ramping-arrival-rate", startRate: 10, timeUnit: "1s",
      preAllocatedVUs: 50, maxVUs: 200,
      stages: [
        { target: 50, duration: "30s" },
        { target: 150, duration: "1m" },
        { target: 0,  duration: "30s" },
      ] },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed:   ["rate<0.005"],
  },
};

const BASE = __ENV.KOB_BASE || "https://sandbox-api.kangopenbanking.com/v1";
const TOKEN = __ENV.KOB_TOKEN || "sbx_test_token_placeholder";

export default function () {
  const idem = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(`${BASE}/gateway/charges`,
    JSON.stringify({ amount: "1000", currency: "XAF", channel: "mobile_money",
      customer_phone: "+237670000000", tx_ref: idem }),
    { headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
        "Idempotency-Key": idem,
      } });
  check(res, { "status is 2xx or 4xx (no 5xx)": (r) => r.status < 500 });
  sleep(0.1);
}
