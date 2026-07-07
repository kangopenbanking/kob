import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, Megaphone, Upload, Link2,
  HeartPulse, LifeBuoy, Flower, GraduationCap, Users, PawPrint, Briefcase,
  Church, Home, Trophy, Plane, HandHeart, Sparkles, Medal, Palette, Calendar, Leaf,
} from 'lucide-react';
import { toast } from 'sonner';
import { giveting, GIVETING_CATEGORIES, GIVETING_CURRENCIES, toMinor, uploadGivetingCover } from '@/lib/giveting';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  medical: HeartPulse, emergencies: LifeBuoy, memorial: Flower, education: GraduationCap,
  community: Users, animals: PawPrint, business: Briefcase, faith: Church, family: Home,
  sports: Trophy, travel: Plane, volunteer: HandHeart, wishes: Sparkles, competitions: Medal,
  creative: Palette, events: Calendar, environment: Leaf,
};

type Step = 'category' | 'beneficiary' | 'goal' | 'story' | 'cover' | 'review' | 'ready';

export const GivetingCreate: React.FC = () => {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('category');
  const [loading, setLoading] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const [form, setForm] = useState({
    category_slug: '',
    beneficiary_type: 'self' as 'self' | 'other' | 'charity',
    beneficiary_name: '',
    beneficiary_relation: '',
    location_country: '',
    location_city: '',
    currency: 'XAF' as string,
    goal_amount: '',
    title: '',
    story: '',
    cover_media_url: '',
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const stepOrder: Step[] = ['category', 'beneficiary', 'goal', 'story', 'cover', 'review', 'ready'];
  const idx = stepOrder.indexOf(step);

  const goNext = () => setStep(stepOrder[Math.min(stepOrder.length - 1, idx + 1)]);
  const goBack = () => (idx === 0 ? nav('/app/giveting') : setStep(stepOrder[idx - 1]));

  const canProceed = () => {
    switch (step) {
      case 'category': return !!form.category_slug;
      case 'beneficiary': return form.beneficiary_type === 'self' || !!form.beneficiary_name;
      case 'goal': return !!form.goal_amount && Number(form.goal_amount) > 0 && !!form.currency;
      case 'story': return form.title.trim().length >= 3 && form.story.trim().length >= 20;
      case 'cover': return true;
      case 'review': return true;
      default: return false;
    }
  };

  const publish = async () => {
    setLoading(true);
    try {
      const res: any = await giveting('create', {
        title: form.title.trim(),
        story: form.story.trim(),
        category_slug: form.category_slug,
        currency: form.currency,
        goal_amount_minor: toMinor(form.goal_amount, form.currency),
        cover_media_url: form.cover_media_url || null,
        beneficiary_type: form.beneficiary_type,
        beneficiary_name: form.beneficiary_name || null,
        beneficiary_relation: form.beneficiary_relation || null,
        location_country: form.location_country || null,
        location_city: form.location_city || null,
      });
      await giveting('publish', { id: res.campaign.id });
      setCreatedSlug(res.campaign.slug);
      setStep('ready');
      toast.success('Your fundraiser is live!');
    } catch (e: any) {
      const m = e.message || '';
      if (m === 'kyc_required') {
        toast.error('Complete identity verification to launch a fundraiser.');
        nav('/app/kyc');
      } else {
        toast.error(m || 'Could not publish');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      'flex min-h-[calc(100vh-8rem)] flex-col',
      step === 'ready' ? 'bg-primary text-primary-foreground' : 'bg-background'
    )}>
      {step !== 'ready' && (
        <header className="flex items-center gap-3 px-5 pt-6">
          <Button variant="ghost" size="icon" onClick={goBack} className="h-9 w-9 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">Step {idx + 1} of 6</div>
        </header>
      )}

      <div className="flex-1 px-5 py-6">
        {step === 'category' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">What are you raising for?</h1>
            <p className="mb-6 text-sm text-muted-foreground">Pick a category. You can change it later.</p>
            <div className="grid grid-cols-2 gap-3">
              {GIVETING_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  onClick={() => set('category_slug', c.slug)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-all',
                    form.category_slug === c.slug
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/60 hover:border-primary/40'
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">{c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'beneficiary' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Who benefits?</h1>
            <p className="mb-6 text-sm text-muted-foreground">Let donors know where the money goes.</p>
            <div className="space-y-3">
              {[
                { v: 'self', title: 'Yourself', desc: 'Funds go to your Kang wallet.' },
                { v: 'other', title: 'Someone else', desc: 'A friend, family member, or neighbour.' },
                { v: 'charity', title: 'A charity or cause', desc: 'A registered organisation.' },
              ].map((o) => (
                <Card
                  key={o.v}
                  onClick={() => set('beneficiary_type', o.v as any)}
                  className={cn(
                    'cursor-pointer rounded-2xl border p-4 transition-all',
                    form.beneficiary_type === o.v ? 'border-primary bg-primary/5' : 'border-border/60'
                  )}
                >
                  <div className="font-semibold">{o.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{o.desc}</div>
                </Card>
              ))}
              {form.beneficiary_type !== 'self' && (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label>Beneficiary name</Label>
                    <Input value={form.beneficiary_name} onChange={(e) => set('beneficiary_name', e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Relationship (optional)</Label>
                    <Input value={form.beneficiary_relation} onChange={(e) => set('beneficiary_relation', e.target.value)} className="mt-1" placeholder="e.g. Brother, Local charity" />
                  </div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input value={form.location_city} onChange={(e) => set('location_city', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.location_country} onChange={(e) => set('location_country', e.target.value)} className="mt-1" />
                </div>
              </div>
            </div>
          </>
        )}

        {step === 'goal' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Set your goal</h1>
            <p className="mb-6 text-sm text-muted-foreground">Pick an amount you'd like to raise.</p>
            <div className="space-y-4">
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                  <SelectTrigger className="mt-1 h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GIVETING_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Goal amount</Label>
                <Input
                  type="number"
                  min="1"
                  inputMode="decimal"
                  value={form.goal_amount}
                  onChange={(e) => set('goal_amount', e.target.value)}
                  className="mt-1 h-12 text-xl font-semibold"
                  placeholder="0"
                />
              </div>
            </div>
          </>
        )}

        {step === 'story' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Tell your story</h1>
            <p className="mb-6 text-sm text-muted-foreground">A clear title and honest story raise more.</p>
            <div className="space-y-4">
              <div>
                <Label>Fundraiser title</Label>
                <Input value={form.title} onChange={(e) => set('title', e.target.value)} className="mt-1 h-12" maxLength={100} placeholder="e.g. Help Amina recover" />
              </div>
              <div>
                <Label>Story</Label>
                <Textarea value={form.story} onChange={(e) => set('story', e.target.value)} className="mt-1 min-h-[180px]" maxLength={4000} placeholder="Explain who this is for, what happened, and how funds will be used." />
                <p className="mt-1 text-xs text-muted-foreground">{form.story.length} / 4000</p>
              </div>
            </div>
          </>
        )}

        {step === 'cover' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Add a cover image</h1>
            <p className="mb-6 text-sm text-muted-foreground">A good photo helps donors connect. You can add one later too.</p>
            <div className="space-y-3">
              <Label>Image URL</Label>
              <Input
                value={form.cover_media_url}
                onChange={(e) => set('cover_media_url', e.target.value)}
                placeholder="https://…"
                className="h-12"
              />
              {form.cover_media_url && (
                <div className="overflow-hidden rounded-2xl border">
                  <img src={form.cover_media_url} alt="Cover preview" className="h-56 w-full object-cover" />
                </div>
              )}
              {!form.cover_media_url && (
                <Card className="flex h-56 items-center justify-center rounded-2xl border-dashed">
                  <div className="text-center text-muted-foreground">
                    <ImagePlus className="mx-auto mb-2 h-8 w-8" strokeWidth={1.5} />
                    <p className="text-xs">No image yet</p>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}

        {step === 'review' && (
          <>
            <h1 className="mb-1 text-2xl font-bold">Ready to launch?</h1>
            <p className="mb-6 text-sm text-muted-foreground">Review your fundraiser before publishing.</p>
            <Card className="overflow-hidden rounded-3xl">
              {form.cover_media_url ? (
                <img src={form.cover_media_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-primary/10 text-primary">
                  <Megaphone className="h-10 w-10" strokeWidth={1.4} />
                </div>
              )}
              <div className="space-y-2 p-4">
                <h3 className="text-lg font-semibold">{form.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{form.story}</p>
                <div className="flex flex-wrap gap-2 pt-2 text-xs">
                  <span className="rounded-full bg-muted px-3 py-1">{GIVETING_CATEGORIES.find(c => c.slug === form.category_slug)?.label}</span>
                  <span className="rounded-full bg-muted px-3 py-1">Goal: {form.currency} {Number(form.goal_amount).toLocaleString()}</span>
                  {form.location_city && <span className="rounded-full bg-muted px-3 py-1">{form.location_city}</span>}
                </div>
              </div>
            </Card>
          </>
        )}

        {step === 'ready' && (
          <div className="flex flex-1 flex-col items-center justify-center px-2 pt-24 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-foreground">
              <Megaphone className="h-7 w-7 text-primary" strokeWidth={1.8} />
            </div>
            <h1 className="text-3xl font-bold leading-tight">Your fundraiser is ready to share.</h1>
          </div>
        )}
      </div>

      {step !== 'ready' && (
        <footer className="sticky bottom-16 bg-background px-5 py-4">
          <Button onClick={step === 'review' ? publish : goNext} disabled={!canProceed() || loading} className="h-14 w-full rounded-full text-base font-semibold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {step === 'review' ? 'Publish fundraiser' : 'Continue'}
            {!loading && step !== 'review' && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </footer>
      )}

      {step === 'ready' && (
        <footer className="mt-auto flex gap-3 px-5 py-4">
          <Button variant="outline" onClick={() => nav('/app/giveting')} className="h-14 flex-1 rounded-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
            Skip
          </Button>
          <Button
            onClick={() => {
              const url = `${window.location.origin}/app/giveting/c/${createdSlug}`;
              if (navigator.share) navigator.share({ title: form.title, url }).catch(() => {});
              else {
                navigator.clipboard.writeText(url);
                toast.success('Link copied');
              }
              nav(`/app/giveting/c/${createdSlug}/manage`);
            }}
            className="h-14 flex-[2] rounded-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Check className="mr-2 h-4 w-4" /> Share fundraiser
          </Button>
        </footer>
      )}
    </div>
  );
};

export default GivetingCreate;
