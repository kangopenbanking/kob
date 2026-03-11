import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ShieldCheck, ShieldAlert, TrendingDown, Calendar, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Inquiry {
  id: string;
  inquiry_type: string;
  inquirer_name: string;
  inquirer_type: string;
  purpose: string;
  inquiry_date: string;
  score_impact: number | null;
  score_provided: number | null;
  status: string | null;
}

interface CreditInquiriesPanelProps {
  compact?: boolean;
}

export default function CreditInquiriesPanel({ compact = false }: CreditInquiriesPanelProps) {
  const { data: inquiries, isLoading } = useQuery({
    queryKey: ['credit-inquiries-panel'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('credit_inquiries')
        .select('*')
        .eq('user_id', user.id)
        .order('inquiry_date', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Inquiry[];
    },
  });

  const hardInquiries = inquiries?.filter(i => i.inquiry_type === 'hard') || [];
  const softInquiries = inquiries?.filter(i => i.inquiry_type === 'soft') || [];

  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

  const hard6m = hardInquiries.filter(i => new Date(i.inquiry_date) >= sixMonthsAgo).length;
  const hard12m = hardInquiries.filter(i => new Date(i.inquiry_date) >= twelveMonthsAgo).length;
  const totalScoreImpact = hardInquiries.reduce((sum, i) => sum + (i.score_impact || 0), 0);

  const renderInquiryRow = (inq: Inquiry) => (
    <div key={inq.id} className="flex items-start gap-3 py-3 border-b border-border/40 last:border-0">
      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
        inq.inquiry_type === 'hard' 
          ? 'bg-red-100 dark:bg-red-900/40' 
          : 'bg-emerald-100 dark:bg-emerald-900/40'
      }`}>
        {inq.inquiry_type === 'hard' 
          ? <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
          : <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold truncate">{inq.inquirer_name}</p>
          <Badge 
            variant="outline" 
            className={`text-[9px] shrink-0 ${
              inq.inquiry_type === 'hard' 
                ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400' 
                : 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
            }`}
          >
            {inq.inquiry_type === 'hard' ? 'Hard' : 'Soft'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{inq.purpose}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(inq.inquiry_date), { addSuffix: true })}
          </span>
          {inq.inquiry_type === 'hard' && inq.score_impact !== null && inq.score_impact !== 0 && (
            <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3" />
              {inq.score_impact} pts
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <Search className="h-4 w-4 text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <CardTitle className="text-lg">Credit Inquiries</CardTitle>
            <CardDescription className="text-xs">Hard and soft checks on your credit profile</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2.5 text-center">
            <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">Hard (6m)</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-300">{hard6m}</p>
          </div>
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5 text-center">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Hard (12m)</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{hard12m}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">Score Impact</p>
            <p className="text-lg font-bold text-foreground">{totalScoreImpact || 0}</p>
          </div>
        </div>

        <Tabs defaultValue="hard">
          <TabsList className="w-full">
            <TabsTrigger value="hard" className="flex-1 gap-1 text-xs">
              <ShieldAlert className="h-3 w-3" />
              Hard Checks ({hardInquiries.length})
            </TabsTrigger>
            <TabsTrigger value="soft" className="flex-1 gap-1 text-xs">
              <ShieldCheck className="h-3 w-3" />
              Soft Checks ({softInquiries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hard" className="mt-3">
            {hardInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hard inquiries found</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {hardInquiries.slice(0, compact ? 5 : 20).map(renderInquiryRow)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="soft" className="mt-3">
            {softInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No soft inquiries found</p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {softInquiries.slice(0, compact ? 5 : 20).map(renderInquiryRow)}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Info note */}
        <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/40">
          <p className="text-[10px] text-muted-foreground">
            <strong>Hard checks</strong> occur when you apply for credit and may temporarily lower your score by 2-10 points. 
            <strong> Soft checks</strong> (self-checks, pre-qualification) have no impact on your score.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
