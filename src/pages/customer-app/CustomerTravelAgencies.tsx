import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, MapPin, Loader2, ArrowRight, Star, Route } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const categoryMeta: Record<string, { label: string; icon: React.ElementType; gradient: string; accentBg: string }> = {
  bus: { label: 'Bus Travel', icon: Bus, gradient: 'from-[hsl(48,90%,52%)] to-[hsl(38,95%,45%)]', accentBg: 'bg-[hsl(48,90%,52%)]' },
  tours: { label: 'Tours & Excursions', icon: Compass, gradient: 'from-[hsl(187,85%,45%)] to-[hsl(195,80%,38%)]', accentBg: 'bg-[hsl(187,85%,45%)]' },
  airlines: { label: 'Airlines', icon: Plane, gradient: 'from-[hsl(0,60%,48%)] to-[hsl(350,65%,40%)]', accentBg: 'bg-[hsl(0,60%,48%)]' },
  trains: { label: 'Trains', icon: Train, gradient: 'from-[hsl(220,15%,22%)] to-[hsl(220,20%,14%)]', accentBg: 'bg-[hsl(220,15%,22%)]' },
};

interface Agency {
  id: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  theme_color: string | null;
  route_count: number;
}

const CustomerTravelAgencies: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = categoryMeta[category || ''] || categoryMeta.bus;
  const CatIcon = meta.icon;

  useEffect(() => {
    const fetchAgencies = async () => {
      const { data: services } = await supabase
        .from('travel_services')
        .select('id, display_name, description, logo_url, theme_color')
        .eq('service_type', category || '')
        .eq('is_active', true);

      if (!services || services.length === 0) { setAgencies([]); setLoading(false); return; }

      const serviceIds = services.map((s: any) => s.id);
      const { data: routes } = await supabase.from('travel_routes').select('id, service_id').in('service_id', serviceIds).eq('is_active', true);
      const routeCounts: Record<string, number> = {};
      (routes || []).forEach((r: any) => { routeCounts[r.service_id] = (routeCounts[r.service_id] || 0) + 1; });

      setAgencies(services.map((s: any) => ({ ...s, route_count: routeCounts[s.id] || 0 })));
      setLoading(false);
    };
    fetchAgencies();
  }, [category]);

  return (
    <div className="min-h-screen bg-background">
      {/* Themed header */}
      <div className={`relative overflow-hidden bg-gradient-to-r ${meta.gradient} px-4 pb-8 pt-3`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => navigate('/app/travel')} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/15 backdrop-blur-sm">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <h1 className="text-lg font-bold text-white">{meta.label}</h1>
          </div>
          <p className="text-sm text-white/70">Browse verified agencies & book your journey</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge className="border-0 bg-black/15 text-white text-[10px]"><Route className="mr-1 h-3 w-3" /> {agencies.length} Agencies</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 -mt-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
        ) : agencies.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 rounded-2xl bg-card border py-14 text-center shadow-sm">
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${meta.accentBg}/10`}>
              <CatIcon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="font-semibold">No agencies available yet</p>
            <p className="text-sm text-muted-foreground max-w-[260px]">Check back soon for registered {meta.label.toLowerCase()} providers.</p>
          </motion.div>
        ) : (
          agencies.map((agency, i) => (
            <motion.button
              key={agency.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => navigate(`/app/travel/${category}/${agency.id}`)}
              className="group flex w-full items-center gap-4 rounded-2xl bg-card border p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${meta.accentBg} shadow-lg`}>
                {agency.logo_url ? (
                  <img src={agency.logo_url} alt={agency.display_name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <CatIcon className="h-7 w-7 text-white" strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{agency.display_name}</p>
                <p className="text-[13px] text-muted-foreground truncate">{agency.description || 'Licensed travel operator'}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {agency.route_count} route{agency.route_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Star className="h-3 w-3" /> Verified
                  </span>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <ArrowRight className="h-4 w-4" />
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
};

export default CustomerTravelAgencies;
