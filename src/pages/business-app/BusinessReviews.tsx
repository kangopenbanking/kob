import React, { useState } from 'react';
import { useMerchantContext } from '@/hooks/useMerchantContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star key={n} className={cn('h-3.5 w-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
    ))}
  </div>
);

const BusinessReviews: React.FC = () => {
  const { merchantId } = useMerchantContext();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['biz-reviews', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase.from('pos_store_reviews').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!merchantId,
  });

  const avgRating = reviews?.length
    ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const { error } = await supabase.from('pos_store_reviews').update({ merchant_reply: reply, replied_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['biz-reviews'] }); toast.success('Reply sent'); setReplyingTo(null); setReplyText(''); },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background px-5 md:px-0 pb-24">
      {/* Header */}
      <header className="pt-4 md:pt-0 mb-5">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Reviews</h1>
        <div className="flex items-center gap-2 mt-1">
          <StarRating rating={Math.round(parseFloat(avgRating))} />
          <span className="text-sm font-bold text-foreground">{avgRating}</span>
          <span className="text-xs text-muted-foreground">· {reviews?.length ?? 0} review{(reviews?.length ?? 0) !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {/* Rating Summary */}
      {reviews && reviews.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-4 mb-5">
          <div className="grid grid-cols-5 gap-2">
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter((r: any) => r.rating === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{star}★</span>
                  <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !reviews?.length ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-4">
            <Star className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-bold mb-1">No reviews yet</h3>
          <p className="text-sm text-muted-foreground text-center">They'll appear here as customers leave feedback.</p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {reviews.map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <StarRating rating={r.rating} />
                    <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm text-foreground leading-relaxed">{r.comment}</p>}

                  {r.merchant_reply ? (
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Your reply</p>
                      <p className="text-sm text-foreground">{r.merchant_reply}</p>
                    </div>
                  ) : replyingTo === r.id ? (
                    <div className="flex gap-2">
                      <Input placeholder="Write a reply..." value={replyText} onChange={e => setReplyText(e.target.value)} className="rounded-xl text-sm" />
                      <Button size="icon" className="rounded-xl shrink-0 h-10 w-10 bg-foreground text-background hover:bg-foreground/90"
                        onClick={() => replyMutation.mutate({ id: r.id, reply: replyText })}
                        disabled={!replyText.trim() || replyMutation.isPending}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setReplyingTo(r.id)}>
                      <MessageSquare className="h-3.5 w-3.5" /> Reply
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default BusinessReviews;
