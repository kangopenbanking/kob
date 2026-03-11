import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const BusinessSplash: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setTimeout(() => {
        if (session) {
          navigate('/biz/home', { replace: true });
        } else {
          navigate('/biz/auth', { replace: true });
        }
      }, 1500);
    };
    checkAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-primary shadow-xl">
          <Store className="h-12 w-12" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Business</h1>
      </div>
    </div>
  );
};

export default BusinessSplash;
