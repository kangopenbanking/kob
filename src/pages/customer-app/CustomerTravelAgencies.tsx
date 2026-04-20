import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MapPin, Loader2, ArrowRight, Star, Route, Shield, Search, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { getTheme } from '@/lib/travel-theme';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

interface Agency {
  id: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  theme_color: string | null;
  route_count: number;
}

const CustomerTravelAgencies: React.FC = () => {
  const tr = useHarvestedT('customer');
  const { category } = useParams<{ category: string }>{tr('();
  const navigate = useNavigate();
  const [agencies, setAgencies] = useState')}<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const theme = getTheme(category);
  const CatIcon = theme.icon;

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

  const filtered = agencies.filter(a => {
  const tr = useHarvestedT('customer');tr('a.display_name.toLowerCase().includes(search.toLowerCase()));

  return (')}
    <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
      {/* ── Themed Header with Embedded Search ── */}
      <div className="relative overflow-hidden px-5 pb-8 pt-4" style={{ backgroundColor: theme.color }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-7">
            <button onClick={() => navigate('/app/travel')} className="flex h-10 w-10 items-center justify-center rounded-xl active:scale-95 transition-transform" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}>
              <ChevronLeft className="h-5 w-5" style={{ color: theme.fg }} />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}>
              <Shield className="h-3.5 w-3.5" style={{ color: theme.fg }} />
              <span className="text-[11px] font-semibold" style={{ color: theme.fg, opacity: 0.85 }}>{tr('Verified')}</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }}>
                <CatIcon className="h-6 w-6" style={{ color: theme.fg }} strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: theme.fg }}>{theme.label}</h1>
                <p className="text-[12px] font-medium" style={{ color: theme.fg, opacity: 0.6 }}>Choose an agency to browse trips</p>
              </div>
            </div>
          </motion.div>

          {/* ── Search Embedded in Banner ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-5 flex items-center gap-2.5 rounded-2xl px-4 py-3" style={{ backgroundColor: theme.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }}>
            <Search className="h-4.5 w-4.5 shrink-0" style={{ color: theme.fg }} />
            <input type="text" placeholder={`Search ${theme.label.toLowerCase()} agencies...`} value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-white/50" style={{ color: theme.fg }} />
          </motion.div>
        </div>
      </div>

      {/* ── Stats ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
        className="flex items-center gap-2 px-5 mt-5 mb-4">
        <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
          <Route className="h-3.5 w-3.5" style={{ color: theme.color }} />
          <span className="text-[11px] font-bold text-[#0f1729]">{agencies.length} Agencies</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-[11px] font-bold text-[#0f1729]">All Licensed</span>
        </div>
      </motion.div>

      <div className="px-5 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f1729]/30">Available agencies</p>
      </div>

      {/* ── Agency Cards ── */}
      <div className="space-y-3 px-5 pb-28">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[#0f1729]/20" /></div>
        {tr(') : filtered.length === 0 ? (')}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 rounded-3xl bg-white py-16 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.accentLight }}>
              <CatIcon className="h-8 w-8" style={{ color: theme.color }} strokeWidth={1.5} />
            </div>
            <p className="font-bold text-[#0f1729]">No agencies found</p>
            <p className="text-[13px] text-[#0f1729]/40 max-w-[240px]">
              {search ? 'Try a different search term.' : `Check back soon for registered ${theme.label.toLowerCase()} providers.`}
            </p>
          </motion.div>
        ) : (
          filtered.map((agency, i) => (
            <motion.button key={agency.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.06 }}
              onClick={() => navigate(`/app/travel/${category}/${agency.id}`)}
              className="group flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm transition-all active:scale-[0.98]">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md" style={{ backgroundColor: theme.color }}>
                {agency.logo_url ? (
                  <img src={agency.logo_url} alt={agency.display_name} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <CatIcon className="h-7 w-7" style={{ color: theme.fg }} strokeWidth={1.5} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#0f1729] truncate">{agency.display_name}</p>
                <p className="mt-0.5 text-[12px] text-[#0f1729]/45 truncate">{agency.description || 'Licensed travel operator'}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#0f1729]/40">
                    <MapPin className="h-3 w-3" /> {agency.route_count} route{agency.route_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: theme.color }}>
                    <Star className="h-3 w-3" /> {tr('Verified')}
                  </span>
                </div>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: theme.accentLight }}>
                <ArrowRight className="h-4 w-4" style={{ color: theme.color }} />
              </div>
            </motion.button>
          ))
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-5 flex items-center justify-center gap-3 text-[10px] font-medium text-[#0f1729]/25">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {tr('Licensed')}</span>
          <span className="text-[6px]">●</span>
          <span>{tr('E-Tickets')}</span>
          <span className="text-[6px]">●</span>
          <span>Secure Pay</span>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerTravelAgencies;
