import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Share2 } from 'lucide-react';
import givetingCover from '@/assets/kang-giveting.png.asset.json';
import { supabase } from '@/integrations/supabase/client';
import { giveting } from '@/lib/giveting';
import { CampaignCard } from '@/components/customer-app/giveting/CampaignCard';
import { toast } from 'sonner';

export const GivetingProfile: React.FC = () => {
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: p } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle();
        setProfile(p);
        const res: any = await giveting('list-mine');
        setMine((res.campaigns ?? []).filter((c: any) => c.status === 'active'));
      } catch (e: any) {
        toast.error(e.message ?? 'Failed to load profile');
      }
    })();
  }, []);

  return (
    <div className="pb-24">
      <div className="relative">
        <div className="h-40 bg-accent/40" />
        <button onClick={() => nav('/app/settings')} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow">
          <Settings className="h-4 w-4" strokeWidth={1.7} />
        </button>
        <div className="absolute left-1/2 top-24 flex h-24 w-24 -translate-x-1/2 items-center justify-center rounded-full border-4 border-background bg-muted text-2xl font-semibold text-muted-foreground">
          {(profile?.full_name ?? 'K').charAt(0)}
        </div>
      </div>

      <div className="mt-16 px-5 text-center">
        <h1 className="text-2xl font-bold">{profile?.full_name ?? 'You'}</h1>
      </div>

      <div className="mt-6 px-5">
        <Button variant="outline" className="h-12 w-full rounded-full">
          <Share2 className="mr-2 h-4 w-4" /> Share profile
        </Button>
      </div>

      <div className="mt-8 px-5">
        <h2 className="mb-3 text-lg font-bold">Your live fundraisers</h2>
        {mine.length === 0 ? (
          <Card className="rounded-2xl p-6 text-center text-sm text-muted-foreground">You haven't published any fundraisers yet.</Card>
        ) : (
          <div className="space-y-4">
            {mine.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default GivetingProfile;
