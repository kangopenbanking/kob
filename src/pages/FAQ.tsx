import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQ() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Frequently Asked Questions</h1>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>What is Kang Open Banking?</AccordionTrigger>
          <AccordionContent>A unified API platform for accessing banking services across Cameroon's financial institutions.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How do I get started?</AccordionTrigger>
          <AccordionContent>Register for an account, complete KYC verification, and access our sandbox environment to test integrations.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>Is it secure?</AccordionTrigger>
          <AccordionContent>Yes, we use bank-grade encryption (TLS 1.3, AES-256) and are PCI-DSS Level 1 certified and COBAC compliant.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}