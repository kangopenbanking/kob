import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { giveting } from '@/lib/giveting';
import { toast } from 'sonner';

export const GivetingUpdateNew: React.FC = () => {
  const { slug } = useParams();
  const nav = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res: any = await giveting('get', { slug });
      setCampaign(res.campaign);
    })().catch(() => {});
  }, [slug]);

  const submit = async () => {
    if (!campaign) return;
    setLoading(true);
    try {
      await giveting('post-update', { campaign_id: campaign.id, title, body });
      toast.success('Update posted');
      nav(`/app/giveting/c/${slug}/manage`);
    } catch (e: any) {
      toast.error(e.message ?? 'Could not post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-32">
      <header className="flex items-center gap-3 px-5 pt-6">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} className="h-9 w-9 rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Post an update</h1>
      </header>

      <div className="space-y-4 px-5 pt-6">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-12" maxLength={120} placeholder="e.g. First distributions begin" />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="mt-1 min-h-[240px]" placeholder="Tell your supporters what's happening…" />
          <p className="mt-1 text-xs text-muted-foreground">{body.length} / 4000</p>
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg border-t bg-background px-5 py-3">
        <Button
          onClick={submit}
          disabled={!title.trim() || !body.trim() || loading}
          className="h-14 w-full rounded-full text-base font-semibold"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Post update
        </Button>
      </footer>
    </div>
  );
};

export default GivetingUpdateNew;
