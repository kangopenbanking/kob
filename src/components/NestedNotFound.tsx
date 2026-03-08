import { useLocation, useNavigate } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NestedNotFoundProps {
  portalName?: string;
  homePath?: string;
}

/**
 * 404 page for nested layouts (admin, merchant, fi-portal, etc.)
 * Shows within the portal layout instead of a blank page.
 */
export function NestedNotFound({ portalName = 'this section', homePath = '/' }: NestedNotFoundProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <FileQuestion className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-1">Page Not Found</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-1">
        The page <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> doesn't exist in {portalName}.
      </p>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Go Back</Button>
        <Button size="sm" onClick={() => navigate(homePath)}>Go to Dashboard</Button>
      </div>
    </div>
  );
}
