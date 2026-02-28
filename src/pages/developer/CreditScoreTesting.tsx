import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlayCircle, Download, Trash2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TestResult {
  scenario: string;
  score: number;
  score_breakdown: any;
  external_score: number | null;
  confidence: number;
  timestamp: string;
  duration_ms: number;
}

const CreditScoreTesting = () => {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const scenarios = [
    {
      id: 'good_credit',
      name: 'Good Credit Profile',
      description: 'High savings, on-time loan payments, diverse credit mix',
      expectedRange: '700-850',
    },
    {
      id: 'poor_credit',
      name: 'Poor Credit Profile',
      description: 'Late payments, high debt utilization, minimal savings',
      expectedRange: '300-550',
    },
    {
      id: 'new_customer',
      name: 'New Customer',
      description: 'No financial history, only KYC verification',
      expectedRange: '500-650',
    },
  ];

  const runScenarioTest = async (scenario: string) => {
    setLoading(true);
    setActiveScenario(scenario);
    const startTime = Date.now();

    try {
      // Step 1: Calculate internal score using real user data
      toast.info('Calculating internal score...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: internalScore, error: internalError } = await supabase.functions.invoke(
        'credit-score-calculate',
        {
          body: { 
            user_id: user.id,
            include_external: false,
            trigger_event: `test_${scenario}`
          }
        }
      );

      if (internalError) throw internalError;

      // Step 3: Calculate blended score (with external if available)
      toast.info('Calculating blended score...');
      const { data: blendedScore, error: blendedError } = await supabase.functions.invoke(
        'credit-score-calculate',
        {
          body: { 
            user_id: user.id,
            include_external: true,
            trigger_event: `test_${scenario}_blended`
          }
        }
      );

      if (blendedError) throw blendedError;

      const duration = Date.now() - startTime;

      const result: TestResult = {
        scenario,
        score: blendedScore.score,
        score_breakdown: blendedScore.score_breakdown,
        external_score: blendedScore.external_score || null,
        confidence: blendedScore.confidence || 0,
        timestamp: new Date().toISOString(),
        duration_ms: duration,
      };

      setTestResults(prev => [result, ...prev]);
      toast.success(`Test completed in ${(duration / 1000).toFixed(2)}s`);
    } catch (error) {
      console.error('Test error:', error);
      toast.error(error instanceof Error ? error.message : 'Test failed');
    } finally {
      setLoading(false);
      setActiveScenario(null);
    }
  };

  const runAllTests = async () => {
    for (const scenario of scenarios) {
      await runScenarioTest(scenario.id);
      // Wait 2 seconds between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const clearResults = () => {
    setTestResults([]);
    toast.success('Test results cleared');
  };

  const downloadResults = () => {
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `credit-score-tests-${Date.now()}.json`;
    link.click();
    toast.success('Results downloaded');
  };

  const getScoreColor = (score: number) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 650) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Credit Score Testing Dashboard</h1>
        <p className="text-muted-foreground">
          Test credit score calculations with various scenarios and validate algorithm accuracy
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Scenarios</CardTitle>
          <CardDescription>
            Generate test data and calculate credit scores for different user profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={runAllTests} 
              disabled={loading}
              className="gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Run All Tests
            </Button>
            <Button 
              onClick={downloadResults}
              variant="outline"
              disabled={testResults.length === 0}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Results
            </Button>
            <Button 
              onClick={clearResults}
              variant="outline"
              disabled={testResults.length === 0}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear Results
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((scenario) => (
              <Card key={scenario.id} className="border-2">
                <CardHeader>
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription className="text-sm">
                    {scenario.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expected Range:</span>
                      <Badge variant="outline">{scenario.expectedRange}</Badge>
                    </div>
                    <Button
                      onClick={() => runScenarioTest(scenario.id)}
                      disabled={loading}
                      className="w-full gap-2"
                      variant={activeScenario === scenario.id ? "default" : "outline"}
                    >
                      {activeScenario === scenario.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4" />
                          Run Test
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Recent test executions with detailed score breakdowns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="detailed">Detailed Breakdown</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                {testResults.map((result, index) => (
                  <Alert key={index}>
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">
                            {scenarios.find(s => s.id === result.scenario)?.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(result.timestamp).toLocaleString()} • 
                            Duration: {(result.duration_ms / 1000).toFixed(2)}s
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
                            {result.score}
                          </div>
                          {result.external_score && (
                            <div className="text-sm text-muted-foreground">
                              External: {result.external_score}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Confidence: {(result.confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </TabsContent>

              <TabsContent value="detailed" className="space-y-4">
                {testResults.map((result, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {scenarios.find(s => s.id === result.scenario)?.name}
                      </CardTitle>
                      <CardDescription>
                        Score: <span className={`font-bold ${getScoreColor(result.score)}`}>{result.score}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {result.score_breakdown && Object.entries(result.score_breakdown).map(([key, value]) => (
                          <div key={key} className="flex justify-between border-b pb-2">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, ' ').replace(' score', '')}:
                            </span>
                            <span className="font-mono">{value as number}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreditScoreTesting;
