// Phase 8 — Scalability. Webhook delivery flood against the sandbox simulator.
// SLO: p95 delivery < 3000ms, success >= 99.0%.

import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const BASE = __ENV.KOB_BASE_URL || "https://sandbox-api.kangopenbanking.com/v1";
const KEY = __ENV.KOB_API_KEY || "sk_test_REPLACE_ME";

export const options = {
  vus: 30,
  duration: "2m",
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
  },
};

const EVENTS = [
  "charge.successful",
  "charge.failed",
  "payout.completed",
  "refund.processed",
];

export default function () {
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  const res = http.post(
    `${BASE}/sandbox/webhooks/simulate`,
    JSON.stringify({ event_type: event, delivery_id: uuidv4() }),
    {
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "X-Trace-Id": uuidv4(),
      },
      tags: { name: "POST /sandbox/webhooks/simulate" },
    }
  );

  check(res, {
    "queued or delivered": (r) => r.status === 200 || r.status === 202,
  });
}
