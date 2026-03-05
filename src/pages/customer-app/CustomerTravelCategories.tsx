import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, ArrowRight, MapPin, Star, Shield, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const categories = [
  {
    key: 'bus',
    label: 'Bus Travel',
    desc: 'Intercity & local bus tickets across Cameroon',
    icon: Bus,
    active: true,
    bg: '#ffbe0b',
    textColor: 'text-[#1a1a1a]',
    iconBg: 'bg-[#1a1a1a]',
    iconColor: 'text-[#ffbe0b]',
    stat: '50+ Routes',
    statIcon: MapPin,
  },
  {
    key: 'tours',
    label: 'Tours & Excursions',
    desc: 'Sightseeing, adventure & guided tour packages',
    icon: Compass,
    active: true,
    bg: '#3a86ff',
    textColor: 'text-white',
    iconBg: 'bg-white/20',
    iconColor: 'text-white',
    stat: 'Top Rated',
    statIcon: Star,
  },
  {
    key: 'airlines',
    label: 'Airlines',
    desc: 'Domestic & regional flight booking',
    icon: Plane,
    active: false,
    bg: '#d00000',
    textColor: 'text-white',
    iconBg: 'bg-white/15',
    iconColor: 'text-white',
    stat: 'Coming Soon',
    statIcon: Lock,
  },
  {
    key: 'trains',
    label: 'Trains',
    desc: 'Rail travel across the network',
    icon: Train,
    active: false,
    bg: '#000000',
    textColor: 'text-white',
    iconBg: 'bg-white/15',
    iconColor: 'text-white',
    stat: 'Coming Soon',
    statIcon: Lock,
  },
];

const CustomerTravelCategories: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden px-4 pb-8 pt-3" style={{ backgroundColor: '#111827' }}>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
              <Shield className="h-3 w-3 text-white/70" />
              <span className="text-[10px] font-medium text-white/70">Verified Agencies</span>
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Transport & Tourism</h1>
          <p className="mt-1 text-sm text-white/50">Book trusted travel across Cameroon</p>
        </div>
      </div>

      {/* Cards */}
      <div className="relative z-10 space-y-3 px-4 -mt-4 pb-24">
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
              style={{ backgroundColor: cat.bg }}
              className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl p-5 text-left shadow-lg transition-all active:scale-[0.97] ${!cat.active ? 'opacity-55' : ''}`}
            >
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${cat.iconBg}`}>
                <CatIcon className={`h-7 w-7 ${cat.iconColor}`} strokeWidth={1.8} />
              </div>

              <div className="relative z-10 flex-1 min-w-0">
                <p className={`text-[17px] font-bold ${cat.textColor}`}>{cat.label}</p>
                <p className={`text-[13px] ${cat.textColor} opacity-70 truncate`}>{cat.desc}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <StatIcon className={`h-3 w-3 ${cat.textColor} opacity-50`} />
                  <span className={`text-[11px] font-medium ${cat.textColor} opacity-50`}>{cat.stat}</span>
                </div>
              </div>

              {cat.active ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <ArrowRight className={`h-4 w-4 ${cat.textColor}`} />
                </div>
              ) : (
                <div className="shrink-0 rounded-full bg-black/20 px-2.5 py-1">
                  <span className="text-[10px] font-semibold text-white/80">Soon</span>
                </div>
              )}
            </motion.button>
          );
        })}

        {/* Trust bar */}
        <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Licensed Operators</span>
          <span>·</span>
          <span>Instant E-Tickets</span>
          <span>·</span>
          <span>Secure Payments</span>
        </div>
      </div>
    </div>
  );
};

export default CustomerTravelCategories;
