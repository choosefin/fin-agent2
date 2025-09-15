import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  // Parse markdown-like formatting in the results
  const parseFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let inCodeBlock = false;

    lines.forEach((line, index) => {
      // Headers
      if (line.startsWith('# ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h1 key={index} className="text-2xl font-bold mb-4 mt-6">{line.slice(2)}</h1>);
      } else if (line.startsWith('## ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h2 key={index} className="text-xl font-semibold mb-3 mt-4">{line.slice(3)}</h2>);
      } else if (line.startsWith('### ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h3 key={index} className="text-lg font-medium mb-2 mt-3">{line.slice(4)}</h3>);
      } else if (line.startsWith('#### ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<h4 key={index} className="text-base font-medium mb-2">{line.slice(5)}</h4>);
      }
      // Lists
      else if (line.startsWith('• ') || line.startsWith('- ') || line.match(/^\d+\.\s/)) {
        const listItem = line.replace(/^[•\-]\s/, '').replace(/^\d+\.\s/, '');
        currentList.push(formatListItem(listItem));
      }
      // Blockquotes
      else if (line.startsWith('> ')) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(
          <blockquote key={index} className="border-l-4 border-gray-300 pl-4 italic my-4">
            {line.slice(2)}
          </blockquote>
        );
      }
      // Code blocks
      else if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      } else if (inCodeBlock) {
        elements.push(
          <pre key={index} className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-x-auto">
            <code>{line}</code>
          </pre>
        );
      }
      // Horizontal rules
      else if (line === '---' || line === '***') {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<hr key={index} className="my-6 border-gray-300" />);
      }
      // Regular text
      else if (line.trim()) {
        if (currentList.length > 0) {
          elements.push(<ul key={`list-${index}`} className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
          currentList = [];
        }
        elements.push(<p key={index} className="mb-2">{formatText(line)}</p>);
      }
    });

    // Add any remaining list items
    if (currentList.length > 0) {
      elements.push(<ul key="final-list" className="list-disc list-inside space-y-1 mb-4">{currentList.map((item, i) => <li key={i}>{item}</li>)}</ul>);
    }

    return elements;
  };

  // Format text with bold, italic, and inline code
  const formatText = (text: string): React.ReactNode => {
    // Replace **text** with bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Replace *text* with italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Replace `code` with inline code
    text = text.replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  // Format list items with special handling for metrics
  const formatListItem = (text: string): React.ReactNode => {
    // Check for warning/error indicators
    if (text.startsWith('⚠️') || text.startsWith('🔴')) {
      return (
        <span className="text-red-600 dark:text-red-400 font-medium">
          {formatText(text)}
        </span>
      );
    }
    if (text.startsWith('🟡')) {
      return (
        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
          {formatText(text)}
        </span>
      );
    }
    if (text.startsWith('🟢') || text.startsWith('✓')) {
      return (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {formatText(text)}
        </span>
      );
    }
    
    // Check for percentage values (positive/negative)
    const percentMatch = text.match(/([+-]?\d+\.?\d*%)/);
    if (percentMatch) {
      const percent = percentMatch[1];
      const isPositive = !percent.startsWith('-');
      return (
        <span>
          {formatText(text.replace(percent, ''))}
          <span className={isPositive ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium'}>
            {percent}
          </span>
        </span>
      );
    }
    
    return formatText(text);
  };

  // Check if this is a risk assessment workflow
  const isRiskAssessment = workflowName?.toLowerCase().includes('risk') || 
                          results.some(r => r.agent === 'riskManager');

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
        <Alert className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Risk Assessment Summary</AlertTitle>
          <AlertDescription>
            Your portfolio shows moderate risk levels with potential for optimization. 
            Review the detailed analysis below for specific recommendations.
          </AlertDescription>
        </Alert>
      )}

      {/* Agent Reports Tabs - Show summary first if available */}
      <Tabs defaultValue={results.find(r => r.agent === 'summary') ? 'summary' : '0'} className="w-full">
        <TabsList className="grid grid-cols-auto gap-2 w-full">
          {results.map((result, index) => {
            const tabValue = result.agent === 'summary' ? 'summary' : index.toString();
            return (
              <TabsTrigger 
                key={index} 
                value={tabValue}
                className="flex items-center gap-2"
              >
                {agentIcons[result.agent] || agentIcons.general}
                {result.agent.charAt(0).toUpperCase() + result.agent.slice(1)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {results.map((result, index) => {
          const tabValue = result.agent === 'summary' ? 'summary' : index.toString();
          return (
            <TabsContent key={index} value={tabValue} className="mt-6">
            <Card className={result.agent === 'summary' ? 'border-2 border-purple-500 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20' : 'border-2'}>
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
                <div className="markdown-report-content prose prose-slate dark:prose-invert max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({children}) => <h1 className="text-3xl font-bold mb-6 mt-8 pb-3 border-b-2 border-gray-200 dark:border-gray-700">{children}</h1>,
                      h2: ({children}) => <h2 className="text-2xl font-semibold mb-4 mt-6 text-gray-900 dark:text-gray-100">{children}</h2>,
                      h3: ({children}) => <h3 className="text-xl font-medium mb-3 mt-4 pl-4 border-l-4 border-blue-500 text-gray-800 dark:text-gray-200">{children}</h3>,
                      h4: ({children}) => <h4 className="text-lg font-medium mb-2 mt-3 text-gray-700 dark:text-gray-300">{children}</h4>,
                      p: ({children}) => <p className="mb-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">{children}</p>,
                      ul: ({children}) => <ul className="list-disc list-inside space-y-2 mb-4 ml-4">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal list-inside space-y-2 mb-4 ml-4">{children}</ol>,
                      li: ({children}) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
                      strong: ({children}) => <strong className="font-bold text-gray-900 dark:text-gray-100">{children}</strong>,
                      em: ({children}) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
                      blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-950/30 italic text-gray-700 dark:text-gray-300">{children}</blockquote>,
                      code: ({children, className}) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono text-gray-800 dark:text-gray-200">{children}</code>
                        ) : (
                          <code className="block bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-x-auto text-gray-100">{children}</code>
                        );
                      },
                      pre: ({children}) => <pre className="bg-gray-900 dark:bg-gray-950 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                      table: ({children}) => <table className="w-full mb-6 border-collapse border border-gray-300 dark:border-gray-600">{children}</table>,
                      thead: ({children}) => <thead className="bg-gray-100 dark:bg-gray-800">{children}</thead>,
                      th: ({children}) => <th className="px-4 py-3 text-left font-semibold border-b-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">{children}</th>,
                      td: ({children}) => <td className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">{children}</td>,
                      hr: () => <hr className="my-8 border-gray-300 dark:border-gray-700" />,
                    }}
                  >
                    {result.result}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          );
        })}
      </Tabs>

      {/* Combined Recommendations Section */}
      {results.length > 1 && (
        <Card className="border-2 border-blue-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Consolidated Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((result, index) => {
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