import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";

const GatewaySubscriptionsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Subscriptions API | Kang Open Banking" description="Create payment plans and manage recurring billing subscriptions." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Subscriptions API</h1>
      <p className="text-muted-foreground mt-2">Set up recurring billing with payment plans. Define intervals (daily, weekly, monthly, yearly) and let the system automatically charge customers via a cron-based scheduler.</p>
    </div>

    <h2 className="text-2xl font-semibold mt-8">Payment Plans</h2>
    <p className="text-muted-foreground">Plans define the pricing and billing cycle. Create a plan first, then subscribe customers to it.</p>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/payment-plans" description="Create a reusable payment plan."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", name: "Premium Monthly", amount: 15000, currency: "XAF", interval: "monthly", interval_count: 1, duration: 12, metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "plan_uuid", merchant_id: "mch_uuid", name: "Premium Monthly", amount: 15000, currency: "XAF", interval: "monthly", interval_count: 1, duration: 12, is_active: true, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "name", type: "string", required: true, description: "Plan name" },
        { name: "amount", type: "number", required: true, description: "Amount per billing cycle" },
        { name: "currency", type: "string", required: false, description: "ISO 4217 code, default XAF" },
        { name: "interval", type: "string", required: false, description: "daily | weekly | monthly | yearly (default: monthly)" },
        { name: "interval_count", type: "integer", required: false, description: "Number of intervals between charges (default: 1)" },
        { name: "duration", type: "integer", required: false, description: "Total number of billing cycles (null = infinite)" },
      ]}
    />

    <h2 className="text-2xl font-semibold mt-8">Subscriptions</h2>

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subscriptions" description="Subscribe a customer to a payment plan. The first charge is scheduled automatically."
      requestBody={JSON.stringify({ merchant_id: "mch_uuid", plan_id: "plan_uuid", customer_email: "john@example.com", customer_phone: "237677123456", customer_name: "John Doe", metadata: {} }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", merchant_id: "mch_uuid", plan_id: "plan_uuid", status: "active", customer_email: "john@example.com", next_charge_at: "2026-03-21T12:00:00Z", charges_made: 0, created_at: "2026-02-21T12:00:00Z" }, null, 2)}
      parameters={[
        { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
        { name: "plan_id", type: "uuid", required: true, description: "The payment plan to subscribe to" },
        { name: "customer_email", type: "string", required: true, description: "Customer email address" },
        { name: "customer_phone", type: "string", required: false, description: "Customer phone number" },
        { name: "customer_name", type: "string", required: false, description: "Customer display name" },
      ]}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/subscriptions/cancel" description="Cancel an active subscription. No further charges will be made."
      requestBody={JSON.stringify({ subscription_id: "sub_uuid", reason: "Customer requested cancellation" }, null, 2)}
      response={JSON.stringify({ id: "sub_uuid", status: "cancelled", cancel_reason: "Customer requested cancellation", cancelled_at: "2026-02-22T09:00:00Z" }, null, 2)}
      parameters={[
        { name: "subscription_id", type: "uuid", required: true, description: "Subscription to cancel" },
        { name: "reason", type: "string", required: false, description: "Cancellation reason" },
      ]}
    />
  </div>
);

export default GatewaySubscriptionsGuide;
