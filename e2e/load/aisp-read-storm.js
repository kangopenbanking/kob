// k6 — AISP read-storm scenario (Phase 8 load harness).
import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 120,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<600"],
    http_req_failed:   ["rate<0.005"],
  },
};

const BASE = __ENV.KOB_BASE || "https://sandbox-api.kangopenbanking.com/v1";
const TOKEN = __ENV.KOB_TOKEN || "sbx_test_token_placeholder";

export default function () {
  const res = http.get(`${BASE}/aisp/accounts`,
    { headers: { "Authorization": `Bearer ${TOKEN}` } });
  check(res, { "no 5xx": (r) => r.status < 500 });
}
