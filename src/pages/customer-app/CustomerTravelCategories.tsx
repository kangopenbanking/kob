import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, ArrowRight, MapPin, Star, Shield, Lock, Ticket, Clock, CheckCircle2, History } from 'lucide-react';
import { motion } from 'framer-motion';

const categories = [
  {
    key: 'bus',
    label: 'Bus Travel',
    desc: 'Intercity & local bus tickets across Cameroon',
    icon: Bus,
    active: true,
    bg: '#003087',
    fg: '#ffffff',
    iconBg: 'rgba(255,255,255,0.15)',
    iconFg: '#ffffff',
    stat: '50+ Routes',
    statIcon: MapPin,
    features: ['Track Bus', 'Pick Seats'],
  },
  {
    key: 'tours',
    label: 'Tours & Excursions',
    desc: 'Sightseeing, adventure & guided tour packages',
    icon: Compass,
    active: true,
    bg: '#4a1a7a',
    fg: '#ffffff',
    iconBg: 'rgba(255,255,255,0.15)',
    iconFg: '#ffffff',
    stat: 'Top Rated',
    statIcon: Star,
    features: ['Guides', 'Groups'],
  },
  {
    key: 'airlines',
    label: 'Airlines',
    desc: 'Domestic & regional flight booking',
    icon: Plane,
    active: false,
    bg: '#0770E3',
    fg: '#ffffff',
    iconBg: 'rgba(255,255,255,0.15)',
    iconFg: '#ffffff',
    stat: 'Coming Soon',
    statIcon: Star,
    features: ['Flight search', 'E-boarding'],
  },
  {
    key: 'trains',
    label: 'Trains',
    desc: 'Rail travel across the network',
    icon: Train,
    active: false,
    bg: '#00857C',
    fg: '#ffffff',
    iconBg: 'rgba(255,255,255,0.15)',
    iconFg: '#ffffff',
    stat: 'Coming Soon',
    statIcon: Star,
    features: ['Route planner', 'Season passes'],
  },
];

const quickStats = [
  { icon: Ticket, label: 'E-Tickets', value: 'Instant' },
  { icon: Shield, label: 'Licensed', value: '100%' },
  { icon: Clock, label: 'Support', value: '24/7' },
  { icon: CheckCircle2, label: 'Secure Pay', value: 'Always' },
];

const CustomerTravelCategories: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* ── Header ── */}
      <div className="relative overflow-hidden px-5 pb-14 pt-4" style={{ backgroundColor: '#0f1729' }}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/app/home')} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 active:bg-white/20 transition-colors">
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="flex-1" />
            <button onClick={() => navigate('/app/travel/history')} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 active:bg-white/20 transition-colors">
              <History className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[11px] font-semibold text-white/80">My Bookings</span>
            </button>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#ffbe0b] mb-1.5">Explore</p>
            <h1 className="text-[26px] font-extrabold text-white tracking-tight leading-tight">Transport &<br />Tourism</h1>
            <p className="mt-2 text-[13px] text-white/45 leading-relaxed">Book trusted travel services across Cameroon</p>
          </motion.div>
        </div>
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="relative z-10 -mt-7 px-5 mb-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
        >
          {quickStats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f1729]/5">
                  <Icon className="h-4 w-4 text-[#0f1729]" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-bold text-[#0f1729]">{s.value}</span>
                <span className="text-[9px] text-[#0f1729]/40 font-medium">{s.label}</span>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Section Label ── */}
      <div className="px-5 mb-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0f1729]/35">Choose category</p>
      </div>

      {/* ── Category Cards ── */}
      <div className="space-y-3.5 px-5 pb-28">
        {categories.map((cat, i) => {
          const CatIcon = cat.icon;
          const StatIcon = cat.statIcon;
          const fgOpacity70 = cat.fg === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(26,26,26,0.65)';
          const fgOpacity40 = cat.fg === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(26,26,26,0.4)';

          return (
            <motion.button
              key={cat.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              onClick={() => cat.active && navigate(`/app/travel/${cat.key}`)}
              disabled={!cat.active}
              style={{ backgroundColor: cat.bg }}
              className={`group relative flex w-full flex-col overflow-hidden rounded-3xl p-5 text-left shadow-md transition-all active:scale-[0.97] ${!cat.active ? 'opacity-50' : ''}`}
            >
              {/* Top row: icon + arrow */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: cat.iconBg }}>
                  <CatIcon className="h-7 w-7" style={{ color: cat.iconFg }} strokeWidth={1.8} />
                </div>
                {cat.active ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: cat.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }}>
                    <ArrowRight className="h-4.5 w-4.5" style={{ color: cat.fg }} />
                  </div>
                ) : (
                  <div className="rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
                    <span className="text-[10px] font-bold text-white/90 uppercase tracking-wide">Soon</span>
                  </div>
                )}
              </div>

              {/* Title + Description */}
              <p className="text-[19px] font-extrabold leading-tight" style={{ color: cat.fg }}>{cat.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: fgOpacity70 }}>{cat.desc}</p>

              {/* Bottom row: stat + features */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <StatIcon className="h-3.5 w-3.5" style={{ color: fgOpacity40 }} />
                  <span className="text-[11px] font-semibold" style={{ color: fgOpacity40 }}>{cat.stat}</span>
                </div>
                <div className="flex items-center gap-2">
                  {cat.features.map((f, fi) => (
                    <span key={fi} className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: cat.fg === '#ffffff' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', color: fgOpacity70 }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </motion.button>
          );
        })}

        {/* ── Trust Footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="mt-5 flex items-center justify-center gap-3 text-[10px] font-medium text-[#0f1729]/30"
        >
          <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Licensed</span>
          <span className="text-[6px]">●</span>
          <span>E-Tickets</span>
          <span className="text-[6px]">●</span>
          <span>Secure Pay</span>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerTravelCategories;
