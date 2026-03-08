import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { MobileAuthForm } from '@/components/pwa/MobileAuthForm';
import { useSingleSession } from '@/hooks/useSingleSession';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BusinessAuthInner: React.FC = () => {
  const { merchantId } = useParams();
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(false);

  // Detect forced sign-outs from another device
  useSingleSession();

  const handleAuthSuccess = async () => {
    setCheckingRole(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Verify business role (merchant owner or staff)
      const [{ data: isOwner }, { data: isStaff }] = await Promise.all([
        supabase.from('gateway_merchants').select('id').eq('user_id', user.id).limit(1),
        supabase.from('merchant_staff_roles').select('id').eq('user_id', user.id).eq('is_active', true).limit(1)
      ]);

      const hasAccess = (isOwner && isOwner.length > 0) || (isStaff && isStaff.length > 0);

      if (!hasAccess) {
        await supabase.auth.signOut();
        toast.error('You do not have access to the Business App');
        return;
      }

      const basePath = merchantId ? `/biz/${merchantId}` : '/biz';
      navigate(`${basePath}/home`, { replace: true });
    } catch (error) {
      toast.error('Authentication error');
      setCheckingRole(false);
    }
  };

  if (checkingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <MobileAuthForm
      onAuthSuccess={handleAuthSuccess}
      onApplyAccount={() => navigate('/merchant-register')}
    />
  );
};

const BusinessAuth: React.FC = () => {
  return (
    <TenantProvider>
      <BusinessAuthInner />
    </TenantProvider>
  );
};

export default BusinessAuth;
