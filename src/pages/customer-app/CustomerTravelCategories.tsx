import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, ArrowRight, MapPin, Star, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const categories = [
  {
    key: 'bus', label: 'Bus Travel', desc: 'Intercity & local bus tickets across Cameroon',
    icon: Bus, active: true,
    gradient: 'from-[hsl(48,90%,52%)] to-[hsl(38,95%,45%)]',
    iconBg: 'bg-[hsl(0,0%,10%)]', iconColor: 'text-[hsl(48,90%,52%)]',
    stat: '50+ Routes', statIcon: MapPin,
  },
  {
    key: 'tours', label: 'Tours & Excursions', desc: 'Sightseeing, adventure & guided tour packages',
    icon: Compass, active: true,
    gradient: 'from-[hsl(187,85%,45%)] to-[hsl(195,80%,38%)]',
    iconBg: 'bg-white/20', iconColor: 'text-white',
    stat: 'Top Rated', statIcon: Star,
  },
  {
    key: 'airlines', label: 'Airlines', desc: 'Domestic & regional flight booking',
    icon: Plane, active: false,
    gradient: 'from-[hsl(0,60%,48%)] to-[hsl(350,65%,40%)]',
    iconBg: 'bg-white/15', iconColor: 'text-white',
    stat: 'Coming Soon', statIcon: Shield,
  },
  {
    key: 'trains', label: 'Trains', desc: 'Rail travel across the network',
    icon: Train, active: false,
    gradient: 'from-[hsl(220,15%,22%)] to-[hsl(220,20%,14%)]',
    iconBg: 'bg-white/10', iconColor: 'text-white',
    stat: 'Coming Soon', statIcon: Shield,
  },
];

const CustomerTravelCategories: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[hsl(220,25%,12%)] to-[hsl(220,30%,20%)] px-4 pb-8 pt-3">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(217,91%,35%/0.15),transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1" />
            <Badge className="border-0 bg-white/10 text-white/80 text-[10px] font-medium backdrop-blur-sm">
              <Shield className="mr-1 h-3 w-3" /> Verified Agencies
            </Badge>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Transport & Tourism</h1>
          <p className="mt-1 text-sm text-white/60">Book trusted travel across Cameroon</p>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3 px-4 -mt-4 pb-24">
        {categories.map((cat, i) => {
          const CatIcon = cat.icon;
          const StatIcon = cat.statIcon;
          return (
            <motion.button
              key={cat.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              onClick={() => cat.active && navigate(`/app/travel/${cat.key}`)}
              disabled={!cat.active}
              className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r ${cat.gradient} p-5 text-left shadow-lg transition-all active:scale-[0.97] ${!cat.active ? 'opacity-60 saturate-50' : ''}`}
            >
              {/* Decorative circle */}
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />
              <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-black/5" />

              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cat.iconBg} shadow-inner`}>
                <CatIcon className={`h-7 w-7 ${cat.iconColor}`} strokeWidth={1.8} />
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-[17px] font-bold text-white">{cat.label}</p>
                <p className="text-[13px] text-white/70 truncate">{cat.desc}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <StatIcon className="h-3 w-3 text-white/50" />
                  <span className="text-[11px] font-medium text-white/50">{cat.stat}</span>
                </div>
              </div>
              {cat.active ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 group-hover:bg-white/25 transition-colors">
                  <ArrowRight className="h-4 w-4 text-white" />
                </div>
              ) : (
                <Badge className="border-0 bg-black/20 text-white/80 text-[10px]">Soon</Badge>
              )}
            </motion.button>
          );
        })}

        {/* Trust bar */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Licensed Operators</span>
          <span>•</span>
          <span>Instant E-Tickets</span>
          <span>•</span>
          <span>Secure Payments</span>
        </div>
      </div>
    </div>
  );
};

export default CustomerTravelCategories;
