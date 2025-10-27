import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DocNavigationProps {
  previousPage?: {
    title: string;
    path: string;
  };
  nextPage?: {
    title: string;
    path: string;
  };
}

export function DocNavigation({ previousPage, nextPage }: DocNavigationProps) {
  if (!previousPage && !nextPage) return null;

  return (
    <div className="flex items-center justify-between pt-8 mt-8 border-t">
      <div className="flex-1">
        {previousPage && (
          <Link to={previousPage.path}>
            <Button variant="ghost" className="group">
              <ChevronLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
              <div className="text-left">
                <div className="text-xs text-muted-foreground">Previous</div>
                <div className="font-semibold">{previousPage.title}</div>
              </div>
            </Button>
          </Link>
        )}
      </div>
      
      <div className="flex-1 flex justify-end">
        {nextPage && (
          <Link to={nextPage.path}>
            <Button variant="ghost" className="group">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Next</div>
                <div className="font-semibold">{nextPage.title}</div>
              </div>
              <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
