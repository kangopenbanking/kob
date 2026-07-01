import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const CustomerCardOrderPhysical: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    recipient_name: '', line1: '', line2: '', city: '', region: '', postal_code: '', country: 'Cameroon',
  });

  const canSubmit = form.recipient_name && form.line1 && form.city && form.country;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('cards-v3', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          action: 'issue',
          form_factor: 'physical',
          currency: 'XAF',
          card_name: form.recipient_name,
          address: {
            line1: form.line1, line2: form.line2 || undefined,
            city: form.city, region: form.region || undefined,
            postal_code: form.postal_code || undefined, country: form.country,
          },
          idempotency_key: crypto.randomUUID(),
        },
      });
      if (res.error) throw res.error;
      toast.success('Physical card ordered. Track delivery from Cards.');
      await qc.refetchQueries({ queryKey: ['customer-cards-v3'] });
      navigate('/app/cards');
    } catch (e: any) {
      toast.error(extractEdgeFunctionError(e, 'Could not order card'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <button onClick={() => navigate('/app/cards')} className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
      </button>

      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(25,60%,90%)]">
          <Truck className="h-5 w-5 text-[hsl(25,60%,35%)]" strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Order a physical card</h1>
          <p className="text-xs text-muted-foreground">Nium manufactures and ships worldwide.</p>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <Field label="Full name on card" value={form.recipient_name}
          onChange={(v) => setForm({ ...form, recipient_name: v })} />
        <Field label="Address line 1" value={form.line1}
          onChange={(v) => setForm({ ...form, line1: v })} />
        <Field label="Address line 2 (optional)" value={form.line2}
          onChange={(v) => setForm({ ...form, line2: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
          <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
        </div>
      </section>

      <Button className="rounded-2xl" disabled={!canSubmit || submitting} onClick={submit}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} /> : null}
        Order physical card
      </Button>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Kang Open Banking issues cards through Nium (default) with Kora as automatic fallback for resilience. Card details are never stored on our servers.
      </p>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1">
    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl" />
  </div>
);

export default CustomerCardOrderPhysical;
