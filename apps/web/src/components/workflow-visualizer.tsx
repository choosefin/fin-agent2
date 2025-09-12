'use client';

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  LineChart, 
  Shield, 
  BarChart3, 
  Globe,
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface AgentStep {
  index: number;
  agent: string;
  task: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
  startedAt?: string;
  completedAt?: string;
}

interface WorkflowVisualizerProps {
  workflowId?: string;
  workflowName?: string;
  steps: AgentStep[];
  progress?: {
    completed: number;
    total: number;
    percentage: number;
  };
  onClose?: () => void;
}

const agentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  general: Brain,
  analyst: LineChart,
  trader: TrendingUp,
  advisor: BarChart3,
  riskManager: Shield,
  economist: Globe,
};

const agentColors: Record<string, string> = {
  general: 'bg-purple-500',
  analyst: 'bg-blue-500',
  trader: 'bg-green-500',
  advisor: 'bg-indigo-500',
  riskManager: 'bg-orange-500',
  economist: 'bg-teal-500',
};

export function WorkflowVisualizer({ 
  workflowId,
  workflowName = 'Multi-Agent Workflow',
  steps,
  progress,
  onClose 
}: WorkflowVisualizerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-expand completed steps
  useEffect(() => {
    const completedSteps = steps
      .filter(s => s.status === 'completed')
      .map(s => s.index);
    setExpandedSteps(new Set(completedSteps));
  }, [steps]);

  const toggleStep = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'processing':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 animate-pulse';
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{workflowName}</h3>
            {workflowId && (
              <p className="text-xs text-gray-500">ID: {workflowId}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            {isMinimized ? <ChevronUp /> : <ChevronDown />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Progress Bar */}
          {progress && (
            <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-500">
                  {progress.completed} of {progress.total} agents completed
                </span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>
          )}

          {/* Agent Steps */}
          <div className="p-4 space-y-3">
            {steps.map((step, index) => {
              const Icon = agentIcons[step.agent] || Brain;
              const color = agentColors[step.agent] || 'bg-gray-500';
              const isExpanded = expandedSteps.has(index);
              const isActive = step.status === 'processing';

              return (
                <div
                  key={index}
                  className={cn(
                    'border rounded-lg transition-all duration-200',
                    isActive && 'ring-2 ring-blue-500 ring-opacity-50',
                    'hover:shadow-md'
                  )}
                >
                  {/* Step Header */}
                  <div
                    className={cn(
                      'p-3 flex items-center gap-3 cursor-pointer',
                      getStatusColor(step.status)
                    )}
                    onClick={() => toggleStep(index)}
                  >
                    <div className={cn('p-2 rounded-full', color)}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{step.agent} Agent</span>
                        {getStatusIcon(step.status)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {step.task}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {step.status === 'processing' && (
                        <Badge variant="outline" className="animate-pulse">
                          Thinking...
                        </Badge>
                      )}
                      <ChevronDown 
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isExpanded && 'rotate-180'
                        )}
                      />
                    </div>
                  </div>

                  {/* Step Content */}
                  {isExpanded && step.result && (
                    <div className="p-4 border-t bg-white dark:bg-gray-900">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap text-sm font-sans">
                          {step.result}
                        </pre>
                      </div>
                      {step.completedAt && (
                        <p className="text-xs text-gray-500 mt-3">
                          Completed at {new Date(step.completedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Connection Line */}
                  {index < steps.length - 1 && (
                    <div className="flex justify-center -mb-3 relative z-10">
                      <div className={cn(
                        'w-0.5 h-6',
                        step.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {steps.every(s => s.status === 'completed') && (
            <div className="p-4 border-t bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Workflow completed successfully!</span>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default WorkflowVisualizer;