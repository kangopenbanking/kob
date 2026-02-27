import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CustomerSplash: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();
  const [branding, setBranding] = useState<{
    name: string;
    logoUrl: string | null;
    tagline: string;
    primaryColor: string;
  }>({ name: '', logoUrl: null, tagline: '', primaryColor: '' });

  useEffect(() => {
    if (!institutionId) return;
    const load = async () => {
      const { data } = await supabase
        .from('institutions')
        .select('institution_name, logo_url, tagline, primary_color')
        .eq('id', institutionId)
        .maybeSingle();
      if (data) {
        setBranding({
          name: (data as any).institution_name || 'Customer App',
          logoUrl: (data as any).logo_url || null,
          tagline: (data as any).tagline || 'Your money, your way',
          primaryColor: (data as any).primary_color || '',
        });
      }
    };
    load();
  }, [institutionId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      // Check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if onboarding is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('linked_account_type')
          .eq('id', session.user.id)
          .maybeSingle();
        if (profile && (profile as any).linked_account_type) {
          navigate(`/app/${institutionId}/home`, { replace: true });
        } else {
          navigate(`/app/${institutionId}/onboarding`, { replace: true });
        }
      } else {
        navigate(`/app/${institutionId}/auth`, { replace: true });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [institutionId, navigate]);

  const bgStyle: React.CSSProperties = {};
  if (branding.primaryColor) {
    bgStyle.backgroundColor = `hsl(${branding.primaryColor})`;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
        style={bgStyle}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          className="flex flex-col items-center gap-6"
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-20 w-20 rounded-2xl object-contain bg-primary-foreground p-2"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-foreground/20">
              <Building2 className="h-10 w-10 text-primary-foreground" strokeWidth={1.5} />
            </div>
          )}

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-semibold tracking-tight text-primary-foreground"
          >
            {branding.name}
          </motion.h1>

          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-primary-foreground/70"
          >
            {branding.tagline}
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="absolute bottom-12"
        >
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="h-2 w-2 rounded-full bg-primary-foreground/50"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CustomerSplash;
