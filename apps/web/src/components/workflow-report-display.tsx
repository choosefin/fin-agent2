import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  BarChart3,
  LineChart,
  PieChart,
  Target,
  DollarSign,
  Globe,
  Activity,
  Sparkles
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WorkflowReportDisplayProps {
  results: Array<{
    agent: string;
    task: string;
    result: string;
    completedAt?: string;
  }>;
  workflowName?: string;
}

const agentIcons: Record<string, React.ReactNode> = {
  analyst: <BarChart3 className="h-5 w-5" />,
  trader: <LineChart className="h-5 w-5" />,
  advisor: <Target className="h-5 w-5" />,
  riskManager: <Shield className="h-5 w-5" />,
  economist: <Globe className="h-5 w-5" />,
  general: <Activity className="h-5 w-5" />,
  summary: <Sparkles className="h-5 w-5" />,
};

const agentColors: Record<string, string> = {
  analyst: 'bg-blue-500',
  trader: 'bg-green-500',
  advisor: 'bg-purple-500',
  riskManager: 'bg-red-500',
  economist: 'bg-yellow-500',
  general: 'bg-gray-500',
  summary: 'bg-gradient-to-r from-purple-500 to-pink-500',
};

export function WorkflowReportDisplay({ results, workflowName }: WorkflowReportDisplayProps) {
  // Ensure results is an array
  const safeResults = Array.isArray(results) ? results : [];
  
  // Debug: Log the raw results to see duplicates
  if (safeResults.length > 0) {
    console.log('WorkflowReportDisplay received results:', {
      totalCount: safeResults.length,
      agents: safeResults.map(r => r.agent),
      workflowName
    });
  }

  // Deduplicate results by agent name, keeping only the latest result for each agent
  const deduplicatedResults = safeResults.reduce((acc, current) => {
    // Skip invalid entries
    if (!current || !current.agent) return acc;
    
    const existingIndex = acc.findIndex(r => r.agent === current.agent);
    if (existingIndex === -1) {
      acc.push(current);
    } else {
      // Replace with newer result if it has a later completedAt timestamp
      const existing = acc[existingIndex];
      if (!existing.completedAt || (current.completedAt && new Date(current.completedAt) > new Date(existing.completedAt))) {
        acc[existingIndex] = current;
      }
    }
    return acc;
  }, [] as typeof results);

  if (deduplicatedResults.length > 0 && deduplicatedResults.length !== safeResults.length) {
    console.log('After deduplication:', {
      totalCount: deduplicatedResults.length,
      agents: deduplicatedResults.map(r => r.agent),
      duplicatesRemoved: safeResults.length - deduplicatedResults.length
    });
  }

  const [activeTab, setActiveTab] = useState(
    deduplicatedResults.findIndex(r => r.agent === 'summary') !== -1 
      ? deduplicatedResults.findIndex(r => r.agent === 'summary') 
      : 0
  );


  // Check if this is a risk assessment workflow
  const isRiskAssessment = workflowName?.toLowerCase().includes('risk') || 
                          deduplicatedResults.some(r => r.agent === 'riskManager');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-6 w-6" />
            {workflowName || 'Multi-Agent Analysis Report'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generated: {new Date().toLocaleString()}
          </p>
        </CardHeader>
      </Card>

      {/* Risk Summary Alert (for risk assessments) */}
      {isRiskAssessment && (
        <div className="border border-orange-500 bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="font-semibold">Risk Assessment Summary</h3>
          </div>
          <p className="text-sm">
            Your portfolio shows moderate risk levels with potential for optimization. 
            Review the detailed analysis below for specific recommendations.
          </p>
        </div>
      )}

      {/* Agent Reports */}
      <div className="w-full">
        {/* Tab-like navigation */}
        <div className="flex flex-wrap gap-2 mb-6 border-b">
          {deduplicatedResults.map((result, index) => {
            const isActive = index === activeTab;
            return (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                  isActive 
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' 
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {agentIcons[result.agent] || agentIcons.general}
                {result.agent.charAt(0).toUpperCase() + result.agent.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Active tab content */}
        {deduplicatedResults.map((result, index) => {
          if (index !== activeTab) return null;
          
          return (
            <Card key={index} className={result.agent === 'summary' ? 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20' : 'border-2'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${agentColors[result.agent]} text-white`}>
                      {agentIcons[result.agent] || agentIcons.general}
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {result.agent === 'summary' ? '🎯 Executive Summary' : `${result.agent.charAt(0).toUpperCase() + result.agent.slice(1)} Analysis`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{result.task}</p>
                    </div>
                  </div>
                  <Badge variant={result.agent === 'summary' ? 'default' : 'outline'} className="ml-auto">
                    {result.completedAt ? new Date(result.completedAt).toLocaleTimeString() : 'Processing...'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="markdown-content">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                  >
                    {result.result}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Combined Recommendations Section */}
      {deduplicatedResults.length > 1 && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Consolidated Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {deduplicatedResults.map((result, index) => {
                const recommendations = extractRecommendations(result.result);
                if (recommendations.length === 0) return null;
                
                return (
                  <div key={index} className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      {agentIcons[result.agent]}
                      {result.agent.charAt(0).toUpperCase() + result.agent.slice(1)}
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {recommendations.slice(0, 3).map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to extract recommendations from formatted text
function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  const lines = text.split('\n');
  let inRecommendationSection = false;
  
  lines.forEach(line => {
    if (line.toLowerCase().includes('recommendation') || 
        line.toLowerCase().includes('action item')) {
      inRecommendationSection = true;
    } else if (line.startsWith('#')) {
      inRecommendationSection = false;
    } else if (inRecommendationSection && (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./))) {
      recommendations.push(line.replace(/^[•\-]\s/, '').replace(/^\d+\.\s/, ''));
    }
  });
  
  return recommendations;
}