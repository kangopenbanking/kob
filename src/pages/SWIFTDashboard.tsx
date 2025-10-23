import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";

interface SWIFTMessage {
  id: string;
  message_type: string;
  direction: string;
  sender_bic: string;
  receiver_bic: string;
  transaction_reference: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function SWIFTDashboard() {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<SWIFTMessage[]>([]);
  const [mt103Content, setMt103Content] = useState("");
  const [mt940Content, setMt940Content] = useState("");
  const [ibanToValidate, setIbanToValidate] = useState("");
  const [bicToValidate, setBicToValidate] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);

  // MT103 Generator form state
  const [mt103Form, setMt103Form] = useState({
    transactionReference: "",
    senderBic: "",
    receiverBic: "",
    valueDate: new Date().toISOString().split('T')[0],
    currency: "XAF",
    amount: "",
    orderingCustomerName: "",
    orderingCustomerAccount: "",
    beneficiaryName: "",
    beneficiaryAccount: "",
    beneficiaryBic: "",
    remittanceInfo: "",
  });

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("swift_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleMT103Upload = async () => {
    if (!mt103Content.trim()) {
      toast.error("Please paste MT103 content");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("swift-mt103-parser", {
        body: { mt103Content, institutionId: null },
      });

      if (error) throw error;

      toast.success("MT103 parsed successfully!");
      setMt103Content("");
      fetchMessages();
    } catch (error: any) {
      console.error("Error parsing MT103:", error);
      toast.error(error.message || "Failed to parse MT103");
    } finally {
      setLoading(false);
    }
  };

  const handleMT940Upload = async () => {
    if (!mt940Content.trim()) {
      toast.error("Please paste MT940 content");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("swift-mt940-parser", {
        body: { mt940Content, institutionId: null },
      });

      if (error) throw error;

      toast.success("MT940 parsed successfully!");
      setMt940Content("");
      fetchMessages();
    } catch (error: any) {
      console.error("Error parsing MT940:", error);
      toast.error(error.message || "Failed to parse MT940");
    } finally {
      setLoading(false);
    }
  };

  const handleMT103Generate = async () => {
    if (!mt103Form.transactionReference || !mt103Form.amount) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);
    try {
      const paymentData = {
        transactionReference: mt103Form.transactionReference,
        senderBic: mt103Form.senderBic,
        receiverBic: mt103Form.receiverBic,
        valueDate: mt103Form.valueDate,
        currency: mt103Form.currency,
        amount: parseFloat(mt103Form.amount),
        bankOperationCode: "CRED",
        orderingCustomer: {
          account: mt103Form.orderingCustomerAccount,
          name: mt103Form.orderingCustomerName,
        },
        beneficiaryCustomer: {
          account: mt103Form.beneficiaryAccount,
          name: mt103Form.beneficiaryName,
        },
        beneficiaryInstitution: mt103Form.beneficiaryBic ? { bic: mt103Form.beneficiaryBic } : undefined,
        remittanceInfo: mt103Form.remittanceInfo,
        detailsOfCharges: "SHA",
      };

      const { data, error } = await supabase.functions.invoke("swift-mt103-generator", {
        body: { paymentData, institutionId: null },
      });

      if (error) throw error;

      // Download the generated MT103
      const blob = new Blob([data.mt103Message], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MT103_${mt103Form.transactionReference}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("MT103 generated and downloaded!");
      fetchMessages();
    } catch (error: any) {
      console.error("Error generating MT103:", error);
      toast.error(error.message || "Failed to generate MT103");
    } finally {
      setLoading(false);
    }
  };

  const handleIBANValidation = async () => {
    if (!ibanToValidate.trim()) {
      toast.error("Please enter an IBAN");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-iban", {
        body: { iban: ibanToValidate },
      });

      if (error) throw error;

