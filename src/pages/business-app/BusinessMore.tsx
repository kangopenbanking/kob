import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BusinessMore: React.FC = () => {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId?: string }>();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate(merchantId ? `/biz/${merchantId}/auth` : '/biz/auth');
  };

  return (
    <div className="p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground">Settings and account options</p>
      </header>

      <div className="space-y-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <button className="w-full flex items-center gap-3 text-left">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </CardContent>
        </Card>

        <Button
          onClick={handleLogout}
          variant="outline"
          className="w-full rounded-2xl"
        >
          Logout
        </Button>
      </div>
    </div>
  );
};

export default BusinessMore;
