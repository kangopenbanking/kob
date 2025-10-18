import { Card } from "@/components/ui/card";

export default function Contact() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">General Inquiries</h2>
          <p className="text-sm text-muted-foreground mb-4">Email: info@kangopenbanking.cm<br/>Phone: +237 233 XX XX XX</p>
        </Card>
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Technical Support</h2>
          <p className="text-sm text-muted-foreground mb-4">Email: support@kangopenbanking.cm<br/>24/7 Emergency: +237 233 XX XX XX</p>
        </Card>
      </div>
    </div>
  );
}