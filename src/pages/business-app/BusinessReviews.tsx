import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Star, MessageSquare, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <Star key={n} className={`h-3.5 w-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
    ))}
  </div>
);

const BusinessReviews: React.FC = () => {
  const { merchantId } = useParams<{ merchantId?: string }>();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['biz-reviews', merchantId],
    queryFn: async () => {
      if (!merchantId) return [];
      const { data, error } = await supabase
        .from('pos_store_reviews')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
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
      const { error } = await supabase
        .from('pos_store_reviews')
        .update({ merchant_reply: reply, replied_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['biz-reviews'] });
      toast.success('Reply sent');
      setReplyingTo(null);
      setReplyText('');
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background p-4">
      <header className="mb-4 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <div className="flex items-center gap-2">
          <StarRating rating={Math.round(parseFloat(avgRating))} />
          <span className="text-sm font-bold">{avgRating}</span>
          <span className="text-sm text-muted-foreground">· {reviews?.length ?? 0} review{(reviews?.length ?? 0) !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : !reviews?.length ? (
        <Card className="border-0 shadow-md">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Star className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">No reviews yet. They'll appear here as customers leave feedback.</p>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {reviews.map((r: any, i: number) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <StarRating rating={r.rating} />
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <p className="text-sm text-foreground">{r.comment}</p>}

                    {r.merchant_reply ? (
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-xs font-bold text-muted-foreground mb-1">Your reply</p>
                        <p className="text-sm">{r.merchant_reply}</p>
                      </div>
                    ) : replyingTo === r.id ? (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          className="rounded-xl text-sm"
                        />
                        <Button
                          size="icon" className="rounded-xl shrink-0"
                          onClick={() => replyMutation.mutate({ id: r.id, reply: replyText })}
                          disabled={!replyText.trim() || replyMutation.isPending}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost" size="sm" className="gap-1.5 text-xs"
                        onClick={() => setReplyingTo(r.id)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Reply
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
};

export default BusinessReviews;
