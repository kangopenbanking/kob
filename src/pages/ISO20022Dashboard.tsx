import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, Download, Send, CheckCircle, XCircle, Clock } from "lucide-react";

interface ISO20022Message {
  id: string;
  message_id: string;
  message_type: string;
  message_version: string;
  direction: string;
  status: string;
  creation_date_time: string;
  debtor_name?: string;
  creditor_name?: string;
  amount?: number;
  currency?: string;
  created_at: string;
}

export default function ISO20022Dashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ISO20022Message[]>([]);
  const [pain001XML, setPain001XML] = useState("");
  const [pacs008Form, setPacs008Form] = useState({
    payment_id: "",
    debtor_name: "",
    debtor_iban: "",
    debtor_bic: "",
    creditor_name: "",
    creditor_iban: "",
    creditor_bic: "",
    amount: "",
    currency: "EUR",
    remittance_information: "",
    end_to_end_id: ""
  });
  const [camt053XML, setCamt053XML] = useState("");

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("iso20022_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch ISO 20022 messages",
        variant: "destructive",
      });
    } else {
      setMessages(data || []);
    }
  };

  const handlePain001Upload = async () => {
    if (!pain001XML.trim()) {
      toast({
        title: "Error",
        description: "Please paste pain.001 XML content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('iso20022-pain001-parser', {
        body: { xml_content: pain001XML }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `pain.001 message parsed successfully. Message ID: ${data.iso_message_id}`,
      });
      
      setPain001XML("");
      fetchMessages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse pain.001 message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePacs008Generate = async () => {
    if (!pacs008Form.debtor_name || !pacs008Form.creditor_name || !pacs008Form.amount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('iso20022-pacs008-generator', {
        body: {
          ...pacs008Form,
          amount: parseFloat(pacs008Form.amount),
          payment_id: pacs008Form.payment_id || `TXN-${Date.now()}`,
          end_to_end_id: pacs008Form.end_to_end_id || `E2E-${Date.now()}`
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `pacs.008 message generated. Message ID: ${data.iso_message_id}`,
      });
      
      // Download XML
      const blob = new Blob([data.xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pacs008_${data.iso_message_id}.xml`;
      a.click();
      
      setPacs008Form({
        payment_id: "",
        debtor_name: "",
        debtor_iban: "",
        debtor_bic: "",
        creditor_name: "",
        creditor_iban: "",
        creditor_bic: "",
        amount: "",
        currency: "EUR",
        remittance_information: "",
        end_to_end_id: ""
      });
      fetchMessages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate pacs.008 message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCamt053Upload = async () => {
    if (!camt053XML.trim()) {
      toast({
        title: "Error",
        description: "Please paste camt.053 XML content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('iso20022-camt053-parser', {
        body: { xml_content: camt053XML }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `camt.053 statement parsed successfully`,
      });
      
      setCamt053XML("");
      fetchMessages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to parse camt.053 statement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      received: { variant: "default", icon: <CheckCircle className="h-3 w-3" /> },
      sent: { variant: "default", icon: <Send className="h-3 w-3" /> },
      pending: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
      rejected: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getDirectionBadge = (direction: string) => {
    return (
      <Badge variant={direction === 'inbound' ? 'outline' : 'secondary'}>
        {direction === 'inbound' ? <Download className="h-3 w-3 mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
        {direction}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ISO 20022 Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Manage international payment messages and account statements
        </p>
      </div>

      <Tabs defaultValue="messages" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="pain001">pain.001 Parser</TabsTrigger>
          <TabsTrigger value="pacs008">pacs.008 Generator</TabsTrigger>
          <TabsTrigger value="camt053">camt.053 Parser</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>ISO 20022 Messages</CardTitle>
              <CardDescription>
                View all processed ISO 20022 messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Creditor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No messages found
                      </TableCell>
                    </TableRow>
                  ) : (
                    messages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-mono text-sm">{msg.message_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{msg.message_type}</Badge>
                        </TableCell>
                        <TableCell>{getDirectionBadge(msg.direction)}</TableCell>
                        <TableCell>{getStatusBadge(msg.status)}</TableCell>
                        <TableCell>{msg.debtor_name || '-'}</TableCell>
                        <TableCell>{msg.creditor_name || '-'}</TableCell>
                        <TableCell>
                          {msg.amount && msg.currency ? (
                            <span>{msg.amount.toFixed(2)} {msg.currency}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {new Date(msg.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pain001">
          <Card>
            <CardHeader>
              <CardTitle>pain.001 Parser</CardTitle>
              <CardDescription>
                Parse Customer Credit Transfer Initiation (pain.001) messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>pain.001 XML Content</Label>
                <Textarea
                  placeholder="Paste pain.001 XML content here..."
                  value={pain001XML}
                  onChange={(e) => setPain001XML(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handlePain001Upload} disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Parsing..." : "Parse pain.001"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pacs008">
          <Card>
            <CardHeader>
              <CardTitle>pacs.008 Generator</CardTitle>
              <CardDescription>
                Generate Financial Institution Credit Transfer (pacs.008) messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Debtor Name *</Label>
                  <Input
                    value={pacs008Form.debtor_name}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, debtor_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Debtor IBAN *</Label>
                  <Input
                    value={pacs008Form.debtor_iban}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, debtor_iban: e.target.value })}
                    placeholder="GB33BUKB20201555555555"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Debtor BIC *</Label>
                  <Input
                    value={pacs008Form.debtor_bic}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, debtor_bic: e.target.value })}
                    placeholder="BUKBGB22XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Creditor Name *</Label>
                  <Input
                    value={pacs008Form.creditor_name}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, creditor_name: e.target.value })}
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Creditor IBAN *</Label>
                  <Input
                    value={pacs008Form.creditor_iban}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, creditor_iban: e.target.value })}
                    placeholder="DE89370400440532013000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Creditor BIC *</Label>
                  <Input
                    value={pacs008Form.creditor_bic}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, creditor_bic: e.target.value })}
                    placeholder="COBADEFFXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pacs008Form.amount}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, amount: e.target.value })}
                    placeholder="1000.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={pacs008Form.currency}
                    onChange={(e) => setPacs008Form({ ...pacs008Form, currency: e.target.value })}
                    placeholder="EUR"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remittance Information</Label>
                <Input
                  value={pacs008Form.remittance_information}
                  onChange={(e) => setPacs008Form({ ...pacs008Form, remittance_information: e.target.value })}
                  placeholder="Payment for invoice #12345"
                />
              </div>
              <Button onClick={handlePacs008Generate} disabled={loading}>
                <FileText className="h-4 w-4 mr-2" />
                {loading ? "Generating..." : "Generate & Download pacs.008"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camt053">
          <Card>
            <CardHeader>
              <CardTitle>camt.053 Parser</CardTitle>
              <CardDescription>
                Parse Bank-to-Customer Account Statement (camt.053) messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>camt.053 XML Content</Label>
                <Textarea
                  placeholder="Paste camt.053 XML content here..."
                  value={camt053XML}
                  onChange={(e) => setCamt053XML(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleCamt053Upload} disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                {loading ? "Parsing..." : "Parse camt.053"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
