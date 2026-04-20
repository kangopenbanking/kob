import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { NotificationCenter } from '@/components/NotificationCenter';

interface BusinessTopBarProps {
  isDesktop?: boolean;
}

export const BusinessTopBar: React.FC<BusinessTopBarProps> = ({ isDesktop }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOwner, isStaff } = useMerchantContext();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const rootPaths = ['/biz/home', '/biz/orders', '/biz/products', '/biz/more'];
  const showBack = !isDesktop && !rootPaths.includes(location.pathname);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      navigate(`/biz/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  if (isDesktop) {
    return (
      <div className="flex flex-1 items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground" onClick={() => setSearchOpen(s => !s)}>
            <Search className="h-4.5 w-4.5" strokeWidth={1.6} />
          </Button>
          <NotificationCenter />
        </div>
      </div>
    );
  }

  // Mobile top bar
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border/30">
      {searchOpen ? (
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search products, orders…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-3 rounded-xl border-border/50 bg-muted/40 text-sm"
            />
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground shrink-0" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-2 min-w-0">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go back"
                className="h-9 w-9 rounded-xl text-foreground -ml-2 shrink-0"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="h-[1.15rem] w-[1.15rem]" strokeWidth={2} />
              </Button>
            )}
            <p className="text-base font-bold text-foreground tracking-tight truncate">
              Kang Business
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground" onClick={() => setSearchOpen(true)}>
              <Search className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.6} />
            </Button>
            <NotificationCenter />
          </div>
        </>
      )}
    </div>
  );
};
