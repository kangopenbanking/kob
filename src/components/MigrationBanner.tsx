import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Phone } from 'lucide-react';

export function MigrationBanner() {
  const [show, setShow] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('migration_required, migration_grace_period_ends')
        .eq('id', user.id)
        .single();

      if (profile?.migration_required && profile.migration_grace_period_ends) {
        const endDate = new Date(profile.migration_grace_period_ends);
        const now = new Date();
        const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft > 0) {
          setDaysRemaining(daysLeft);
          setShow(true);
        }
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    }
  };

  const handleAddPhone = () => {
    navigate('/profile-settings');
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('migration-banner-dismissed', Date.now().toString());
  };

  if (!show) return null;

  return (
    <Alert className="mb-4 border-l-4 border-l-warning">
      <Phone className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Phone Number Required</span>
        <Button variant="ghost" size="icon" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          For enhanced security, we now require all accounts to have a phone number.
          You have <strong>{daysRemaining} days</strong> remaining to add your phone number.
        </p>
        <Button onClick={handleAddPhone} size="sm">
          Add Phone Number Now
        </Button>
      </AlertDescription>
    </Alert>
  );
}
