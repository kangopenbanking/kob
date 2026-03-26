import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, ThumbsUp, MessageCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface ReviewFormProps {
  orderId: string;
  merchantId: string;
  onSuccess: () => void;
}

function ReviewForm({ orderId, merchantId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const { user } = useCustomerAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any).from('pos_order_reviews').insert({
        order_id: orderId,
        customer_id: user.id,
        merchant_id: merchantId,
        rating,
        comment,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Review submitted', description: 'Thank you for your feedback!' });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not submit review', variant: 'destructive' });
    },
  });

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-semibold mb-2">Rate your experience</h3>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button key={star} onClick={() => setRating(star)} className="focus:outline-none">
              <Star
                className={`h-8 w-8 ${
                  star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <Textarea
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
      />

      <Button onClick={() => submitReview.mutate()} disabled={submitReview.isPending} className="w-full">
        {submitReview.isPending ? 'Submitting...' : 'Submit Review'}
      </Button>
    </Card>
  );
}

export function CustomerReviews() {
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const [showReviewForm, setShowReviewForm] = useState<string | null>(null);

  const { data: pendingReviews } = useQuery({
    queryKey: ['pending-reviews', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser?.email) return [];

      const { data: orders, error } = await (supabase as any)
        .from('pos_orders')
        .select('id, order_number, merchant_id, created_at')
        .eq('customer_email', authUser.email)
        .eq('status', 'completed')
        .limit(10);

      if (error) throw error;
      if (!orders?.length) return [];

      // Check which have reviews
      const orderIds = orders.map((o: any) => o.id);
      const { data: reviews } = await (supabase as any)
        .from('pos_order_reviews')
        .select('order_id')
        .in('order_id', orderIds);

      const reviewedIds = (reviews || []).map((r: any) => r.order_id);
      const pending = orders.filter((o: any) => !reviewedIds.includes(o.id));

      // Fetch merchant names
      const merchantIds = [...new Set(pending.map((o: any) => o.merchant_id).filter(Boolean))];
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase
          .from('gateway_merchants')
          .select('id, business_name')
          .in('id', merchantIds as string[]);
        merchants = m || [];
      }

      return pending.map((order: any) => ({
        ...order,
        merchant: merchants.find((m: any) => m.id === order.merchant_id),
      }));
    },
  });

  const { data: myReviews } = useQuery({
    queryKey: ['my-reviews', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: reviews, error } = await (supabase as any)
        .from('pos_order_reviews')
        .select('id, rating, comment, created_at, helpful_count, merchant_id, order_id')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!reviews?.length) return [];

      const merchantIds = [...new Set(reviews.map((r: any) => r.merchant_id).filter(Boolean))];
      let merchants: any[] = [];
      if (merchantIds.length > 0) {
        const { data: m } = await supabase
          .from('gateway_merchants')
          .select('id, business_name')
          .in('id', merchantIds as string[]);
        merchants = m || [];
      }

      return reviews.map((review: any) => ({
        ...review,
        merchant: merchants.find((m: any) => m.id === review.merchant_id),
      }));
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 pb-20">
        <Card className="p-12 text-center max-w-md mx-auto mt-20">
          <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground">Please sign in to write reviews</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-xl bg-card p-2"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-2xl font-bold">Reviews & Ratings</h1>
            <p className="text-muted-foreground">Share your shopping experiences</p>
          </div>
        </div>

        {pendingReviews && pendingReviews.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold">Waiting for your review</h2>
            {pendingReviews.map((order: any) => (
              <div key={order.id}>
                {showReviewForm === order.id ? (
                  <ReviewForm
                    orderId={order.id}
                    merchantId={order.merchant_id}
                    onSuccess={() => setShowReviewForm(null)}
                  />
                ) : (
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                          <MessageCircle className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{order.merchant?.business_name || 'Store'}</h3>
                          <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
                        </div>
                      </div>
                      <Button onClick={() => setShowReviewForm(order.id)}>Write Review</Button>
                    </div>
                  </Card>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="font-semibold">My Reviews ({myReviews?.length || 0})</h2>
          {myReviews && myReviews.length > 0 ? (
            myReviews.map((review: any) => (
              <Card key={review.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{user.fullName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">{review.merchant?.business_name || 'Store'}</h4>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-foreground">
                    <ThumbsUp className="h-4 w-4" />
                    <span>{review.helpful_count || 0} helpful</span>
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No reviews yet</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