      setValidationResult({ type: "IBAN", ...data });
      if (data.valid) {
        toast.success("IBAN is valid!");
      } else {
        toast.error("IBAN is invalid");
      }
    } catch (error: any) {
      console.error("Error validating IBAN:", error);
      toast.error(error.message || "Failed to validate IBAN");
    } finally {
      setLoading(false);
    }
  };

  const handleBICValidation = async () => {
    if (!bicToValidate.trim()) {
      toast.error("Please enter a BIC");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-bic", {
        body: { bic: bicToValidate },
      });

      if (error) throw error;

      setValidationResult({ type: "BIC", ...data });
      if (data.valid) {
        toast.success("BIC is valid!");
      } else {
        toast.error("BIC is invalid");
      }
    } catch (error: any) {
      console.error("Error validating BIC:", error);
      toast.error(error.message || "Failed to validate BIC");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      validated: { variant: "default", icon: CheckCircle, color: "text-green-600" },
      processed: { variant: "default", icon: CheckCircle, color: "text-blue-600" },
      pending: { variant: "secondary", icon: AlertCircle, color: "text-yellow-600" },
      failed: { variant: "destructive", icon: XCircle, color: "text-red-600" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className={`w-3 h-3 mr-1 ${config.color}`} />
        {status}
      </Badge>
    );
  };

  const getDirectionBadge = (direction: string) => {
    return (
      <Badge variant={direction === "inbound" ? "outline" : "secondary"}>
        {direction === "inbound" ? "↓ In" : "↑ Out"}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">SWIFT Message Dashboard</h1>
        <p className="text-muted-foreground">
          Parse and generate SWIFT MT103/MT940 messages, validate IBAN and BIC codes
        </p>
      </div>

      <Tabs defaultValue="messages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="mt103-parser">MT103 Parser</TabsTrigger>
          <TabsTrigger value="mt940-parser">MT940 Parser</TabsTrigger>
          <TabsTrigger value="mt103-generator">MT103 Generator</TabsTrigger>
          <TabsTrigger value="validators">Validators</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>SWIFT Message History</CardTitle>
              <CardDescription>All processed SWIFT messages</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Sender BIC</TableHead>
                    <TableHead>Receiver BIC</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
                      <TableCell>
                        <Badge variant="outline">{msg.message_type}</Badge>
                      </TableCell>
                      <TableCell>{getDirectionBadge(msg.direction)}</TableCell>
                      <TableCell className="font-mono text-sm">{msg.transaction_reference}</TableCell>
                      <TableCell className="font-mono text-xs">{msg.sender_bic || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{msg.receiver_bic || "-"}</TableCell>
                      <TableCell>
                        {msg.amount ? `${msg.amount.toLocaleString()} ${msg.currency}` : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(msg.status)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mt103-parser">
          <Card>
            <CardHeader>
              <CardTitle>Parse MT103 Payment Message</CardTitle>
              <CardDescription>Paste MT103 SWIFT message content to parse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste MT103 content here... e.g. {1:F01BANKUS33AXXX0000000000}..."
                value={mt103Content}
                onChange={(e) => setMt103Content(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <Button onClick={handleMT103Upload} disabled={loading}>
                <Upload className="w-4 h-4 mr-2" />
                Parse MT103
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mt940-parser">
          <Card>
            <CardHeader>
              <CardTitle>Parse MT940 Bank Statement</CardTitle>
              <CardDescription>Paste MT940 SWIFT statement content to parse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste MT940 content here... e.g. :20:REFERENCE..."
                value={mt940Content}
                onChange={(e) => setMt940Content(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <Button onClick={handleMT940Upload} disabled={loading}>
                <Upload className="w-4 h-4 mr-2" />
                Parse MT940
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mt103-generator">
          <Card>
            <CardHeader>
              <CardTitle>Generate MT103 Payment Message</CardTitle>
              <CardDescription>Create a new MT103 SWIFT payment message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transaction Reference*</Label>
                  <Input
                    value={mt103Form.transactionReference}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, transactionReference: e.target.value })
                    }
                    placeholder="e.g. REF20250123001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value Date*</Label>
                  <Input
                    type="date"
                    value={mt103Form.valueDate}
                    onChange={(e) => setMt103Form({ ...mt103Form, valueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency*</Label>
                  <Input
                    value={mt103Form.currency}
                    onChange={(e) => setMt103Form({ ...mt103Form, currency: e.target.value })}
                    placeholder="XAF"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount*</Label>
                  <Input
                    type="number"
                    value={mt103Form.amount}
                    onChange={(e) => setMt103Form({ ...mt103Form, amount: e.target.value })}
                    placeholder="100000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sender BIC</Label>
                  <Input
                    value={mt103Form.senderBic}
                    onChange={(e) => setMt103Form({ ...mt103Form, senderBic: e.target.value })}
                    placeholder="BANKUS33XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Receiver BIC</Label>
                  <Input
                    value={mt103Form.receiverBic}
                    onChange={(e) => setMt103Form({ ...mt103Form, receiverBic: e.target.value })}
                    placeholder="BANKGB22XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordering Customer Name*</Label>
                  <Input
                    value={mt103Form.orderingCustomerName}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, orderingCustomerName: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordering Customer Account</Label>
                  <Input
                    value={mt103Form.orderingCustomerAccount}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, orderingCustomerAccount: e.target.value })
                    }
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary Name*</Label>
                  <Input
                    value={mt103Form.beneficiaryName}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, beneficiaryName: e.target.value })
                    }
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary Account</Label>
                  <Input
                    value={mt103Form.beneficiaryAccount}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, beneficiaryAccount: e.target.value })
                    }
                    placeholder="9876543210"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary BIC</Label>
                  <Input
                    value={mt103Form.beneficiaryBic}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, beneficiaryBic: e.target.value })
                    }
                    placeholder="BANKFR22XXX"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Remittance Information</Label>
                  <Input
                    value={mt103Form.remittanceInfo}
                    onChange={(e) =>
                      setMt103Form({ ...mt103Form, remittanceInfo: e.target.value })
                    }
                    placeholder="Payment for invoice INV-001"
                  />
                </div>
              </div>
              <Button onClick={handleMT103Generate} disabled={loading}>
                <Download className="w-4 h-4 mr-2" />
                Generate & Download MT103
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validators">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>IBAN Validator</CardTitle>
                <CardDescription>Validate International Bank Account Numbers (mod-97)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={ibanToValidate}
                    onChange={(e) => setIbanToValidate(e.target.value)}
                    placeholder="FR1420041010050500013M02606"
                  />
                </div>
                <Button onClick={handleIBANValidation} disabled={loading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate IBAN
                </Button>
                {validationResult?.type === "IBAN" && (
                  <div className="mt-4 p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      {validationResult.valid ? (
                        <CheckCircle className="text-green-600" />
                      ) : (
                        <XCircle className="text-red-600" />
                      )}
                      <span className="font-semibold">
                        {validationResult.valid ? "Valid IBAN" : "Invalid IBAN"}
                      </span>
                    </div>
                    {validationResult.valid && (
                      <>
                        <p className="text-sm">
                          <strong>Formatted:</strong> {validationResult.formatted}
                        </p>
                        <p className="text-sm">
                          <strong>Country:</strong> {validationResult.countryCode}
                        </p>
                        <p className="text-sm">
                          <strong>Check Digits:</strong> {validationResult.checkDigits}
                        </p>
                      </>
                    )}
                    {validationResult.errors && (
                      <ul className="text-sm text-red-600 list-disc pl-4">
                        {validationResult.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>BIC Validator</CardTitle>
                <CardDescription>Validate Bank Identifier Codes (SWIFT)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>BIC / SWIFT Code</Label>
                  <Input
                    value={bicToValidate}
                    onChange={(e) => setBicToValidate(e.target.value)}
                    placeholder="BANKUS33XXX"
                  />
                </div>
                <Button onClick={handleBICValidation} disabled={loading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Validate BIC
                </Button>
                {validationResult?.type === "BIC" && (
                  <div className="mt-4 p-4 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      {validationResult.valid ? (
                        <CheckCircle className="text-green-600" />
                      ) : (
                        <XCircle className="text-red-600" />
                      )}
                      <span className="font-semibold">
                        {validationResult.valid ? "Valid BIC" : "Invalid BIC"}
                      </span>
                    </div>
                    {validationResult.valid && (
                      <>
                        <p className="text-sm">
                          <strong>Type:</strong> {validationResult.bicType}
                        </p>
                        <p className="text-sm">
                          <strong>Institution:</strong> {validationResult.institutionCode}
                        </p>
                        <p className="text-sm">
                          <strong>Country:</strong> {validationResult.countryCode}
                        </p>
                        <p className="text-sm">
                          <strong>Location:</strong> {validationResult.locationCode}
                        </p>
                        {validationResult.branchCode && (
                          <p className="text-sm">
                            <strong>Branch:</strong> {validationResult.branchCode}
                          </p>
                        )}
                      </>
                    )}
                    {validationResult.errors && (
                      <ul className="text-sm text-red-600 list-disc pl-4">
                        {validationResult.errors.map((err: string, i: number) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
