// k6 — Webhook flood scenario (Phase 8 load harness).
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 80,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed:   ["rate<0.005"],
  },
};

const BASE = __ENV.KOB_BASE || "https://sandbox-api.kangopenbanking.com/v1";
const TOKEN = __ENV.KOB_TOKEN || "sbx_test_token_placeholder";

export default function () {
  const res = http.post(`${BASE}/webhooks/test-deliver`,
    JSON.stringify({ event: "charge.succeeded", payload: { tx_ref: `k6-${Date.now()}` } }),
    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}` } });
  check(res, { "no 5xx": (r) => r.status < 500 });
}
