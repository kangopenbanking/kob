import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const categoryMeta: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  bus: { label: 'Bus Travel', icon: Bus, bg: 'bg-[hsl(48,90%,52%)]', text: 'text-[hsl(0,0%,10%)]' },
  tours: { label: 'Tours', icon: Compass, bg: 'bg-[hsl(187,100%,42%)]', text: 'text-white' },
  airlines: { label: 'Airlines', icon: Plane, bg: 'bg-[hsl(0,65%,51%)]', text: 'text-white' },
  trains: { label: 'Trains', icon: Train, bg: 'bg-[hsl(0,0%,13%)]', text: 'text-white' },
};

interface Agency {
  id: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  theme_color: string | null;
  route_count: number;
}

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerTravelAgencies: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = categoryMeta[category || ''] || categoryMeta.bus;
  const CatIcon = meta.icon;

  useEffect(() => {
    const fetch = async () => {
      const { data: services } = await supabase
        .from('travel_services')
        .select('id, display_name, description, logo_url, theme_color')
        .eq('service_type', category || '')
        .eq('is_active', true);

      if (!services || services.length === 0) {
        setAgencies([]);
        setLoading(false);
        return;
      }

      // Get route counts
      const serviceIds = services.map((s: any) => s.id);
      const { data: routes } = await supabase
        .from('travel_routes')
        .select('id, service_id')
        .in('service_id', serviceIds)
        .eq('is_active', true);

      const routeCounts: Record<string, number> = {};
      (routes || []).forEach((r: any) => {
        routeCounts[r.service_id] = (routeCounts[r.service_id] || 0) + 1;
      });

      setAgencies(services.map((s: any) => ({
        ...s,
        route_count: routeCounts[s.id] || 0,
      })));
      setLoading(false);
    };
    fetch();
  }, [category]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={`${meta.bg} px-4 pb-6 pt-3`}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/app/travel')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <ChevronLeft className={`h-5 w-5 ${meta.text}`} />
          </button>
          <h1 className={`text-lg font-bold ${meta.text}`}>{meta.label}</h1>
        </div>
        <p className={`text-sm ${meta.text} opacity-80`}>Browse registered agencies and book your journey</p>
      </div>

      <div className="space-y-3 px-4 py-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : agencies.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 py-12 text-center">
            <CatIcon className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-semibold text-muted-foreground">No agencies available yet</p>
            <p className="text-sm text-muted-foreground">Check back soon for registered {meta.label.toLowerCase()} services.</p>
          </div>
        ) : (
          agencies.map((agency, i) => (
            <motion.button
              key={agency.id}
              {...fadeUp}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => navigate(`/app/travel/${category}/${agency.id}`)}
              className="flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-transform active:scale-[0.98]"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${meta.bg}`}>
                {agency.logo_url ? (
                  <img src={agency.logo_url} alt={agency.display_name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <CatIcon className={`h-7 w-7 ${meta.text}`} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{agency.display_name}</p>
                <p className="text-sm text-muted-foreground truncate">{agency.description || 'Travel service provider'}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{agency.route_count} active route{agency.route_count !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <Badge variant="outline">View</Badge>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomerTravelAgencies;
