import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Loader2 } from 'lucide-react';

interface SmartGetStartedButtonProps {
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const SmartGetStartedButton = ({ 
  variant = 'default', 
  size = 'lg',
  className = ''
}: SmartGetStartedButtonProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGetStarted = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Not logged in → go to auth
      if (!user) {
        navigate('/auth');
        return;
      }

      // Logged in, check institution status
      const { data: institution } = await supabase
        .from('institutions')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!institution) {
        // No institution → go to register
        navigate('/register');
      } else if (institution.status === 'pending' || institution.status === 'rejected') {
        // Pending or rejected → go to pending approval page
        navigate('/pending-approval');
      } else if (institution.status === 'approved') {
        // Approved → go to FI portal
        navigate('/fi-portal');
      } else {
        // Fallback to register
        navigate('/register');
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      size={size} 
      variant={variant}
      className={className}
      onClick={handleGetStarted}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading...
        </>
      ) : (
        <>
          Get Started <ArrowRight className="ml-2 h-5 w-5" />
        </>
      )}
    </Button>
  );
};