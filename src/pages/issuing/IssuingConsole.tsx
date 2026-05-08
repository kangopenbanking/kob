import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CreditCard, Plus, Snowflake, Power, Wallet, Activity, ShieldCheck } from "lucide-react";

type Role = "bank" | "developer" | "admin";

interface Props { role: Role; title?: string }

async function callFn(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const res = await supabase.functions.invoke("virtual-cards-v2", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action, ...body },
  });
  if (res.error) throw res.error;
  if ((res.data as any)?.status && (res.data as any)?.status >= 400) {
    throw new Error((res.data as any)?.detail || "Request failed");
  }
  return res.data;
}

export default function IssuingConsole({ role, title }: Props) {
  const queryClient = useQueryClient();
  const [showNewCardholder, setShowNewCardholder] = useState(false);
  const [showIssue, setShowIssue] = useState(false);

  const cardsQ = useQuery({
    queryKey: ["issuing-cards", role],
    queryFn: () => callFn("list-cards"),
  });

  const programsQ = useQuery({
    queryKey: ["issuing-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("virtual_card_programs")
        .select("*").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const cards: any[] = (cardsQ.data as any)?.cards ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["issuing-cards", role] });

  const lifecycle = async (card_id: string, action: "freeze" | "unfreeze" | "terminate") => {
    try {
      await callFn(action, { card_id });
      toast.success(`Card ${action}d`);
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title ?? "Card Issuing"}</h1>
          <p className="text-muted-foreground mt-1">
            Issue and manage USD virtual cards for your customers, powered by the Kora middleware.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNewCardholder(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Cardholder
          </Button>
          <Button onClick={() => setShowIssue(true)}>
            <CreditCard className="mr-2 h-4 w-4" /> Issue Card
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Total Cards" value={cards.length} />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label="Active" value={cards.filter(c => c.status === "active").length} />
        <StatCard icon={<Snowflake className="h-4 w-4" />} label="Frozen" value={cards.filter(c => c.status === "frozen").length} />
        <StatCard icon={<Power className="h-4 w-4" />} label="Terminated" value={cards.filter(c => c.status === "terminated").length} />
      </div>

      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          {role === "admin" && <TabsTrigger value="health">Provider Health</TabsTrigger>}
        </TabsList>

        <TabsContent value="cards" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Issued Cards</CardTitle>
              <CardDescription>All virtual cards under your tenant scope.</CardDescription>
            </CardHeader>
            <CardContent>
              {cardsQ.isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : cards.length === 0 ? (
                <p className="text-muted-foreground text-sm">No cards yet. Create a cardholder, then issue a card.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Card</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.card_name}</div>
                          <div className="text-xs text-muted-foreground">**** {c.last4}</div>
                        </TableCell>
                        <TableCell><Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                        <TableCell>${Number(c.balance_usd ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{String(c.exp_month).padStart(2, "0")}/{c.exp_year}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {c.status === "active" && (
                            <Button size="sm" variant="outline" onClick={() => lifecycle(c.id, "freeze")}>Freeze</Button>
                          )}
                          {c.status === "frozen" && (
                            <Button size="sm" variant="outline" onClick={() => lifecycle(c.id, "unfreeze")}>Unfreeze</Button>
                          )}
                          {c.status !== "terminated" && (
                            <Button size="sm" variant="outline" onClick={() => lifecycle(c.id, "terminate")}>Terminate</Button>
                          )}
                          <FundButton card={c} onDone={refresh} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Card Programs</CardTitle>
              <CardDescription>Active issuing programs available to your tenant.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Daily Limit</TableHead>
                    <TableHead>Monthly Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(programsQ.data ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.program_name}</TableCell>
                      <TableCell><Badge variant="outline">{p.issuer_provider}</Badge></TableCell>
                      <TableCell>{p.currency}</TableCell>
                      <TableCell>{p.default_daily_limit ?? "-"}</TableCell>
                      <TableCell>{p.default_monthly_limit ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {role === "admin" && (
          <TabsContent value="health" className="mt-6">
            <ProviderHealthCard />
          </TabsContent>
        )}
      </Tabs>

      <NewCardholderDialog open={showNewCardholder} onOpenChange={setShowNewCardholder} onCreated={() => queryClient.invalidateQueries()} />
      <IssueCardDialog open={showIssue} onOpenChange={setShowIssue} programs={programsQ.data ?? []} onIssued={refresh} />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}

function FundButton({ card, onDone }: { card: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const submit = async () => {
    try {
      await callFn("fund", { card_id: card.id, amount: Number(amount) });
      toast.success("Card funded");
      setOpen(false); setAmount(""); onDone();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={card.status !== "active"}>
        <Wallet className="h-3 w-3 mr-1" /> Fund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fund Card</DialogTitle><DialogDescription>Add USD to **** {card.last4}</DialogDescription></DialogHeader>
          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={submit}>Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewCardholderDialog({ open, onOpenChange, onCreated }: any) {
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "", customer_external_id: "" });
  const submit = async () => {
    try {
      await callFn("create-cardholder", f);
      toast.success("Cardholder created");
      onOpenChange(false);
      onCreated();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New Cardholder</DialogTitle><DialogDescription>Register a customer for card issuing (KYC tier 1).</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div><Label>External Customer ID</Label><Input value={f.customer_external_id} onChange={e => setF({ ...f, customer_external_id: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First Name</Label><Input value={f.first_name} onChange={e => setF({ ...f, first_name: e.target.value })} /></div>
            <div><Label>Last Name</Label><Input value={f.last_name} onChange={e => setF({ ...f, last_name: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueCardDialog({ open, onOpenChange, programs, onIssued }: any) {
  const [cardholderId, setCardholderId] = useState("");
  const [programId, setProgramId] = useState("");
  const [cardName, setCardName] = useState("");

  const chQ = useQuery({
    queryKey: ["issuing-cardholders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kora_cardholders").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data ?? [];
    },
    enabled: open,
  });

  const submit = async () => {
    try {
      await callFn("issue-card", { cardholder_id: cardholderId, program_id: programId, card_name: cardName });
      toast.success("Card issued");
      onOpenChange(false); onIssued();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue Card</DialogTitle><DialogDescription>Issue a new USD virtual card for a cardholder.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Cardholder</Label>
            <select className="w-full border rounded px-3 py-2 bg-background" value={cardholderId} onChange={e => setCardholderId(e.target.value)}>
              <option value="">Select…</option>
              {(chQ.data ?? []).map((c: any) => (<option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.email})</option>))}
            </select>
          </div>
          <div>
            <Label>Program</Label>
            <select className="w-full border rounded px-3 py-2 bg-background" value={programId} onChange={e => setProgramId(e.target.value)}>
              <option value="">Select…</option>
              {programs.map((p: any) => (<option key={p.id} value={p.id}>{p.program_name}</option>))}
            </select>
          </div>
          <div><Label>Card Label</Label><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="e.g. Online purchases" /></div>
        </div>
        <DialogFooter><Button onClick={submit}>Issue</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProviderHealthCard() {
  const q = useQuery({
    queryKey: ["kora-health"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("virtual-cards-health");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });
  const d: any = q.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Kora Provider Health</CardTitle>
        <CardDescription>Live preflight against the Kora issuing API.</CardDescription>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-sm text-muted-foreground">Checking…</p> : (
          <div className="space-y-2 text-sm">
            <Row label="Healthy" value={<Badge variant={d?.healthy ? "default" : "destructive"}>{String(d?.healthy)}</Badge>} />
            <Row label="Secret key" value={<Badge variant={d?.checks?.secret_key_present ? "default" : "destructive"}>{String(d?.checks?.secret_key_present)}</Badge>} />
            <Row label="Webhook secret" value={<Badge variant={d?.checks?.webhook_secret_present ? "default" : "destructive"}>{String(d?.checks?.webhook_secret_present)}</Badge>} />
            <Row label="Reachable" value={<Badge variant={d?.checks?.reachable ? "default" : "destructive"}>{String(d?.checks?.reachable)}</Badge>} />
            <Row label="Latency" value={<span>{d?.checks?.latency_ms ?? "—"} ms</span>} />
            <Row label="Base URL" value={<code className="text-xs">{d?.checks?.base_url}</code>} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between items-center py-1 border-b last:border-0"><span className="text-muted-foreground">{label}</span>{value}</div>;
}
