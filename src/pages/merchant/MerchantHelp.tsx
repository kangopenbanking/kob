import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HelpCircle, MessageSquare, Book, Mail, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FAQS = [
  { q: "How do I receive payouts?", a: "Configure a settlement account under Settlement Accounts, choose a payout schedule on the Payouts page, and funds are transferred automatically." },
  { q: "Why was my transaction declined?", a: "Common reasons are insufficient funds, expired card, fraud rules, or velocity limits. Review the transaction detail for the gateway response code." },
  { q: "How do refunds work?", a: "Open the transaction from the Transactions page, click Refund, choose full or partial. Refunds appear within 3–10 business days depending on the customer's bank." },
  { q: "How do I handle a dispute?", a: "Disputes appear under the Disputes tab. You have 7 days to respond with evidence (invoice, delivery proof). Missing the deadline forfeits the case." },
  { q: "Where do I find my API keys?", a: "Configuration → API Keys. Live keys are shown only once at creation. Use test keys for development." },
  { q: "How do I add team members?", a: "Operations → Locations & Staff. Add a staff member, assign a role and location, and they receive an invitation email." },
];

export default function MerchantHelp() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject || !message) { toast.error("Subject and message are required"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await (supabase.from("support_tickets") as any).insert({
        user_id: user.id,
        subject,
        category,
        message,
        priority: "normal",
        status: "open",
        source: "merchant-portal",
      });
      if (error) throw error;
      toast.success("Ticket submitted — we'll respond within 1 business day");
      setSubject(""); setMessage(""); setCategory("general");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit ticket");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <HelpCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Help & Support</h1>
          <p className="text-sm text-muted-foreground">Find answers or get in touch with our team</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card p-4">
          <Book className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">Documentation</p>
          <p className="mt-1 text-xs text-muted-foreground">Integration guides and API reference</p>
          <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
            <Link to="/developer">Open docs</Link>
          </Button>
        </Card>
        <Card className="border-border bg-card p-4">
          <Mail className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">Email us</p>
          <p className="mt-1 text-xs text-muted-foreground">merchant-support@kangfintechsolutions.com</p>
          <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
            <a href="mailto:merchant-support@kangfintechsolutions.com">Send email</a>
          </Button>
        </Card>
        <Card className="border-border bg-card p-4">
          <Phone className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">Call us</p>
          <p className="mt-1 text-xs text-muted-foreground">Mon–Fri, 8am–6pm WAT</p>
          <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
            <a href="tel:+237600000000">+237 600 000 000</a>
          </Button>
        </Card>
      </div>

      <Card className="border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold text-foreground">Frequently asked questions</p>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <Card className="border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Submit a support ticket</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General question</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
                <SelectItem value="payouts">Payouts & settlement</SelectItem>
                <SelectItem value="api">API & integration</SelectItem>
                <SelectItem value="disputes">Disputes</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Message</Label>
            <Textarea rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what's happening, include transaction IDs if applicable" />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit ticket
          </Button>
        </div>
      </Card>
    </div>
  );
}
