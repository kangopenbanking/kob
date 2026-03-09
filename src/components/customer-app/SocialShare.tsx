import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface SocialShareProps {
  title: string;
  text?: string;
  url: string;
}

export function SocialShare({ title, text, url }: SocialShareProps) {
  const { toast } = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          toast({ title: 'Could not share', variant: 'destructive' });
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Share link copied to clipboard' });
      } catch {
        toast({ title: 'Could not copy link', variant: 'destructive' });
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleShare}
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}
