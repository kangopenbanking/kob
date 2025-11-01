import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

const ScoreEducation = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle>Understanding Your Credit Score</CardTitle>
        </div>
        <CardDescription>Learn how your score is calculated and what affects it</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>How Your Score is Calculated</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>Your credit score is calculated using 8 key components, each weighted differently:</p>
              <ul className="space-y-2 ml-4">
                <li><strong>Payment History (35%)</strong> - Your track record of on-time payments</li>
                <li><strong>Amounts Owed (30%)</strong> - Your current debt relative to capacity</li>
                <li><strong>Credit History Length (15%)</strong> - How long you've had accounts</li>
                <li><strong>Credit Mix (10%)</strong> - Variety of credit products you use</li>
                <li><strong>New Credit (10%)</strong> - Recent credit inquiries and accounts</li>
                <li><strong>Savings Behavior (5%)</strong> - Your savings discipline</li>
                <li><strong>Transaction Pattern (3%)</strong> - Financial activity consistency</li>
                <li><strong>KYC Compliance (2%)</strong> - Identity verification status</li>
              </ul>
              <p className="text-muted-foreground">
                These components are scored individually (total 117 points) and then weighted and scaled to the 300-850 range.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger>Score Types Explained</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1">Baseline Score (300-650)</h4>
                <p className="text-muted-foreground">
                  A preliminary score based on questionnaire responses only. This is your starting point before any financial activity.
                  Confidence level: ~30%
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Internal Score (300-850)</h4>
                <p className="text-muted-foreground">
                  Calculated from your transaction history, loan payments, and savings behavior within KOB.
                  Confidence level: 60-80%
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Blended Score (300-850)</h4>
                <p className="text-muted-foreground">
                  The most accurate score, combining internal KOB data (70%) with external NjangiBox credit bureau data (30%).
                  Requires KYC verification. Confidence level: 80-100%
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger>Confidence Levels</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>Confidence level indicates how reliable your score is based on available data:</p>
              <ul className="space-y-2 ml-4">
                <li><strong>High (80-100%)</strong> - Comprehensive data from multiple sources</li>
                <li><strong>Medium (50-79%)</strong> - Good amount of internal transaction data</li>
                <li><strong>Low (0-49%)</strong> - Limited data, mostly questionnaire-based</li>
              </ul>
              <p className="text-muted-foreground">
                Higher confidence means lenders can trust your score more. Improve confidence by completing KYC, 
                making regular transactions, and linking external credit data.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger>What Can Change Your Score</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <div>
                <h4 className="font-semibold mb-1 text-green-600">Positive Changes:</h4>
                <ul className="space-y-1 ml-4 text-muted-foreground">
                  <li>• Making payments on time</li>
                  <li>• Paying down existing debt</li>
                  <li>• Maintaining accounts over time</li>
                  <li>• Regular savings deposits</li>
                  <li>• Completing KYC verification</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-1 text-red-600">Negative Changes:</h4>
                <ul className="space-y-1 ml-4 text-muted-foreground">
                  <li>• Late or missed payments</li>
                  <li>• Maxing out credit limits</li>
                  <li>• Applying for multiple loans quickly</li>
                  <li>• Defaulting on loans</li>
                  <li>• Closing old accounts</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger>External Credit Bureau (NjangiBox)</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>
                NjangiBox is an external credit bureau that provides additional credit history data. 
                When available, this data is blended with internal KOB data for maximum accuracy.
              </p>
              <ul className="space-y-2 ml-4">
                <li><strong>Blending Ratio:</strong> 70% KOB internal + 30% NjangiBox external</li>
                <li><strong>Cache Duration:</strong> External data is cached for 30 days</li>
                <li><strong>Requirement:</strong> KYC verification must be completed</li>
                <li><strong>Benefits:</strong> Higher confidence and more comprehensive assessment</li>
              </ul>
              <p className="text-muted-foreground">
                External bureau data includes your credit history with other financial institutions, 
                providing a complete picture of your creditworthiness.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6">
            <AccordionTrigger>Automatic Recalculation</AccordionTrigger>
            <AccordionContent className="space-y-3 text-sm">
              <p>Your score is automatically recalculated when:</p>
              <ul className="space-y-2 ml-4">
                <li><strong>Loan Application</strong> - When you apply for a new loan</li>
                <li><strong>Manual Refresh</strong> - When you click the refresh button</li>
                <li><strong>Cache Expiration</strong> - After 30 days for external data</li>
                <li><strong>Score Expiry</strong> - After 90 days of no updates</li>
                <li><strong>Significant Events</strong> - Major financial activities detected</li>
              </ul>
              <p className="text-muted-foreground">
                Regular recalculation ensures your score stays current and reflects your latest financial behavior.
                You can also manually refresh your score at any time.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default ScoreEducation;
