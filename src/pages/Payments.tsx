import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, CreditCard, Building2 } from "lucide-react";
import { CardPaymentForm } from "@/components/payments/CardPaymentForm";
import { BankTransferForm } from "@/components/payments/BankTransferForm";
import MobileMoney from "./MobileMoney";

const Payments = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Methods</h1>
        <p className="text-muted-foreground">
          Send and receive money using Mobile Money, Credit/Debit Cards, or Bank Transfer
        </p>
      </div>

      <Tabs defaultValue="mobile-money" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mobile-money" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Mobile Money
          </TabsTrigger>
          <TabsTrigger value="card-payment" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Credit/Debit Card
          </TabsTrigger>
          <TabsTrigger value="bank-transfer" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bank Transfer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mobile-money">
          <MobileMoney />
        </TabsContent>

        <TabsContent value="card-payment">
          <CardPaymentForm />
        </TabsContent>

        <TabsContent value="bank-transfer">
          <BankTransferForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Payments;
