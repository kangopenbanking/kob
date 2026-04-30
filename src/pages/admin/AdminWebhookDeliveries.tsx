// Admin-scoped webhook deliveries viewer with replay
import { WebhookDeliveriesPanel } from "@/components/webhooks/WebhookDeliveriesPanel";

export default function AdminWebhookDeliveries() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook deliveries</h1>
        <p className="text-muted-foreground">Operator view across all merchant endpoints. Replays write an auditable new delivery row.</p>
      </div>
      <WebhookDeliveriesPanel scope="admin" />
    </div>
  );
}
