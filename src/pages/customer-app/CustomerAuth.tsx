import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const CustomerAuth: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();

  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      <Link to={`/app/${institutionId}`} className="mb-8">
        <ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} />
      </Link>
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-center text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
        <Button className="w-full max-w-xs rounded-2xl" size="lg" asChild>
          <Link to={`/app/${institutionId}/home`}>Continue to App</Link>
        </Button>
      </div>
    </div>
  );
};

export default CustomerAuth;
