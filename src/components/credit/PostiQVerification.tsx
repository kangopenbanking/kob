import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Check, Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export function PostiQVerification() {
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Check existing verification
  const { data: verification, refetch } = useQuery({
    queryKey: ['postiq-verification'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data } = await supabase
        .from('postiq_address_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('verified_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    }
  });

  // Create verification mutation
  const createVerification = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postiq-create-code`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(coords)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to verify address');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Address Verified!', {
        description: `PostiQ Code: ${data.data.postiq_code}. +50 credit score boost applied!`
      });
      refetch();
    },
    onError: (error: Error) => {
      toast.error('Verification Failed', {
        description: error.message || 'Could not verify your address'
      });
    }
  });

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported', {
        description: 'Your browser does not support location services'
      });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setIsGettingLocation(false);
        
        // Auto-verify with GPS coordinates
        createVerification.mutate(coords);
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Location Access Denied', {
          description: 'Please enable location permissions to verify your address'
        });
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  if (verification) {
    return (
      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500 rounded-lg">
            <Check className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Address Verified ✓</h3>
            <p className="text-sm text-muted-foreground mb-2">
              PostiQ Code: <span className="font-mono font-medium text-foreground">{verification.postiq_code}</span>
            </p>
            {verification.full_address && (
              <p className="text-sm text-muted-foreground mb-3">{verification.full_address}</p>
            )}
            <div className="mt-3 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-md inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-700 dark:text-green-400" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">+50 Credit Score Boost Applied</p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Verified on {new Date(verification.verified_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary rounded-lg">
          <MapPin className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Verify Your Address</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Get an instant <strong className="text-foreground">+50 point</strong> credit score boost by verifying your address with PostiQ Mail.
          </p>
          <Button 
            onClick={handleGetLocation}
            disabled={isGettingLocation || createVerification.isPending}
            className="w-full sm:w-auto"
          >
            {(isGettingLocation || createVerification.isPending) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Verify Address with GPS
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Limited to 5 verifications per day • Uses your device's GPS location
          </p>
        </div>
      </div>
    </Card>
  );
}
