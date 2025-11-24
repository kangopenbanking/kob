import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MapPin, Award } from 'lucide-react';
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
      <Card className="p-6 bg-gradient-to-br from-postiq-blue-light to-background border-postiq-blue/30">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-postiq-blue">Address Verified ✓</h3>
            <p className="text-sm text-muted-foreground">
              Your PostiQ code has been verified and added to your credit profile
            </p>
          </div>
          <div className="w-12 h-12 bg-postiq-blue/10 rounded-full flex items-center justify-center">
            <MapPin className="w-6 h-6 text-postiq-blue" />
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="bg-postiq-blue-light/50 p-4 rounded-lg border border-postiq-blue/20">
            <div className="text-sm text-muted-foreground mb-1">Your PostiQ Code</div>
            <div className="text-2xl font-bold font-mono text-postiq-blue">{verification.postiq_code}</div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-crediq-green/10 rounded-lg border border-crediq-green/20">
            <Award className="w-5 h-5 text-crediq-green" />
            <span className="font-semibold text-crediq-green">+50 Credit Score Boost Applied</span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Verified on {new Date(verification.verified_at).toLocaleDateString()}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gradient-to-br from-postiq-red-light to-background border-postiq-red/30">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-postiq-red">Verify Your Address</h3>
          <p className="text-sm text-muted-foreground">
            Get a +50 credit score boost by verifying your physical address with PostiQ
          </p>
        </div>
        <div className="w-12 h-12 bg-postiq-red/10 rounded-full flex items-center justify-center">
          <MapPin className="w-6 h-6 text-postiq-red" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-background/80 p-4 rounded-lg border border-border">
          <h4 className="font-medium mb-2">How it works:</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Click the button below to use your GPS location</li>
            <li>We'll generate your unique PostiQ code (e.g., YA01 456)</li>
            <li>Your credit score will instantly increase by +50 points</li>
          </ol>
        </div>

        <div className="flex items-center gap-2 p-3 bg-crediq-green/10 rounded-lg border border-crediq-green/20">
          <Award className="w-4 h-4 text-crediq-green" />
          <span className="text-sm font-medium text-crediq-green">One-time boost • Free • Instant</span>
        </div>

        <Button
          onClick={handleGetLocation}
          disabled={isGettingLocation || createVerification.isPending}
          className="w-full bg-gradient-to-r from-postiq-red to-postiq-red-dark hover:from-postiq-red-dark hover:to-postiq-red"
        >
          {(isGettingLocation || createVerification.isPending) ? (
            <>Processing...</>
          ) : (
            <>
              <MapPin className="w-4 h-4 mr-2" />
              Verify with GPS Location
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Limit: 5 verifications per day
        </p>
      </div>
    </Card>
  );
}
