import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Compass, Plane, Train, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const categories = [
  { key: 'bus', label: 'Bus Travel', desc: 'Book intercity & local bus tickets', icon: Bus, bg: 'bg-[hsl(48,90%,52%)]', text: 'text-[hsl(0,0%,10%)]', accent: 'hsl(48,90%,52%)', active: true },
  { key: 'tours', label: 'Tours', desc: 'Explore sightseeing & tour packages', icon: Compass, bg: 'bg-[hsl(187,100%,42%)]', text: 'text-white', accent: 'hsl(187,100%,42%)', active: true },
  { key: 'airlines', label: 'Airlines', desc: 'Flight booking & seat selection', icon: Plane, bg: 'bg-[hsl(0,65%,51%)]', text: 'text-white', accent: 'hsl(0,65%,51%)', active: false },
  { key: 'trains', label: 'Trains', desc: 'Rail travel across the network', icon: Train, bg: 'bg-[hsl(0,0%,13%)]', text: 'text-white', accent: 'hsl(0,0%,13%)', active: false },
];

const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } };

const CustomerTravelCategories: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <button onClick={() => navigate('/app/home')} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Transport & Tourism</h1>
      </div>

      <div className="space-y-4 px-4 pb-24">
        <p className="text-sm text-muted-foreground">Choose a travel category to browse available agencies and book your journey.</p>

        {categories.map((cat, i) => {
          const CatIcon = cat.icon;
          return (
            <motion.button
              key={cat.key}
              {...fadeUp}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              onClick={() => cat.active && navigate(`/app/travel/${cat.key}`)}
              disabled={!cat.active}
              className={`relative flex w-full items-center gap-4 rounded-2xl ${cat.bg} p-5 text-left transition-transform active:scale-[0.98] ${!cat.active ? 'opacity-50' : ''}`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                <CatIcon className={`h-7 w-7 ${cat.text}`} strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${cat.text}`}>{cat.label}</p>
                <p className={`text-sm ${cat.text} opacity-80`}>{cat.desc}</p>
              </div>
              {cat.active ? (
                <ChevronRight className={`h-5 w-5 ${cat.text} opacity-60`} />
              ) : (
                <Badge className="bg-white/20 text-white border-0">Coming Soon</Badge>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerTravelCategories;
